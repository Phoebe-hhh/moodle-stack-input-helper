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

    if (empty($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
        throw new moodle_exception('invaliduploadedfile', 'local_stackinputhelper');
    }

    $maxfilesize = max(1, (int)get_config('local_stackinputhelper', 'maxfilesize')) * 1024 * 1024;
    if ((int)$_FILES['image']['size'] > $maxfilesize) {
        throw new moodle_exception('filetoolarge', 'local_stackinputhelper');
    }

    $mimetype = clean_param($_FILES['image']['type'] ?? '', PARAM_RAW_TRIMMED);
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mimetype, $allowed, true)) {
        throw new moodle_exception('invalidfiletype', 'local_stackinputhelper');
    }

    $result = \local_stackinputhelper\local\mathpix_client::recognize(
        $_FILES['image']['tmp_name'],
        clean_param($_FILES['image']['name'] ?? 'upload.png', PARAM_FILE),
        $mimetype
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
