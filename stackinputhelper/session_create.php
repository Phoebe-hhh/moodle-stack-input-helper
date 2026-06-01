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
    $mobileurlout = $mobileurl->out(false);

    $mobilebaseurl = trim((string)get_config('local_stackinputhelper', 'mobilebaseurl'));
    if ($mobilebaseurl !== '') {
        $mobileurlout = rtrim($mobilebaseurl, '/') . '/local/stackinputhelper/mobile.php?session=' . rawurlencode($sessionid);
    }

    $warning = '';
    $mobilehost = strtolower((string)parse_url($mobileurlout, PHP_URL_HOST));
    if ($mobilehost === 'localhost' || $mobilehost === '127.0.0.1' || $mobilehost === '::1') {
        $warning = 'This QR code uses localhost, which only works on this computer. '
            . 'For phone upload, open Moodle using a network-accessible site URL or set Mobile public base URL in the plugin settings.';
    }

    echo json_encode([
        'success' => true,
        'session_id' => $sessionid,
        'mobile_url' => $mobileurlout,
        'mobile_url_warning' => $warning,
        'expires_at' => $record->expiresat,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
