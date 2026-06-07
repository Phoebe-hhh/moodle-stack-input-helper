<?php
namespace local_stackinputhelper\local;

defined('MOODLE_INTERNAL') || die();

final class mathpix_client {
    private const ENDPOINT = 'https://api.mathpix.com/v3/text';

    public static function recognize(string $filepath, string $filename, string $mimetype): array {
        $appid = trim((string)get_config('local_stackinputhelper', 'mathpixappid'));
        $appkey = trim((string)get_config('local_stackinputhelper', 'mathpixappkey'));

        if ($appid === '' || $appkey === '') {
            throw new \moodle_exception('missingmathpixcredentials', 'local_stackinputhelper');
        }

        if (!is_readable($filepath)) {
            throw new \moodle_exception('invaliduploadedfile', 'local_stackinputhelper');
        }

        if (!function_exists('curl_init')) {
            throw new \moodle_exception('curlrequired', 'local_stackinputhelper');
        }

        $options = [
            'math_inline_delimiters' => ['$', '$'],
            'rm_spaces' => true,
            'formats' => ['text', 'latex_styled'],
        ];

        $postfields = [
            'file' => new \CURLFile($filepath, $mimetype, $filename),
            'options_json' => json_encode($options),
        ];

        $curl = curl_init(self::ENDPOINT);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'app_id: ' . $appid,
                'app_key: ' . $appkey,
            ],
            CURLOPT_POSTFIELDS => $postfields,
            CURLOPT_TIMEOUT => 40,
        ]);

        $body = curl_exec($curl);
        $errno = curl_errno($curl);
        $error = curl_error($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        if ($body === false || $errno !== 0) {
            throw new \moodle_exception('mathpixrequestfailed', 'local_stackinputhelper', '', null, $error);
        }

        $data = json_decode($body, true);
        if (!is_array($data)) {
            throw new \moodle_exception('mathpixinvalidresponse', 'local_stackinputhelper');
        }

        if ($status < 200 || $status >= 300) {
            $message = $data['error'] ?? $data['message'] ?? ('HTTP ' . $status);
            throw new \moodle_exception('mathpixrequestfailed', 'local_stackinputhelper', '', null, $message);
        }

        $rawlatex = self::extract_latex($data);
        $lines = self::build_lines($rawlatex);
        $stack = '';
        foreach ($lines as $line) {
            if ($line['stack'] !== '') {
                $stack = $line['stack'];
            }
        }
        if ($stack === '') {
            $stack = stack_converter::normalize_selection($rawlatex);
        }

        return [
            'raw_latex' => $rawlatex,
            'stack' => $stack,
            'text' => $stack,
            'lines' => $lines,
            'mathpix' => $data,
        ];
    }

    public static function build_lines(string $latex): array {
        $latex = trim($latex);
        if ($latex === '') {
            return [];
        }

        $normalized = str_replace(["\r\n", "\r"], "\n", $latex);
        $normalized = preg_replace('/^\$\s*/', '', $normalized);
        $normalized = preg_replace('/\s*\$$/', '', $normalized);
        $normalized = preg_replace('/^\\\\\[\s*/', '', $normalized);
        $normalized = preg_replace('/\s*\\\\\]$/', '', $normalized);

        $multiline = self::extract_multiline_body($normalized);
        if ($multiline !== null) {
            $parts = preg_split('/(?:\n+|\\\\\\\\+)/', $multiline);
        } else if (preg_match('/\\\\begin\{(?:cases|pmatrix|bmatrix|matrix)\}/', $normalized)) {
            $parts = [$normalized];
        } else {
            $parts = preg_split('/(?:\n+|\\\\\\\\+)/', $normalized);
        }

        $lines = [];
        foreach ($parts as $part) {
            $part = self::clean_line_latex($part);
            if ($part === '') {
                continue;
            }

            $math = stack_converter::extract_math($part);
            $lines[] = [
                'latex' => $part,
                'display' => self::display_latex($part),
                'display_parts' => self::display_parts($part, $math),
                'math' => $math,
                'stack' => $math === '' ? '' : stack_converter::normalize($math),
            ];
        }

        return $lines;
    }

    private static function extract_multiline_body(string $latex): ?string {
        if (!preg_match('/^\\\\begin\{(aligned|gathered|split|align|array)\*?\}(?:\{[^}]*\})?([\s\S]*?)\\\\end\{\1\*?\}$/', trim($latex), $match)) {
            return null;
        }

        return trim($match[2]);
    }

    private static function clean_line_latex(string $line): string {
        $line = trim($line);
        $line = preg_replace('/^\\\\begin\{(?:aligned|gathered|split|align|array)\*?\}(?:\{[^}]*\})?/', '', $line);
        $line = preg_replace('/\\\\end\{(?:aligned|gathered|split|align|array)\*?\}$/', '', $line);
        $line = str_replace('&', '', $line);
        $line = preg_replace('/^\s*(?:\d+[\.\)]|[-*])\s*/', '', $line);
        $line = preg_replace('/^\$\s*/', '', $line);
        $line = preg_replace('/\s*\$$/', '', $line);
        $line = preg_replace('/^\\\\\(\s*/', '', $line);
        $line = preg_replace('/\s*\\\\\)$/', '', $line);
        $line = preg_replace('/^\\\\\[\s*/', '', $line);
        $line = preg_replace('/\s*\\\\\]$/', '', $line);
        $line = preg_replace('/(?<!\\\\)\btext\s*\{/u', '\\text{', $line);
        return trim($line);
    }

    private static function display_latex(string $line): string {
        $line = preg_replace('/\\\\text\s*\{\s*([^{}]*?)\s*\}/u', '$1', $line);
        $line = preg_replace('/(?<!\\\\)\btext\s*\{\s*([^{}]*?)\s*\}/u', '$1', $line);
        $line = str_replace(['\\,', '\\;', '\\:', '\\!'], '', $line);
        return trim($line);
    }

    private static function display_parts(string $line, string $math): array {
        $display = self::display_latex($line);
        if ($math === '') {
            return [[
                'type' => 'text',
                'text' => $display,
            ]];
        }

        $mathdisplay = self::display_latex($math);
        $displaycompact = preg_replace('/\s+/u', '', $display);
        $mathcompact = preg_replace('/\s+/u', '', $mathdisplay);
        $pos = $mathcompact === '' ? false : mb_strpos($displaycompact, $mathcompact);

        if ($pos === false) {
            return [
                ['type' => 'text', 'text' => $display],
                ['type' => 'math', 'latex' => $math],
            ];
        }

        $parts = [];
        $offset = 0;
        $compactoffset = 0;
        $mathstart = null;
        $mathend = null;
        $chars = preg_split('//u', $display, -1, PREG_SPLIT_NO_EMPTY);
        foreach ($chars as $char) {
            $charlen = mb_strlen($char);
            if (!preg_match('/\s/u', $char)) {
                if ($compactoffset === $pos && $mathstart === null) {
                    $mathstart = $offset;
                }
                $compactoffset++;
                if ($compactoffset === $pos + mb_strlen($mathcompact) && $mathend === null) {
                    $mathend = $offset + $charlen;
                    break;
                }
            }
            $offset += $charlen;
        }

        if ($mathstart === null || $mathend === null) {
            return [
                ['type' => 'text', 'text' => $display],
                ['type' => 'math', 'latex' => $math],
            ];
        }

        $before = mb_substr($display, 0, $mathstart);
        $after = mb_substr($display, $mathend);
        if (trim($before) !== '') {
            $parts[] = ['type' => 'text', 'text' => $before];
        }
        $parts[] = ['type' => 'math', 'latex' => $math];
        if (trim($after) !== '') {
            $parts[] = ['type' => 'text', 'text' => $after];
        }

        return $parts;
    }

    private static function extract_latex(array $data): string {
        $value = '';

        foreach (['latex_styled', 'latex_simplified', 'text'] as $key) {
            if (!empty($data[$key]) && is_string($data[$key])) {
                $value = $data[$key];
                break;
            }
        }

        $value = trim($value);
        $value = preg_replace('/^\$\s*/', '', $value);
        $value = preg_replace('/\s*\$$/', '', $value);
        $value = preg_replace('/^\\\\\[\s*/', '', $value);
        $value = preg_replace('/\s*\\\\\]$/', '', $value);
        $value = preg_replace('/^\\\\\(\s*/', '', $value);
        $value = preg_replace('/\s*\\\\\)$/', '', $value);

        return trim($value);
    }
}
