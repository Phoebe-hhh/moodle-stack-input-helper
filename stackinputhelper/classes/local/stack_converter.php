<?php
namespace local_stackinputhelper\local;

defined('MOODLE_INTERNAL') || die();

final class stack_converter {
    public static function normalize(string $input): string {
        $s = trim($input);

        if ($s === '') {
            return '';
        }

        $piecewise = self::normalize_piecewise($s);
        if ($piecewise !== '') {
            return $piecewise;
        }

        $matrix = self::normalize_matrix($s);
        if ($matrix !== '') {
            return $matrix;
        }

        $s = preg_replace('/\\\\left(?![a-zA-Z])/', '', $s);
        $s = preg_replace('/\\\\right(?![a-zA-Z])/', '', $s);
        $s = self::normalize_absolute($s);

        $commands = ['frac', 'sqrt', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
            'log', 'ln', 'lim', 'partial', 'int', 'sum', 'prod', 'vec'];
        foreach ($commands as $command) {
            $s = preg_replace('/\\\\\s*' . preg_quote($command, '/') . '/', '\\' . $command, $s);
        }

        $s = preg_replace('/\\\\vec\s*\{\s*([a-zA-Z])\s*\}\s*\\\\cdot\s*\\\\vec\s*\{\s*([a-zA-Z])\s*\}/', '$1.$2', $s);
        $s = preg_replace('/\\\\vec\s*\{\s*([a-zA-Z])\s*\}/', '$1', $s);

        $s = str_replace(['\\cdot', '\\times', '\\div', '÷'], ['*', '*', '/', '/'], $s);
        $s = str_replace(['\\geqslant', '\\geq', '≥'], '>=', $s);
        $s = str_replace(['\\leqslant', '\\leq', '≤'], '<=', $s);
        $s = str_replace(['\\neq', '\\ne'], '#', $s);

        $s = preg_replace('/[a-zA-Z]\s*=\s*\\\\pm\s*([A-Za-z0-9%.\[\]\^()+\-*\/]+)/', '[$1,-$1]', $s);
        $s = preg_replace('/[a-zA-Z]\s*=\s*±\s*([A-Za-z0-9%.\[\]\^()+\-*\/]+)/u', '[$1,-$1]', $s);

        $s = preg_replace('/([a-zA-Z])\s*\\\\in\s*\\\\mathbb\s*\{\s*([A-Z])\s*\}/', '__ALL__$1__IN__$2__', $s);
        $s = preg_replace('/([a-zA-Z])\s*\\\\in\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/', '__INTERVAL__$1__$2__$3__', $s);
        $s = preg_replace('/([a-zA-Z])\s*∈\s*([A-Z])/u', '__ALL__$1__IN__$2__', $s);
        $s = preg_replace('/([a-zA-Z])\s*∈\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]/u', '__INTERVAL__$1__$2__$3__', $s);
        $s = preg_replace('/\\\\mathbb\s*\{\s*([A-Z])\s*\}/', '$1', $s);

        $s = preg_replace('/-\s*\\\\infty/', 'minf', $s);
        $s = preg_replace('/-\s*∞/u', 'minf', $s);
        $s = str_replace(['\\infty', '∞'], 'inf', $s);

        $s = self::normalize_prime_derivative($s);
        $s = str_replace(['\\,', '\\!', '\\;', '\\:', '\\ '], '', $s);
        $s = preg_replace('/\^\{([^{}]+)\}/', '^($1)', $s);

        $s = preg_replace('/\\\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/', 'matrix([$1],[$2])', $s);

        $s = self::normalize_inverse_trig($s);
        $s = preg_replace('/e\^\(([^()]+)\)/', '%e^($1)', $s);
        $s = preg_replace('/e\^([a-zA-Z0-9]+)/', '%e^$1', $s);

        $s = preg_replace('/\\\\log\s*_\s*\{([^{}]+)\}\s*\{([^{}]+)\}/', '(log($2)/log($1))', $s);
        $s = preg_replace('/\\\\log\s*_\s*\{([^{}]+)\}\s*([a-zA-Z0-9]+)/', '(log($2)/log($1))', $s);
        $s = preg_replace('/\\\\log\s*_\s*([a-zA-Z0-9]+)\s*\{([^{}]+)\}/', '(log($2)/log($1))', $s);
        $s = preg_replace('/\\\\log\s*_\s*([a-zA-Z0-9]+)\s*([a-zA-Z0-9]+)/', '(log($2)/log($1))', $s);

        while (preg_match('/\\\\sqrt\s*\[([^\[\]]+)\]\s*\{([^{}]+)\}/', $s)) {
            $s = preg_replace('/\\\\sqrt\s*\[([^\[\]]+)\]\s*\{([^{}]+)\}/', '($2)^(1/$1)', $s);
        }
        while (preg_match('/\\\\sqrt\s*\{([^{}]+)\}/', $s)) {
            $s = preg_replace('/\\\\sqrt\s*\{([^{}]+)\}/', 'sqrt($1)', $s);
        }

        foreach (['sin', 'cos', 'tan', 'log', 'ln'] as $fn) {
            $s = preg_replace('/\\\\' . $fn . '\s*\{([^{}]+)\}/', $fn . '($1)', $s);
            $s = preg_replace('/\\\\' . $fn . '\s+([a-zA-Z0-9]+)/', $fn . '($1)', $s);
        }

        $s = self::normalize_derivative($s);
        while (preg_match('/\\\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/', $s)) {
            $s = preg_replace('/\\\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/', '($1)/($2)', $s);
        }
        $s = self::normalize_integral($s);
        $s = self::normalize_sum_product($s);
        $s = self::normalize_limit($s);
        $s = str_replace(['\\rightarrow', '\\longrightarrow', '\\to'], '->', $s);

        $s = preg_replace('/\\\\operatorname\s*\{\s*det\s*\}\s*([a-zA-Z])\b/', 'determinant($1)', $s);
        $s = preg_replace('/\\\\det\s*([a-zA-Z])\b/', 'determinant($1)', $s);

        $s = preg_replace('/\b([a-zA-Z])_\{\s*([a-zA-Z0-9]+)\s*\}/', '$1[$2]', $s);
        $s = preg_replace('/_\{([^{}]+)\}/', '_$1', $s);

        $s = preg_replace('/\\\\text\s*\{\s*([^{}]+?)\s*\}/', '$1', $s);
        $s = preg_replace('/\\\\mathrm\s*\{\s*([^{}]+?)\s*\}/', '$1', $s);
        $s = preg_replace('/\\\\operatorname\s*\{\s*([^{}]+?)\s*\}/', '$1', $s);
        $s = str_replace(['{', '}'], ['(', ')'], $s);
        $s = preg_replace('/\\\\([a-zA-Z]+)/', '$1', $s);

        $s = preg_replace('/([a-zA-Z])\s+([a-zA-Z])/', '$1*$2', $s);
        $s = preg_replace('/(\d)\s+([a-zA-Z])/', '$1*$2', $s);
        $s = preg_replace('/\s+/', '', $s);

        $s = preg_replace('/\\\\pi\b/', '%pi', $s);
        $s = str_replace('π', '%pi', $s);
        $s = preg_replace('/(^|[^A-Za-z0-9_])pi(?![A-Za-z0-9_])/', '$1%pi', $s);
        $s = preg_replace('/(\d)pi(?![A-Za-z0-9_])/', '$1*%pi', $s);
        $s = preg_replace('/(^|[^%A-Za-z0-9_])e(?![A-Za-z0-9_])/', '$1%e', $s);
        $s = preg_replace('/(^|[^%A-Za-z0-9_])i(?![A-Za-z0-9_])/', '$1%i', $s);

        $s = str_replace(')(', ')*(', $s);
        $s = preg_replace('/(\d)([a-zA-Z])/', '$1*$2', $s);
        $s = preg_replace('/(\d)\(/', '$1*(', $s);
        $s = preg_replace('/\)([a-zA-Z])/', ')*$1', $s);
        $s = preg_replace('/\]([a-zA-Z(])/', ']*$1', $s);
        $s = preg_replace('/(^|[^%A-Za-z0-9_])e(?![A-Za-z0-9_])/', '$1%e', $s);
        $s = preg_replace('/(^|[^%A-Za-z0-9_])i(?![A-Za-z0-9_])/', '$1%i', $s);
        $s = self::normalize_absolute($s);
        $s = preg_replace('/\b([a-df-zA-DF-Z])x(?=(\^|\+|\-|\*|\/|\)|$))/', '$1*x', $s);
        $s = self::protect_functions($s);
        $s = self::beautify($s);

        return trim($s);
    }

    private static function normalize_matrix(string $input): string {
        if (!preg_match('/\\\\begin\{(?:array|pmatrix|bmatrix|matrix)\}(?:\{[^}]*\})?([\s\S]*?)\\\\end\{(?:array|pmatrix|bmatrix|matrix)\}/', $input, $match)) {
            return '';
        }

        $rows = [];
        foreach (preg_split('/\\\\\\\\/', trim($match[1])) as $row) {
            $row = trim($row);
            if ($row === '') {
                continue;
            }
            $columns = array_values(array_filter(array_map('trim', explode('&', $row)), static function($value) {
                return $value !== '';
            }));
            $rows[] = '[' . implode(',', $columns) . ']';
        }

        return $rows ? 'matrix(' . implode(',', $rows) . ')' : '';
    }

    private static function normalize_piecewise(string $input): string {
        if (!preg_match('/\\\\begin\{(cases|array)\}(?:\{[^}]*\})?([\s\S]*?)\\\\end\{\1\}/', $input, $match)) {
            return '';
        }

        $branches = [];
        foreach (preg_split('/\\\\\\\\/', trim($match[2])) as $row) {
            $row = trim($row);
            if ($row === '') {
                continue;
            }
            $parts = explode('&', $row);
            $expression = trim(preg_replace('/[,\s]+$/', '', array_shift($parts)));
            $condition = trim(implode('&', $parts));
            if ($expression !== '') {
                $branches[] = [
                    'expression' => self::normalize($expression),
                    'condition' => $condition === '' ? '' : self::normalize($condition),
                ];
            }
        }

        if (!$branches) {
            return '';
        }

        if ($match[1] === 'array') {
            $hascondition = false;
            foreach ($branches as $branch) {
                if (preg_match('/(<=|>=|<|>|\\\\leq|\\\\geq|\\\\leqslant|\\\\geqslant)/', $branch['condition'])) {
                    $hascondition = true;
                    break;
                }
            }
            if (!$hascondition) {
                return '';
            }
        }

        $result = $branches[count($branches) - 1]['expression'];
        for ($i = count($branches) - 2; $i >= 0; $i--) {
            if ($branches[$i]['condition'] === '') {
                $result = $branches[$i]['expression'];
                continue;
            }
            $result = 'if ' . $branches[$i]['condition'] . ' then ' . $branches[$i]['expression'] . ' else ' . $result;
        }

        return $result;
    }

    private static function normalize_absolute(string $input): string {
        $output = str_replace(['\\lvert', '\\rvert', '\\vert'], '|', $input);
        while (preg_match('/\|([^|]+)\|/', $output)) {
            $output = preg_replace('/\|([^|]+)\|/', 'abs($1)', $output);
        }
        return $output;
    }

    private static function normalize_limit(string $input): string {
        return preg_replace_callback(
            '/\\\\lim\s*_\s*\{\s*([a-zA-Z])\s*(?:\\\\to|\\\\rightarrow|\\\\longrightarrow|->|→)\s*([^{}]+?)\s*\}\s*(.+)$/u',
            static function($m) {
                return 'limit(' . trim($m[3]) . ',' . trim($m[1]) . ',' . trim($m[2]) . ')';
            },
            $input
        );
    }

    private static function normalize_derivative(string $input): string {
        $output = preg_replace_callback(
            '/\\\\frac\s*\{\s*(d|\\\\partial)\s*\^\s*(?:\((\d+)\)|(\d+))\s*\}\s*\{\s*\1\s*([a-zA-Z])\s*\^\s*(?:\((\d+)\)|(\d+))\s*\}\s*(.+)$/',
            static function($m) {
                $num = $m[2] ?: $m[3];
                $den = $m[5] ?: $m[6];
                return $num === $den ? 'diff(' . trim($m[7]) . ',' . trim($m[4]) . ',' . $num . ')' : $m[0];
            },
            $input
        );

        return preg_replace_callback(
            '/\\\\frac\s*\{\s*(d|\\\\partial)\s*\}\s*\{\s*\1\s*([a-zA-Z])\s*\}\s*(.+)$/',
            static function($m) {
                return 'diff(' . trim($m[3]) . ',' . trim($m[2]) . ')';
            },
            $output
        );
    }

    private static function normalize_prime_derivative(string $input): string {
        $output = preg_replace('/([a-zA-Z])\s*\^\s*\{\s*\\\\prime\s*\\\\prime\s*\}\s*\(\s*([a-zA-Z])\s*\)/', 'diff($1($2),$2,2)', $input);
        $output = preg_replace('/([a-zA-Z])\s*\^\s*\{\s*\\\\prime\s*\}\s*\(\s*([a-zA-Z])\s*\)/', 'diff($1($2),$2)', $output);
        $output = preg_replace('/([a-zA-Z])\'\'\s*\(\s*([a-zA-Z])\s*\)/', 'diff($1($2),$2,2)', $output);
        return preg_replace('/([a-zA-Z])\'\s*\(\s*([a-zA-Z])\s*\)/', 'diff($1($2),$2)', $output);
    }

    private static function normalize_integral(string $input): string {
        $output = preg_replace_callback(
            '/\\\\int\s*_\s*\{\s*([^{}]+?)\s*\}\s*\^\s*(?:\{\s*([^{}]+?)\s*\}|\(\s*([^()]+?)\s*\))\s+(.+?)\s+d\s*([a-zA-Z])\s*$/',
            static function($m) {
                $upper = $m[2] ?: $m[3];
                return 'int(' . trim($m[4]) . ',' . trim($m[5]) . ',' . trim($m[1]) . ',' . trim($upper) . ')';
            },
            $input
        );

        return preg_replace_callback(
            '/\\\\int\s+(.+?)\s+d\s*([a-zA-Z])\s*$/',
            static function($m) {
                return 'int(' . trim($m[1]) . ',' . trim($m[2]) . ')';
            },
            $output
        );
    }

    private static function normalize_sum_product(string $input): string {
        return preg_replace_callback(
            '/\\\\(sum|prod|pi)\s*_\s*\{\s*([a-zA-Z])\s*=\s*([^{}]+?)\s*\}\s*\^\s*(?:\{\s*([^{}]+?)\s*\}|\(\s*([^()]+?)\s*\))\s+(.+)$/',
            static function($m) {
                $name = $m[1] === 'sum' ? 'sum' : 'product';
                $upper = $m[4] ?: $m[5];
                return $name . '(' . trim($m[6]) . ',' . trim($m[2]) . ',' . trim($m[3]) . ',' . trim($upper) . ')';
            },
            $input
        );
    }

    private static function normalize_inverse_trig(string $input): string {
        $s = $input;
        foreach (['arcsin' => 'asin', 'arccos' => 'acos', 'arctan' => 'atan'] as $latex => $stack) {
            $s = preg_replace('/\\\\' . $latex . '\s*\{([^{}]+)\}/', $stack . '($1)', $s);
            $s = preg_replace('/\\\\' . $latex . '\s+([a-zA-Z0-9]+)/', $stack . '($1)', $s);
        }
        foreach (['sin' => 'asin', 'cos' => 'acos', 'tan' => 'atan'] as $latex => $stack) {
            $s = preg_replace('/\\\\' . $latex . '\s*\^\s*\(\s*-1\s*\)\s*\\\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/', $stack . '(($1)/($2))', $s);
            $s = preg_replace('/\\\\' . $latex . '\s*\^\s*\(\s*-1\s*\)\s*\(([^()]+)\)/', $stack . '($1)', $s);
            $s = preg_replace('/\\\\' . $latex . '\s*\^\s*\(\s*-1\s*\)\s*([a-zA-Z0-9]+)/', $stack . '($1)', $s);
        }
        return $s;
    }

    private static function expand_chained_inequality(string $input): string {
        if ($input === '' || preg_match('/\band\b/', $input)) {
            return $input;
        }

        $parts = preg_split('/(<=|>=|<|>)/', $input, -1, PREG_SPLIT_DELIM_CAPTURE);
        if (count($parts) < 5 || count($parts) % 2 === 0) {
            return $input;
        }

        $clauses = [];
        for ($i = 1; $i < count($parts); $i += 2) {
            if (trim($parts[$i - 1]) === '' || trim($parts[$i + 1]) === '') {
                return $input;
            }
            $clauses[] = $parts[$i - 1] . $parts[$i] . $parts[$i + 1];
        }

        return implode(' and ', $clauses);
    }

    private static function protect_functions(string $input): string {
        $functions = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'exp',
            'abs', 'limit', 'diff', 'int', 'sum', 'product', 'matrix', 'determinant'];

        return preg_replace_callback('/([a-zA-Z]+)\(/', static function($m) use ($functions) {
            return in_array($m[1], $functions, true) ? $m[0] : $m[1] . '*(';
        }, $input);
    }

    private static function beautify(string $input): string {
        $s = $input;
        $s = preg_replace('/\((\d+)\)\/\((\d+)\)/', '$1/$2', $s);
        $s = preg_replace('/\((\d+)\)\/\(([a-zA-Z])\)/', '$1/$2', $s);
        $s = preg_replace('/\(([a-zA-Z])\)\/\((\d+)\)/', '$1/$2', $s);
        $s = preg_replace('/\(([a-zA-Z])\)\/\(([a-zA-Z])\)/', '$1/$2', $s);
        $s = preg_replace('/\(([^()]+)\)\/\(([A-Za-z0-9%.\[\]]+)\)/', '($1)/$2', $s);
        $s = preg_replace('/\((\d+)\)\/\((sqrt|sin|cos|tan|asin|acos|atan|log|ln|exp)\(([^()]+)\)\)/', '$1/$2($3)', $s);
        $s = preg_replace('/\((sqrt|sin|cos|tan|asin|acos|atan|log|ln|exp|abs)\(([^()]+)\)\)\/\(([a-zA-Z0-9%]+)\)/', '$1($2)/$3', $s);
        $s = preg_replace('/\((\d+)\)\/\(([^()]+)\)/', '$1/($2)', $s);
        $s = preg_replace('/\^\((\d+)\)/', '^$1', $s);
        $s = preg_replace('/\^\(([a-zA-Z])\)/', '^$1', $s);
        $s = preg_replace('/%e\^\(([a-zA-Z0-9]+)\)/', '%e^$1', $s);
        $s = preg_replace('/\(([a-zA-Z])\)\^\(1\/(\d+)\)/', '$1^(1/$2)', $s);
        $s = preg_replace('/\b(sin|cos|tan|asin|acos|atan|log|ln|sqrt|exp)\(\(([^()]+)\)\/\(([^()]+)\)\)/', '$1($2/$3)', $s);
        $s = preg_replace('/^\(log\(([^()]+)\)\/log\(([^()]+)\)\)$/', 'log($1)/log($2)', $s);
        $s = self::expand_chained_inequality($s);
        $s = preg_replace('/^([A-Za-z0-9%.\[\]\^()+\-*\/]+)(?:#|!=)([A-Za-z0-9%.\[\]\^()+\-*\/]+)$/', 'not($1=$2)', $s);
        $s = preg_replace('/\bdiff\(([a-zA-Z])\*\(([a-zA-Z])\),\2\)/', 'diff($1($2),$2)', $s);
        $s = preg_replace('/\bdiff\(([a-zA-Z])\*\(([a-zA-Z])\),\2,(\d+)\)/', 'diff($1($2),$2,$3)', $s);
        $s = preg_replace('/\bint\(([a-zA-Z])\*\(([a-zA-Z])\),\2\)/', 'int($1($2),$2)', $s);
        $s = preg_replace('/\bint\(([a-zA-Z])\*\(([a-zA-Z])\),\2,([^,]+),([^)]+)\)/', 'int($1($2),$2,$3,$4)', $s);
        $s = preg_replace('/^([a-zA-Z])\*\(([a-zA-Z])\)=/', '$1($2)=', $s);
        $s = preg_replace_callback('/\b(sum|product)\(([^,]+),%i,([^,]+),([^)]+)\)/', static function($m) {
            return $m[1] . '(' . str_replace('%i', 'i', $m[2]) . ',i,' . $m[3] . ',' . $m[4] . ')';
        }, $s);
        $s = preg_replace('/\bfrac\*\(([^()]+)\)\*\(([^()]+)\)/', '($1)/($2)', $s);
        $s = preg_replace('/\(([a-zA-Z]\[[^\[\]()]+\])\)\/\(([a-zA-Z0-9]+)\)/', '$1/$2', $s);
        $s = preg_replace('/%e\^\(([a-zA-Z0-9]+)\)/', '%e^$1', $s);
        $s = preg_replace('/__ALL__([a-zA-Z])__IN__([A-Z])__/', '$1 in $2', $s);
        $s = preg_replace('/__INTERVAL__([a-zA-Z])__([^_]+)__([^_]+)__/', '$2<=$1 and $1<=$3', $s);
        $s = preg_replace('/=\(\s*([A-Za-z0-9%+\-*\/^.\[\]\s]+(?:,[A-Za-z0-9%+\-*\/^.\[\]\s]+)+)\s*\)/', '=[$1]', $s);
        $s = preg_replace('/^\(\s*([A-Za-z0-9%+\-*\/^.\[\]\s]+(?:,[A-Za-z0-9%+\-*\/^.\[\]\s]+)+)\s*\)$/', '[$1]', $s);
        return $s;
    }
}
