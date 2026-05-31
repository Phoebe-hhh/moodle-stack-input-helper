<?php
define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

header('Content-Type: application/json; charset=utf-8');

try {
    global $DB, $USER;

    if (!get_config('local_stackinputhelper', 'enabled')) {
        throw new moodle_exception('pluginnotenabled', 'local_stackinputhelper');
    }

    if (!get_config('local_stackinputhelper', 'enablemobile')) {
        throw new moodle_exception('mobilenotenabled', 'local_stackinputhelper');
    }

    $now = time();
    $DB->delete_records_select('local_stackinputhelper_sess', 'expiresat < ?', [$now]);

    $sessionid = bin2hex(random_bytes(16));
    $record = (object)[
        'sessionid' => $sessionid,
        'userid' => $USER->id,
        'status' => 'waiting',
        'rawlatex' => '',
        'stack' => '',
        'resulttext' => '',
        'timecreated' => $now,
        'timemodified' => $now,
        'expiresat' => $now + 10 * 60,
    ];

    $DB->insert_record('local_stackinputhelper_sess', $record);

    $mobileurl = new moodle_url('/local/stackinputhelper/mobile.php', ['session' => $sessionid]);

    echo json_encode([
        'success' => true,
        'session_id' => $sessionid,
        'mobile_url' => $mobileurl->out(false),
        'expires_at' => $record->expiresat,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
