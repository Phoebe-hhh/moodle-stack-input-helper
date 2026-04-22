<?php
defined('MOODLE_INTERNAL') || die();

function local_stackinputhelper_before_standard_top_of_body_html(): string {
    global $PAGE;

    if (empty($PAGE->url)) {
        return '';
    }

    $path = $PAGE->url->get_path();

    $targets = [
        '/mod/quiz/attempt.php',
        '/question/preview.php',
    ];

    if (!in_array($path, $targets, true)) {
        return '';
    }

    $config = [
        'apiurl' => (string)(get_config('local_stackinputhelper', 'apiurl') ?: ''),
        'apitoken' => (string)(get_config('local_stackinputhelper', 'apitoken') ?: ''),
        'uploadbtn' => get_string('uploadbtn', 'local_stackinputhelper'),
        'uploading' => get_string('uploading', 'local_stackinputhelper'),
        'nofieldfound' => get_string('nofieldfound', 'local_stackinputhelper'),
        'recognizefailed' => get_string('recognizefailed', 'local_stackinputhelper'),
    ];

    $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $version = '20260422_3';

    return '
<script>
window.STACKINPUTHELPER_CONFIG = ' . $json . ';
console.log("[stackinputhelper] config injected", window.STACKINPUTHELPER_CONFIG);
</script>
<script src="/local/stackinputhelper/amd/build/main.min.js?v=' . $version . '"></script>
';
}