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
        $stack = stack_converter::normalize($rawlatex);

        return [
            'raw_latex' => $rawlatex,
            'stack' => $stack,
            'text' => $stack,
            'mathpix' => $data,
        ];
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

