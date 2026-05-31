import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

const MATHPIX_APP_ID =
  process.env.MATHPIX_APP_ID ||
  process.env.APP_ID ||
  '';

const MATHPIX_APP_KEY =
  process.env.MATHPIX_APP_KEY ||
  process.env.APP_KEY ||
  '';

const sessions = new Map();

//获取本机ip地址，优先返回局域网地址
const HOST_IP = process.env.HOST_IP || getLocalIPv4();
function getLocalIPv4() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            const isIPv4 = net.family === 'IPv4' || net.family === 4;
            const isInternal = net.internal === true;

            if (isIPv4 && !isInternal) {
                // 优先返回局域网地址
                if (
                    net.address.startsWith('192.168.') ||
                    net.address.startsWith('10.') ||
                    net.address.startsWith('172.')
                ) {
                    return net.address;
                }
            }
        }
    }

    return 'localhost';
}
function isSessionExpired(session) {
    if (!session) {
        return true;
    }
    return Date.now() > session.expires_at;
}

function markSessionExpired(session) {
    if (!session) {
        return;
    }
    session.status = 'expired';
}

function normalizeLatexMatrix(input) {
    const match = input.match(/\\begin\{(?:array|pmatrix|bmatrix|matrix)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|pmatrix|bmatrix|matrix)\}/);

    if (!match) {
        return '';
    }

    const rows = match[1]
        .split(/\\\\/)
        .map(row => row.trim())
        .filter(Boolean)
        .map(row => {
            const columns = row
                .split('&')
                .map(column => column.trim())
                .filter(Boolean);

            return `[${columns.join(',')}]`;
        });

    if (rows.length === 0) {
        return '';
    }

    return `matrix(${rows.join(',')})`;
}

function normalizeLatexPiecewise(input) {
    const match = input.match(/\\begin\{(cases|array)\}(?:\{[^}]*\})?([\s\S]*?)\\end\{\1\}/);

    if (!match) {
        return '';
    }

    const branches = match[2]
        .split(/\\\\/)
        .map(row => row.trim())
        .filter(Boolean)
        .map(row => {
            const [rawExpression, ...conditionParts] = row.split('&');
            const expression = rawExpression.replace(/[,\s]+$/g, '').trim();
            const condition = conditionParts.join('&').trim();

            return {
                expression: normalizeLatexToStack(expression),
                condition: condition ? normalizeLatexToStack(condition) : ''
            };
        })
        .filter(branch => branch.expression);

    if (branches.length === 0) {
        return '';
    }

    if (
        match[1] === 'array' &&
        !branches.some(branch => /(<=|>=|<|>|\\leq|\\geq|\\leqslant|\\geqslant)/.test(branch.condition))
    ) {
        return '';
    }

    if (branches.length === 1 || !branches[0].condition) {
        return branches[0].expression;
    }

    let result = branches[branches.length - 1].expression;

    for (let index = branches.length - 2; index >= 0; index--) {
        const branch = branches[index];

        if (!branch.condition) {
            result = branch.expression;
            continue;
        }

        result = `if ${branch.condition} then ${branch.expression} else ${result}`;
    }

    return result;
}

function extractMainMathExpression(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    let s = input.trim();
    const matrix = normalizeLatexMatrix(s);

    if (matrix) {
        return matrix;
    }

    // 去掉 array / aligned / cases 等环境包裹
    s = s.replace(/\\begin\{array\}\{[^}]*\}/g, '');
    s = s.replace(/\\end\{array\}/g, '');

    s = s.replace(/\\begin\{aligned\}/g, '');
    s = s.replace(/\\end\{aligned\}/g, '');

    s = s.replace(/\\begin\{cases\}/g, '');
    s = s.replace(/\\end\{cases\}/g, '');

    // 按 LaTeX 换行拆分
    const parts = s
        .split(/\\\\/)
        .map(x => x.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return s;
    }

    // 优先取最后一条非空表达式
    // 对你现在这个例子，会取到 \left(x^{2}+1\right)+3
    return parts[parts.length - 1];
}

function expandChainedInequality(input) {
    if (!input || /\band\b/.test(input)) {
        return input;
    }

    const parts = input.split(/(<=|>=|<|>)/);

    if (parts.length < 5 || parts.length % 2 === 0) {
        return input;
    }

    const operands = parts.filter((_, index) => index % 2 === 0);
    const operators = parts.filter((_, index) => index % 2 === 1);

    if (
        operands.some(part => part.trim() === '') ||
        operators.length < 2
    ) {
        return input;
    }

    return operators
        .map((operator, index) => `${operands[index]}${operator}${operands[index + 1]}`)
        .join(' and ');
}

function normalizeAbsoluteValue(input) {
    let output = input;

    output = output.replace(/\\lvert/g, '|');
    output = output.replace(/\\rvert/g, '|');
    output = output.replace(/\\vert/g, '|');

    while (/\|([^|]+)\|/.test(output)) {
        output = output.replace(/\|([^|]+)\|/g, 'abs($1)');
    }

    return output;
}

function normalizeLimit(input) {
    return input.replace(
        /\\lim\s*_\s*\{\s*([a-zA-Z])\s*(?:\\to|\\rightarrow|\\longrightarrow|->|→)\s*([^{}]+?)\s*\}\s*(.+)$/g,
        (_, variable, point, expression) => {
            return `limit(${expression.trim()},${variable.trim()},${point.trim()})`;
        }
    );
}

function normalizeDerivative(input) {
    let output = input.replace(
        /\\frac\s*\{\s*(d|\\partial)\s*\^\s*(?:\((\d+)\)|(\d+))\s*\}\s*\{\s*\1\s*([a-zA-Z])\s*\^\s*(?:\((\d+)\)|(\d+))\s*\}\s*(.+)$/g,
        (match, _operator, numeratorOrderA, numeratorOrderB, variable, denominatorOrderA, denominatorOrderB, expression) => {
            const numeratorOrder = numeratorOrderA || numeratorOrderB;
            const denominatorOrder = denominatorOrderA || denominatorOrderB;

            if (numeratorOrder !== denominatorOrder) {
                return match;
            }

            return `diff(${expression.trim()},${variable.trim()},${numeratorOrder})`;
        }
    );

    output = output.replace(
        /\\frac\s*\{\s*(d|\\partial)\s*\}\s*\{\s*\1\s*([a-zA-Z])\s*\}\s*(.+)$/g,
        (_, _operator, variable, expression) => {
            return `diff(${expression.trim()},${variable.trim()})`;
        }
    );

    return output;
}

function normalizePrimeDerivative(input) {
    let output = input.replace(
        /([a-zA-Z])\s*\^\s*\{\s*\\prime\s*\\prime\s*\}\s*\(\s*([a-zA-Z])\s*\)/g,
        (_, functionName, variable) => {
            return `diff(${functionName}(${variable}),${variable},2)`;
        }
    );

    output = output.replace(
        /([a-zA-Z])\s*\^\s*\{\s*\\prime\s*\}\s*\(\s*([a-zA-Z])\s*\)/g,
        (_, functionName, variable) => {
            return `diff(${functionName}(${variable}),${variable})`;
        }
    );

    output = output.replace(
        /([a-zA-Z])''\s*\(\s*([a-zA-Z])\s*\)/g,
        (_, functionName, variable) => {
            return `diff(${functionName}(${variable}),${variable},2)`;
        }
    );

    output = output.replace(
        /([a-zA-Z])'\s*\(\s*([a-zA-Z])\s*\)/g,
        (_, functionName, variable) => {
            return `diff(${functionName}(${variable}),${variable})`;
        }
    );

    return output;
}

function normalizeIntegral(input) {
    let output = input.replace(
        /\\int\s*_\s*\{\s*([^{}]+?)\s*\}\s*\^\s*(?:\{\s*([^{}]+?)\s*\}|\(\s*([^()]+?)\s*\))\s+(.+?)\s+d\s*([a-zA-Z])\s*$/g,
        (_, lower, upperA, upperB, expression, variable) => {
            const upper = upperA || upperB;
            return `int(${expression.trim()},${variable.trim()},${lower.trim()},${upper.trim()})`;
        }
    );

    output = output.replace(
        /\\int\s+(.+?)\s+d\s*([a-zA-Z])\s*$/g,
        (_, expression, variable) => {
            return `int(${expression.trim()},${variable.trim()})`;
        }
    );

    return output;
}

function normalizeSumProduct(input) {
    return input.replace(
        /\\(sum|prod|pi)\s*_\s*\{\s*([a-zA-Z])\s*=\s*([^{}]+?)\s*\}\s*\^\s*(?:\{\s*([^{}]+?)\s*\}|\(\s*([^()]+?)\s*\))\s+(.+)$/g,
        (_, operator, variable, lower, upperA, upperB, expression) => {
            const functionName = operator === 'sum' ? 'sum' : 'product';
            const upper = upperA || upperB;

            return `${functionName}(${expression.trim()},${variable.trim()},${lower.trim()},${upper.trim()})`;
        }
    );
}

function normalizeLatexToStack(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    const piecewise = normalizeLatexPiecewise(input);

    if (piecewise) {
        return piecewise;
    }

    let s = extractMainMathExpression(input);

    // 0. 基础清理
    s = s.trim();

    // 去掉成对定界符命令，避免误伤 \rightarrow 这类箭头命令
    s = s.replace(/\\left(?![a-zA-Z])/g, '');
    s = s.replace(/\\right(?![a-zA-Z])/g, '');
    s = normalizeAbsoluteValue(s);

    // 修正 OCR 可能识别出的 LaTeX 命令空格，例如 \ frac -> \frac
    s = s.replace(/\\\s*frac/g, '\\frac');
    s = s.replace(/\\\s*sqrt/g, '\\sqrt');
    s = s.replace(/\\\s*sin/g, '\\sin');
    s = s.replace(/\\\s*cos/g, '\\cos');
    s = s.replace(/\\\s*tan/g, '\\tan');
    s = s.replace(/\\\s*arcsin/g, '\\arcsin');
    s = s.replace(/\\\s*arccos/g, '\\arccos');
    s = s.replace(/\\\s*arctan/g, '\\arctan');
    s = s.replace(/\\\s*log/g, '\\log');
    s = s.replace(/\\\s*ln/g, '\\ln');
    s = s.replace(/\\\s*lim/g, '\\lim');
    s = s.replace(/\\\s*partial/g, '\\partial');
    s = s.replace(/\\\s*int/g, '\\int');
    s = s.replace(/\\\s*sum/g, '\\sum');
    s = s.replace(/\\\s*prod/g, '\\prod');
    s = s.replace(/\\\s*vec/g, '\\vec');

    // 向量点积：\vec{u} \cdot \vec{v} -> u.v
    s = s.replace(
        /\\vec\s*\{\s*([a-zA-Z])\s*\}\s*\\cdot\s*\\vec\s*\{\s*([a-zA-Z])\s*\}/g,
        '$1.$2'
    );

    // 向量变量：\vec{a} -> a
    s = s.replace(/\\vec\s*\{\s*([a-zA-Z])\s*\}/g, '$1');

    // 乘号
    s = s.replace(/\\cdot/g, '*');
    s = s.replace(/\\times/g, '*');

    // 除号
    s = s.replace(/\\div/g, '/');
    s = s.replace(/÷/g, '/');

    // 关系符号
    s = s.replace(/\\geqslant/g, '>=');
    s = s.replace(/\\geq/g, '>=');
    s = s.replace(/\\leqslant/g, '<=');
    s = s.replace(/\\leq/g, '<=');
    s = s.replace(/≥/g, '>=');
    s = s.replace(/≤/g, '<=');
    s = s.replace(/\\neq/g, '#');
    s = s.replace(/\\ne/g, '#');

    // 正负号解集：x = \pm 1 -> [1,-1]
    s = s.replace(/[a-zA-Z]\s*=\s*\\pm\s*([A-Za-z0-9%.[\]\^()+\-*/]+)/g, '[$1,-$1]');
    s = s.replace(/[a-zA-Z]\s*=\s*±\s*([A-Za-z0-9%.[\]\^()+\-*/]+)/g, '[$1,-$1]');

    // 集合隶属：x \in \mathbb{R} -> x in R
    s = s.replace(/([a-zA-Z])\s*\\in\s*\\mathbb\s*\{\s*([A-Z])\s*\}/g, '__ALL__$1__IN__$2__');
    s = s.replace(/([a-zA-Z])\s*\\in\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/g, '__INTERVAL__$1__$2__$3__');
    s = s.replace(/([a-zA-Z])\s*∈\s*([A-Z])/g, '__ALL__$1__IN__$2__');
    s = s.replace(/([a-zA-Z])\s*∈\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/g, '__INTERVAL__$1__$2__$3__');
    s = s.replace(/\\mathbb\s*\{\s*([A-Z])\s*\}/g, '$1');

    // 无穷：STACK/Maxima 使用 inf / minf
    s = s.replace(/-\s*\\infty/g, 'minf');
    s = s.replace(/-\s*∞/g, 'minf');
    s = s.replace(/\\infty/g, 'inf');
    s = s.replace(/∞/g, 'inf');

    // prime 导数：f^{\prime}(x) -> diff(f(x),x)
    s = normalizePrimeDerivative(s);

    // 去掉 LaTeX 空白类命令
    s = s.replace(/\\,/g, '');
    s = s.replace(/\\!/g, '');
    s = s.replace(/\\;/g, '');
    s = s.replace(/\\:/g, '');
    s = s.replace(/\\ /g, '');

    // 1. 先处理幂：x^{2} -> x^(2)
    // 这样可以避免 \frac{x^{2}+1}{x+1} 因为嵌套花括号匹配失败
    s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');

    // 列向量：\binom{x}{y} -> matrix([x],[y])
    s = s.replace(/\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'matrix([$1],[$2])');

     // 2. 反三角函数
    // \arcsin{x} -> asin(x)
    s = s.replace(/\\arcsin\s*\{([^{}]+)\}/g, 'asin($1)');
    s = s.replace(/\\arccos\s*\{([^{}]+)\}/g, 'acos($1)');
    s = s.replace(/\\arctan\s*\{([^{}]+)\}/g, 'atan($1)');

    // \arcsin x -> asin(x)
    s = s.replace(/\\arcsin\s+([a-zA-Z0-9]+)/g, 'asin($1)');
    s = s.replace(/\\arccos\s+([a-zA-Z0-9]+)/g, 'acos($1)');
    s = s.replace(/\\arctan\s+([a-zA-Z0-9]+)/g, 'atan($1)');

    // \sin^{-1} \frac{x}{2} -> asin((x)/(2))
    // \tan^{-1} \frac{x}{2} -> atan((x)/(2))
    s = s.replace(/\\sin\s*\^\s*\(\s*-1\s*\)\s*\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'asin(($1)/($2))');
    s = s.replace(/\\cos\s*\^\s*\(\s*-1\s*\)\s*\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'acos(($1)/($2))');
    s = s.replace(/\\tan\s*\^\s*\(\s*-1\s*\)\s*\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'atan(($1)/($2))');

    // \sin^{-1} (x+1) -> asin(x+1)
    s = s.replace(/\\sin\s*\^\s*\(\s*-1\s*\)\s*\(([^()]+)\)/g, 'asin($1)');
    s = s.replace(/\\cos\s*\^\s*\(\s*-1\s*\)\s*\(([^()]+)\)/g, 'acos($1)');
    s = s.replace(/\\tan\s*\^\s*\(\s*-1\s*\)\s*\(([^()]+)\)/g, 'atan($1)');

    // \sin^{-1} x -> asin(x)
    s = s.replace(/\\sin\s*\^\s*\(\s*-1\s*\)\s*([a-zA-Z0-9]+)/g, 'asin($1)');
    s = s.replace(/\\cos\s*\^\s*\(\s*-1\s*\)\s*([a-zA-Z0-9]+)/g, 'acos($1)');
    s = s.replace(/\\tan\s*\^\s*\(\s*-1\s*\)\s*([a-zA-Z0-9]+)/g, 'atan($1)');

    // 兼容极少数还没变成 ^(-1) 的情况
    s = s.replace(/\\sin\s*\^\s*\{-1\}\s*\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'asin(($1)/($2))');
    s = s.replace(/\\cos\s*\^\s*\{-1\}\s*\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'acos(($1)/($2))');
    s = s.replace(/\\tan\s*\^\s*\{-1\}\s*\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'atan(($1)/($2))');

    s = s.replace(/\\sin\s*\^\s*\{-1\}\s*([a-zA-Z0-9]+)/g, 'asin($1)');
    s = s.replace(/\\cos\s*\^\s*\{-1\}\s*([a-zA-Z0-9]+)/g, 'acos($1)');
    s = s.replace(/\\tan\s*\^\s*\{-1\}\s*([a-zA-Z0-9]+)/g, 'atan($1)');

    // 3. 自然指数：e^(x), e^x -> %e^x
    s = s.replace(/e\^\(([^()]+)\)/g, '%e^($1)');
    s = s.replace(/e\^([a-zA-Z0-9]+)/g, '%e^$1');

    // 对数底数：\log_{2} x -> log(x)/log(2)
    s = s.replace(/\\log\s*_\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(log($2)/log($1))');
    s = s.replace(/\\log\s*_\s*\{([^{}]+)\}\s*([a-zA-Z0-9]+)/g, '(log($2)/log($1))');

    // 对数底数：\log_2 x -> log(x)/log(2)
    s = s.replace(/\\log\s*_\s*([a-zA-Z0-9]+)\s*\{([^{}]+)\}/g, '(log($2)/log($1))');
    s = s.replace(/\\log\s*_\s*([a-zA-Z0-9]+)\s*([a-zA-Z0-9]+)/g, '(log($2)/log($1))');

    // 4. 带次数的根式：\sqrt[3]{x} -> (x)^(1/3)
    while (/\\sqrt\s*\[([^\[\]]+)\]\s*\{([^{}]+)\}/.test(s)) {
        s = s.replace(/\\sqrt\s*\[([^\[\]]+)\]\s*\{([^{}]+)\}/g, '($2)^(1/$1)');
    }

    // 5. 普通根式：\sqrt{x} -> sqrt(x)
    while (/\\sqrt\s*\{([^{}]+)\}/.test(s)) {
        s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');
    }

    // 6. 普通三角函数和常用函数：\sin{x} -> sin(x)
    s = s.replace(/\\sin\s*\{([^{}]+)\}/g, 'sin($1)');
    s = s.replace(/\\cos\s*\{([^{}]+)\}/g, 'cos($1)');
    s = s.replace(/\\tan\s*\{([^{}]+)\}/g, 'tan($1)');
    s = s.replace(/\\log\s*\{([^{}]+)\}/g, 'log($1)');
    s = s.replace(/\\ln\s*\{([^{}]+)\}/g, 'ln($1)');

    // 兼容 \sin x, \cos x 这种无花括号形式
    s = s.replace(/\\sin\s+([a-zA-Z0-9]+)/g, 'sin($1)');
    s = s.replace(/\\cos\s+([a-zA-Z0-9]+)/g, 'cos($1)');
    s = s.replace(/\\tan\s+([a-zA-Z0-9]+)/g, 'tan($1)');
    s = s.replace(/\\log\s+([a-zA-Z0-9]+)/g, 'log($1)');
    s = s.replace(/\\ln\s+([a-zA-Z0-9]+)/g, 'ln($1)');

    // 7. 导数：\frac{d}{d x} x^2 -> diff(x^2,x)
    s = normalizeDerivative(s);

    // 8. 分式：\frac{x+1}{x-1} -> (x+1)/(x-1)
    while (/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(s)) {
        s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)');
    }

    // 9. 积分：\int x d x -> int(x,x)
    s = normalizeIntegral(s);

    // 10. 求和/乘积：\sum_{i=1}^{n} i -> sum(i,i,1,n)
    s = normalizeSumProduct(s);

    // 11. 极限：\lim_{x \rightarrow 0} expr -> limit(expr,x,0)
    s = normalizeLimit(s);
    s = s.replace(/\\rightarrow/g, '->');
    s = s.replace(/\\longrightarrow/g, '->');
    s = s.replace(/\\to/g, '->');

    // 12. 行列式：\operatorname{det} A / \det A -> determinant(A)
    s = s.replace(/\\operatorname\s*\{\s*det\s*\}\s*([a-zA-Z])\b/g, 'determinant($1)');
    s = s.replace(/\\det\s*([a-zA-Z])\b/g, 'determinant($1)');

    // 13. 数组/序列下标：x_{k} -> x[k]
    s = s.replace(/\b([a-zA-Z])_\{\s*([a-zA-Z0-9]+)\s*\}/g, '$1[$2]');

    // 14. 下标先简单处理
    s = s.replace(/_\{([^{}]+)\}/g, '_$1');

    // 9. unwrap text-like LaTeX wrappers before braces become parentheses
    s = s.replace(/\\text\s*\{\s*([^{}]+?)\s*\}/g, '$1');
    s = s.replace(/\\mathrm\s*\{\s*([^{}]+?)\s*\}/g, '$1');
    s = s.replace(/\\operatorname\s*\{\s*([^{}]+?)\s*\}/g, '$1');

    // 10. 花括号改圆括号
    s = s.replace(/\{/g, '(');
    s = s.replace(/\}/g, ')');

    // 11. 去掉剩余 LaTeX 命令斜杠
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');

    // 12. 空格乘法处理：必须放在压缩空格之前
    // a x -> a*x, b x -> b*x
    s = s.replace(/([a-zA-Z])\s+([a-zA-Z])/g, '$1*$2');

    // 2 x -> 2*x
    s = s.replace(/(\d)\s+([a-zA-Z])/g, '$1*$2');

    // x 2 这种不常见，暂时不处理，避免误伤

    // 压缩剩余空格
    s = s.replace(/\s+/g, '');

    // trim spaces inside
    s = s.replace(/\s+/g, ' ').trim();

    // constants
    s = s.replace(/\\pi\b/g, '%pi');
    s = s.replace(/π/g, '%pi');
    s = s.replace(/(^|[^A-Za-z0-9_])pi(?![A-Za-z0-9_])/g, '$1%pi');
    s = s.replace(/(\d)pi(?![A-Za-z0-9_])/g, '$1*%pi');

    s = s.replace(/(^|[^%A-Za-z0-9_])e(?![A-Za-z0-9_])/g, '$1%e');
    s = s.replace(/(^|[^%A-Za-z0-9_])i(?![A-Za-z0-9_])/g, '$1%i');

    // 12. 补全隐式乘法
    s = s.replace(/\)\(/g, ')*(');                 // (x+1)(x-1) -> (x+1)*(x-1)
    s = s.replace(/(\d)([a-zA-Z])/g, '$1*$2');     // 2x -> 2*x
    s = s.replace(/(\d)\(/g, '$1*(');              // 2(x+1) -> 2*(x+1)
    s = s.replace(/\)([a-zA-Z])/g, ')*$1');        // (x+1)y -> (x+1)*y
    s = s.replace(/\]([a-zA-Z(])/g, ']*$1');       // a[k]x -> a[k]*x, a[k](x+1) -> a[k]*(x+1)
    s = s.replace(/(^|[^%A-Za-z0-9_])e(?![A-Za-z0-9_])/g, '$1%e');
    s = s.replace(/(^|[^%A-Za-z0-9_])i(?![A-Za-z0-9_])/g, '$1%i');
    s = normalizeAbsoluteValue(s);

    // 常见多项式系数省略乘号：ax^2 -> a*x^2, bx -> b*x
    // 排除 x 本身，避免 xx 被乱改
    s = s.replace(/\b([a-df-zA-DF-Z])x(?=(\^|\+|\-|\*|\/|\)|$))/g, '$1*x');

    // 13. 函数白名单：避免把 sin(x), sqrt(x), exp(x), asin(x) 改成 sin*(x)
    s = s.replace(/([a-zA-Z]+)\(/g, (match, name) => {
        const functions = [
            'sin', 'cos', 'tan',
            'asin', 'acos', 'atan',
            'log', 'ln',
            'sqrt', 'exp',
            'abs',
            'limit',
            'diff',
            'int',
            'sum',
            'product',
            'matrix',
            'determinant'
        ];

        if (functions.includes(name)) {
            return match;
        }

        return name + '*(';
    });

    // 14. 美化分式
    // (1)/(2) -> 1/2
    s = s.replace(/\((\d+)\)\/\((\d+)\)/g, '$1/$2');

    // (1)/(x) -> 1/x, (x)/(2) -> x/2, (x)/(y) -> x/y
    s = s.replace(/\((\d+)\)\/\(([a-zA-Z])\)/g, '$1/$2');
    s = s.replace(/\(([a-zA-Z])\)\/\((\d+)\)/g, '$1/$2');
    s = s.replace(/\(([a-zA-Z])\)\/\(([a-zA-Z])\)/g, '$1/$2');
    s = s.replace(/\(([^()]+)\)\/\(([A-Za-z0-9%.[\]]+)\)/g, '($1)/$2');

    // (1)/(sqrt(x)) -> 1/sqrt(x)
    // (1)/(asin(x)) -> 1/asin(x)
    s = s.replace(
        /\((\d+)\)\/\((sqrt|sin|cos|tan|asin|acos|atan|log|ln|exp)\(([^()]+)\)\)/g,
        '$1/$2($3)'
    );

    // (abs(x))/(x) -> abs(x)/x, (x)/(abs(x)) -> x/abs(x)
    s = s.replace(
        /\((sqrt|sin|cos|tan|asin|acos|atan|log|ln|exp|abs)\(([^()]+)\)\)\/\(([a-zA-Z0-9%]+)\)/g,
        '$1($2)/$3'
    );
    s = s.replace(
        /\(([a-zA-Z0-9%]+)\)\/\((sqrt|sin|cos|tan|asin|acos|atan|log|ln|exp|abs)\(([^()]+)\)\)/g,
        '$1/$2($3)'
    );

    // (1)/(1+1/x) -> 1/(1+1/x)
    // 只处理分母内部没有额外括号的情况，比较安全
    s = s.replace(/\((\d+)\)\/\(([^()]+)\)/g, '$1/($2)');

    // 15. 美化指数
    // x^(2) -> x^2
    s = s.replace(/\^\((\d+)\)/g, '^$1');
    s = s.replace(/\^\(([a-zA-Z])\)/g, '^$1');
    s = s.replace(/%e\^\(([a-zA-Z0-9]+)\)/g, '%e^$1');

    // (x)^(1/3) -> x^(1/3)
    s = s.replace(/\(([a-zA-Z])\)\^\(1\/(\d+)\)/g, '$1^(1/$2)');

    // 16. 美化函数内部的简单分式：atan((x)/(2)) -> atan(x/2)
    s = s.replace(/\b(sin|cos|tan|asin|acos|atan|log|ln|sqrt|exp)\(\(([^()]+)\)\/\(([^()]+)\)\)/g, '$1($2/$3)');

    // 17. 美化整个对数换底公式外层括号：(log(x)/log(2)) -> log(x)/log(2)
    s = s.replace(/^\(log\(([^()]+)\)\/log\(([^()]+)\)\)$/g, 'log($1)/log($2)');

    // 18. 链式不等式：0<x<1 -> 0<x and x<1
    s = expandChainedInequality(s);

    // 19. 不等于：x#0 / x!=0 -> not(x=0)
    s = s.replace(
        /^([A-Za-z0-9%.[\]\^()+\-*/]+)(?:#|!=)([A-Za-z0-9%.[\]\^()+\-*/]+)$/g,
        'not($1=$2)'
    );

    // 20. 恢复 prime 导数里的函数调用：diff(f*(x),x) -> diff(f(x),x)
    s = s.replace(/\bdiff\(([a-zA-Z])\*\(([a-zA-Z])\),\2\)/g, 'diff($1($2),$2)');
    s = s.replace(/\bdiff\(([a-zA-Z])\*\(([a-zA-Z])\),\2,(\d+)\)/g, 'diff($1($2),$2,$3)');
    s = s.replace(/\bint\(([a-zA-Z])\*\(([a-zA-Z])\),\2\)/g, 'int($1($2),$2)');
    s = s.replace(/\bint\(([a-zA-Z])\*\(([a-zA-Z])\),\2,([^,]+),([^)]+)\)/g, 'int($1($2),$2,$3,$4)');
    s = s.replace(/^([a-zA-Z])\*\(([a-zA-Z])\)=/g, '$1($2)=');
    s = s.replace(/\b(sum|product)\(([^,]+),%i,([^,]+),([^)]+)\)/g, (_, functionName, expression, lower, upper) => {
        return `${functionName}(${expression.replace(/%i/g, 'i')},i,${lower},${upper})`;
    });
    s = s.replace(/\bfrac\*\(([^()]+)\)\*\(([^()]+)\)/g, '($1)/($2)');
    s = s.replace(/\(([a-zA-Z]\[[^\[\]()]+\])\)\/\(([a-zA-Z0-9]+)\)/g, '$1/$2');
    s = s.replace(/%e\^\(([a-zA-Z0-9]+)\)/g, '%e^$1');
    s = s.replace(/__ALL__([a-zA-Z])__IN__([A-Z])__/g, '$1 in $2');
    s = s.replace(/__INTERVAL__([a-zA-Z])__([^_]+)__([^_]+)__/g, '$2<=$1 and $1<=$3');
    s = s.replace(/=\(\s*([A-Za-z0-9%+\-*/^.[\]\s]+(?:,[A-Za-z0-9%+\-*/^.[\]\s]+)+)\s*\)/g, '=[$1]');
    s = s.replace(/^\(\s*([A-Za-z0-9%+\-*/^.[\]\s]+(?:,[A-Za-z0-9%+\-*/^.[\]\s]+)+)\s*\)$/g, '[$1]');

    return s.trim();
}

function createSessionId() {
    return crypto.randomBytes(8).toString('hex');
}

function getMobileUrl(sessionId) {
    return `http://${HOST_IP}:${PORT}/mobile/${sessionId}`;
}

app.get('/', (req, res) => {
    res.json({
        ok: true,
        message: 'Recognizer API is running'
    });
});

app.post('/session/create', (req, res) => {
    const sessionId = createSessionId();
    const now = Date.now();

    sessions.set(sessionId, {
        session_id: sessionId,
        status: 'waiting',
        created_at: now,
        expires_at: now + SESSION_TTL_MS,
        raw_latex: '',
        stack: '',
        text: ''
    });

    res.json({
        success: true,
        session_id: sessionId,
        mobile_url: getMobileUrl(sessionId),
        expires_at: now + SESSION_TTL_MS
    });
});

app.get('/session/:id/result', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    if (isSessionExpired(session) && session.status !== 'done') {
        markSessionExpired(session);

        return res.json({
            success: true,
            ready: false,
            expired: true,
            status: 'expired'
        });
    }

    if (session.status !== 'done') {
        return res.json({
            success: true,
            ready: false,
            expired: false,
            status: session.status
        });
    }

    return res.json({
        success: true,
        ready: true,
        expired: false,
        status: 'done',
        raw_latex: session.raw_latex,
        stack: session.stack,
        text: session.text
    });
});

app.post('/session/:id/result', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    if (isSessionExpired(session)) {
        markSessionExpired(session);

        return res.status(410).json({
            success: false,
            error: 'Session expired'
        });
    }

    const raw_latex = req.body.raw_latex || '';
    const stack = req.body.stack || '';
    const text = req.body.text || '';

    session.status = 'done';
    session.raw_latex = raw_latex;
    session.stack = stack;
    session.text = text;

    sessions.set(req.params.id, session);

    return res.json({
        success: true
    });
});

app.post('/recognize', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image uploaded'
            });
        }

        if (!MATHPIX_APP_ID || !MATHPIX_APP_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Missing Mathpix credentials'
            });
        }

        const imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });

        const mathpixResponse = await axios.post(
            'https://api.mathpix.com/v3/text',
            {
                src: `data:${req.file.mimetype};base64,${imageBase64}`,
                formats: ['text', 'latex_styled'],
                data_options: {
                    include_asciimath: true
                }
            },
            {
                headers: {
                    'app_id': MATHPIX_APP_ID,
                    'app_key': MATHPIX_APP_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = mathpixResponse.data || {};

        const rawLatex =
            data.latex_styled ||
            data.latex_normal ||
            data.text ||
            '';

        const text = data.text || '';
        const normalized = normalizeLatexToStack(rawLatex);
        const stack = normalized || text || '';

        fs.unlink(req.file.path, () => {});

        return res.json({
            success: true,
            raw_latex: rawLatex,
            text,
            normalized,
            stack
        });
    } catch (error) {
        console.error('recognize error:', error?.response?.data || error.message);

        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }

        return res.status(500).json({
            success: false,
            error: error?.response?.data || error.message || 'Recognition failed'
        });
    }
});

app.get('/mobile/:id', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {

        return res.status(404).send('<h1>Session not found</h1>');

    }

    if (isSessionExpired(session) && session.status !== 'done') {

        markSessionExpired(session);

        return res.status(410).send('<h1>Session expired</h1><p>Please return to the desktop and create a new session.</p>');

    }
    res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Mobile Math Upload</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: sans-serif; padding: 16px; max-width: 720px; margin: 0 auto; }
    button { padding: 10px 14px; margin-top: 10px; }
    textarea { width: 100%; box-sizing: border-box; margin-top: 8px; margin-bottom: 12px; }
    .box { border: 1px solid #ddd; padding: 12px; margin-top: 12px; background: #fafafa; }
  </style>
</head>
<body>
  <h2>Capture and Upload a Math Expression</h2>
  <p>Session: ${req.params.id}</p>

  <input id="file" type="file" accept="image/*" capture="environment" />
  <br />
  <button id="recognizeBtn">Recognizing...</button>

  <div class="box" id="resultBox" style="display:none;">
    <div><strong>OCR raw result:</strong></div>
    <textarea id="raw" rows="3" readonly></textarea>

    <div><strong>STACK result:</strong></div>
    <textarea id="stack" rows="3"></textarea>

    <button id="submitBtn">Submit to Desktop</button>
  </div>

  <script>
    const fileInput = document.getElementById('file');
    const recognizeBtn = document.getElementById('recognizeBtn');
    const resultBox = document.getElementById('resultBox');
    const rawEl = document.getElementById('raw');
    const stackEl = document.getElementById('stack');
    const submitBtn = document.getElementById('submitBtn');

    let latestResult = null;

    recognizeBtn.onclick = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        alert('Please select or take a photo of the image first');
        return;
      }

      const fd = new FormData();
      fd.append('image', file);

      try {
        recognizeBtn.disabled = true;
        recognizeBtn.textContent = 'Recognizing...';

        const resp = await fetch('/recognize', {
          method: 'POST',
          body: fd
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Recognition failed');
        }

        latestResult = data;
        rawEl.value = data.raw_latex || '';
        stackEl.value = data.stack || data.normalized || data.text || '';
        resultBox.style.display = 'block';
      } catch (e) {
        alert('Recognition failed: ' + e.message);
      } finally {
        recognizeBtn.disabled = false;
        recognizeBtn.textContent = 'Recognize';
      }
    };

    submitBtn.onclick = async () => {
      try {
        const body = {
          raw_latex: rawEl.value || '',
          stack: stackEl.value || '',
          text: latestResult?.text || ''
        };

        const resp = await fetch('/session/${req.params.id}/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Submit failed');
        }

        alert('Successfully submitted to desktop, please go back to the desktop to view.');
      } catch (e) {
        alert('Submit failed: ' + e.message);
      }
    };
  </script>
</body>
</html>
    `);
});

setInterval(() => {
    const now = Date.now();

    for (const [sessionId, session] of sessions.entries()) {
        const tooOldDoneSession =
            session.status === 'done' && now - session.created_at > 30 * 60 * 1000;

        const expiredWaitingSession =
            session.status !== 'done' && now > session.expires_at;

        if (expiredWaitingSession) {
            session.status = 'expired';
        }

        if (tooOldDoneSession || expiredWaitingSession) {
            sessions.delete(sessionId);
        }
    }
}, 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Recognizer API listening on http://0.0.0.0:${PORT}`);
    console.log(`Mobile access base URL: http://${HOST_IP}:${PORT}`);
});
