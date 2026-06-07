<?php
define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

header('Content-Type: application/json; charset=utf-8');

try {
    if (!get_config('local_stackinputhelper', 'enabled')) {
        throw new moodle_exception('pluginnotenabled', 'local_stackinputhelper');
    }

    $latex = required_param('latex', PARAM_RAW_TRIMMED);
    if ($latex === '') {
        throw new moodle_exception('emptylatex', 'local_stackinputhelper');
    }

    echo json_encode([
        'success' => true,
        'stack' => \local_stackinputhelper\local\stack_converter::normalize_selection($latex),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
