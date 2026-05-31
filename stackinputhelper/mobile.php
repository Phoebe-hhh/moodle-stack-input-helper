<?php
require_once(__DIR__ . '/../../config.php');

$sessionid = required_param('session', PARAM_ALPHANUMEXT);

require_login();

global $DB, $PAGE, $OUTPUT, $USER;

$record = $DB->get_record('local_stackinputhelper_sess', ['sessionid' => $sessionid], '*', MUST_EXIST);
if ((int)$record->userid !== (int)$USER->id) {
    throw new moodle_exception('nopermissions', 'error', '', get_string('view'));
}

$PAGE->set_url(new moodle_url('/local/stackinputhelper/mobile.php', ['session' => $sessionid]));
$PAGE->set_context(context_system::instance());
$PAGE->set_title(get_string('mobileuploadbtn', 'local_stackinputhelper'));
$PAGE->set_heading(get_string('mobileuploadbtn', 'local_stackinputhelper'));

echo $OUTPUT->header();
?>
<div class="local-stackinputhelper-mobile">
    <p><?php echo s(get_string('mobileuploadinstructions', 'local_stackinputhelper')); ?></p>
    <input id="local-stackinputhelper-mobile-file" type="file" accept="image/*" capture="environment">
    <button id="local-stackinputhelper-mobile-submit" type="button" class="btn btn-primary">
        <?php echo s(get_string('uploadbtn', 'local_stackinputhelper')); ?>
    </button>
    <div id="local-stackinputhelper-mobile-status" style="margin-top: 1rem;"></div>
    <pre id="local-stackinputhelper-mobile-result" style="margin-top: 1rem; display: none;"></pre>
</div>
<script>
(function() {
    const fileInput = document.getElementById('local-stackinputhelper-mobile-file');
    const submitBtn = document.getElementById('local-stackinputhelper-mobile-submit');
    const status = document.getElementById('local-stackinputhelper-mobile-status');
    const result = document.getElementById('local-stackinputhelper-mobile-result');
    const uploadUrl = <?php echo json_encode((new moodle_url('/local/stackinputhelper/mobile_upload.php'))->out(false)); ?>;
    const sessionId = <?php echo json_encode($sessionid); ?>;
    const sesskey = <?php echo json_encode(sesskey()); ?>;

    submitBtn.addEventListener('click', async function() {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            status.textContent = <?php echo json_encode(get_string('nofilechosen', 'local_stackinputhelper')); ?>;
            return;
        }

        const oldText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = <?php echo json_encode(get_string('uploading', 'local_stackinputhelper')); ?>;
        status.textContent = <?php echo json_encode(get_string('uploading', 'local_stackinputhelper')); ?>;
        result.style.display = 'none';

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('session', sessionId);
            formData.append('sesskey', sesskey);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || ('HTTP ' + response.status));
            }

            status.textContent = <?php echo json_encode(get_string('mobileuploadcomplete', 'local_stackinputhelper')); ?>;
            result.style.display = 'block';
            result.textContent = data.stack || '';
        } catch (error) {
            status.textContent = <?php echo json_encode(get_string('recognizefailed', 'local_stackinputhelper')); ?> + ' ' + error.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = oldText;
        }
    });
})();
</script>
<?php
echo $OUTPUT->footer();

