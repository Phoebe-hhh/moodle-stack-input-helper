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
            'convertUrl' => (new \moodle_url('/local/stackinputhelper/convert.php'))->out(false),
            'sessionCreateUrl' => (new \moodle_url('/local/stackinputhelper/session_create.php'))->out(false),
            'sessionResultUrl' => (new \moodle_url('/local/stackinputhelper/session_result.php'))->out(false),
            'sesskey' => sesskey(),
            'enablemobile' => (bool)get_config('local_stackinputhelper', 'enablemobile'),
            'uploadbtn' => get_string('uploadbtn', 'local_stackinputhelper'),
            'mobilebtn' => get_string('mobileuploadbtn', 'local_stackinputhelper'),
            'uploading' => get_string('uploading', 'local_stackinputhelper'),
            'nofieldfound' => get_string('nofieldfound', 'local_stackinputhelper'),
            'recognizefailed' => get_string('recognizefailed', 'local_stackinputhelper'),
            'recognizedresults' => get_string('recognizedresults', 'local_stackinputhelper'),
            'selectanswer' => get_string('selectanswer', 'local_stackinputhelper'),
            'recommendedanswer' => get_string('recommendedanswer', 'local_stackinputhelper'),
            'stackpreview' => get_string('stackpreview', 'local_stackinputhelper'),
            'insertanswer' => get_string('insertanswer', 'local_stackinputhelper'),
            'rawlatex' => get_string('rawlatex', 'local_stackinputhelper'),
            'lineprefix' => get_string('lineprefix', 'local_stackinputhelper'),
            'creatingmobilesession' => get_string('creatingmobilesession', 'local_stackinputhelper'),
            'waitingmobileupload' => get_string('waitingmobileupload', 'local_stackinputhelper'),
            'mobileuploadreceived' => get_string('mobileuploadreceived', 'local_stackinputhelper'),
            'mobileuploadexpired' => get_string('mobileuploadexpired', 'local_stackinputhelper'),
            'mobileuploadtimeout' => get_string('mobileuploadtimeout', 'local_stackinputhelper'),
            'mobilesessionfailed' => get_string('mobilesessionfailed', 'local_stackinputhelper'),
            'partialselectionfailed' => get_string('partialselectionfailed', 'local_stackinputhelper'),
        ];

        $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $version = '20260607_mixed_text_5';

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
