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

    $upload = \local_stackinputhelper\local\image_upload_validator::validate($_FILES['image'] ?? []);

    $result = \local_stackinputhelper\local\mathpix_client::recognize(
        $upload['filepath'],
        $upload['filename'],
        $upload['mimetype']
    );

    echo json_encode([
        'success' => true,
        'raw_latex' => $result['raw_latex'],
        'stack' => $result['stack'],
        'text' => $result['text'],
        'lines' => $result['lines'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
