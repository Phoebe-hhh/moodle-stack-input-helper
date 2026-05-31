<?php
namespace local_stackinputhelper\local;

defined('MOODLE_INTERNAL') || die();

final class hook_callbacks {
    public static function before_standard_top_of_body_html_generation(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        global $PAGE;

        if (during_initial_install()) {
            return;
        }

        if (empty($PAGE->url)) {
            return;
        }

        $path = $PAGE->url->get_path();

        $targets = [
            '/mod/quiz/attempt.php',
            '/question/preview.php',
        ];

        if (!in_array($path, $targets, true)) {
            return;
        }

        if (!get_config('local_stackinputhelper', 'enabled')) {
            return;
        }

        $config = [
            'recognizeUrl' => (new \moodle_url('/local/stackinputhelper/recognize.php'))->out(false),
            'sessionCreateUrl' => (new \moodle_url('/local/stackinputhelper/session_create.php'))->out(false),
            'sessionResultUrl' => (new \moodle_url('/local/stackinputhelper/session_result.php'))->out(false),
            'sesskey' => sesskey(),
            'enablemobile' => (bool)get_config('local_stackinputhelper', 'enablemobile'),
            'uploadbtn' => 'Upload math image',
            'mobilebtn' => 'Use Phone Camera',
            'uploading' => 'Recognizing...',
            'nofieldfound' => 'No visible STACK input found',
            'recognizefailed' => 'Recognition failed.',
        ];

        $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $version = '20260531_php_backend_3';

        $html = '
<script>
window.STACKINPUTHELPER_CONFIG = ' . $json . ';
console.log("[stackinputhelper] config injected", window.STACKINPUTHELPER_CONFIG);
</script>
<script src="/local/stackinputhelper/amd/build/main.min.js?v=' . $version . '"></script>
';

        $hook->add_html($html);
    }
}
