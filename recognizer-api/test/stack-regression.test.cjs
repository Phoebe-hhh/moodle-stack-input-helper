const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function loadNormalizeLatexToStack() {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const source = fs.readFileSync(serverPath, 'utf8');
    const start = source.indexOf('function normalizeLatexMatrix');
    const normalizeStart = source.indexOf('function normalizeLatexToStack');
    const end = source.indexOf('function createSessionId');

    if (start === -1 || normalizeStart === -1 || end === -1) {
        throw new Error('Could not locate normalization functions in server.js');
    }

    return Function(
        source.slice(start, normalizeStart) +
        source.slice(normalizeStart, end) +
        '\nreturn normalizeLatexToStack;'
    )();
}

const normalizeLatexToStack = loadNormalizeLatexToStack();

const cases = [
    {
        group: 'constants',
        items: [
            [String.raw`\text { e }`, '%e'],
            [String.raw`\text { i }`, '%i'],
            [String.raw`2 \pi`, '2*%pi']
        ]
    },
    {
        group: 'relations and sets',
        items: [
            [String.raw`x \geqslant 0`, 'x>=0'],
            ['0≤x≤1', '0<=x and x<=1'],
            [String.raw`x \neq 0`, 'not(x=0)'],
            [String.raw`x \in \mathbb{R}`, 'x in R'],
            [String.raw`x \in [0,1]`, '0<=x and x<=1'],
            ['x ∈ [-1,1]', '-1<=x and x<=1'],
            [String.raw`x=\pm 1`, '[1,-1]'],
            ['x=±a', '[a,-a]']
        ]
    },
    {
        group: 'absolute values',
        items: [
            [String.raw`|x|`, 'abs(x)'],
            [String.raw`\frac{|x|}{x}`, 'abs(x)/x'],
            ['f(x)=|x|', 'f(x)=abs(x)']
        ]
    },
    {
        group: 'limits',
        items: [
            [String.raw`\lim _{x \rightarrow 0} \frac{\sin x}{x}`, 'limit(sin(x)/x,x,0)'],
            [String.raw`\lim _{x \rightarrow \infty} \frac{1}{x}`, 'limit(1/x,x,inf)'],
            [String.raw`\lim _{x \rightarrow 0} \frac{\sin x}{x}+1`, 'limit(sin(x)/x+1,x,0)']
        ]
    },
    {
        group: 'derivatives',
        items: [
            [String.raw`\frac{d}{d x} x^{2}`, 'diff(x^2,x)'],
            [String.raw`\frac{d^{2}}{d x^{2}} x^{3}`, 'diff(x^3,x,2)'],
            [String.raw`\frac{d}{d x} e^{x}`, 'diff(%e^x,x)'],
            [String.raw`\frac{d}{d x} \sin x`, 'diff(sin(x),x)'],
            [String.raw`f^{\prime}(x)`, 'diff(f(x),x)']
        ]
    },
    {
        group: 'integrals',
        items: [
            [String.raw`\int x d x`, 'int(x,x)'],
            [String.raw`\int_{0}^{1} x^{2} d x`, 'int(x^2,x,0,1)'],
            [String.raw`\int_{a}^{b} f(x) d x`, 'int(f(x),x,a,b)'],
            [String.raw`\int_{-1}^{1} |x| d x`, 'int(abs(x),x,-1,1)']
        ]
    },
    {
        group: 'sums and products',
        items: [
            [String.raw`\sum_{i=1}^{n} i`, 'sum(i,i,1,n)'],
            [String.raw`\sum_{k=0}^{n} x^{k}`, 'sum(x^k,k,0,n)'],
            [String.raw`\sum_{k=1}^{n} \frac{x_{k}}{k}`, 'sum(x[k]/k,k,1,n)'],
            [String.raw`\sum_{k=0}^{n} e^{x_{k}}`, 'sum(%e^(x[k]),k,0,n)'],
            [String.raw`\prod_{i=1}^{n} i`, 'product(i,i,1,n)'],
            [String.raw`\prod_{k=1}^{n} x_{k}`, 'product(x[k],k,1,n)'],
            [String.raw`\prod_{k=1}^{n} \frac{k+1}{k}`, 'product((k+1)/k,k,1,n)']
        ]
    },
    {
        group: 'vectors and matrices',
        items: [
            ['(1,2)', '[1,2]'],
            [String.raw`\vec{a}=(1,2)`, 'a=[1,2]'],
            [String.raw`\vec{u} \cdot \vec{v}`, 'u.v'],
            [String.raw`\binom{x}{y}`, 'matrix([x],[y])'],
            [String.raw`\left(\begin{array}{ll}1 & 2 \\ 3 & 4\end{array}\right)`, 'matrix([1,2],[3,4])'],
            [String.raw`\left(\begin{array}{cc}x & y \\ a & b\end{array}\right)`, 'matrix([x,y],[a,b])'],
            [String.raw`\operatorname{det} A`, 'determinant(A)']
        ]
    },
    {
        group: 'piecewise',
        items: [
            [
                String.raw`f(x)=\left\{\begin{array}{ll}x, & x \geqslant 0 \\ -x, & x<0\end{array}\right.`,
                'if x>=0 then x else -x'
            ],
            [
                String.raw`f(x)=\left\{\begin{array}{ll}0, & x<0 \\ x, & 0\leq x\leq 1 \\ 1, & x>1\end{array}\right.`,
                'if x<0 then 0 else if 0<=x and x<=1 then x else 1'
            ]
        ]
    }
];

for (const { group, items } of cases) {
    test(group, () => {
        for (const [input, expected] of items) {
            assert.equal(normalizeLatexToStack(input), expected, input);
        }
    });
}

