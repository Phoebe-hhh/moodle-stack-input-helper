<?php
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    if (empty($ADMIN->fulltree)) {
        return;
    }

    $settings = new admin_settingpage(
        'local_stackinputhelper',
        get_string('pluginname', 'local_stackinputhelper')
    );

    $settings->add(new admin_setting_configcheckbox(
        'local_stackinputhelper/enabled',
        get_string('enabled', 'local_stackinputhelper'),
        get_string('enabled_desc', 'local_stackinputhelper'),
        1
    ));

    $settings->add(new admin_setting_configtext(
        'local_stackinputhelper/apiurl',
        get_string('apiurl', 'local_stackinputhelper'),
        get_string('apiurl_desc', 'local_stackinputhelper'),
        'http://localhost:3001/recognize',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'local_stackinputhelper/apitoken',
        get_string('apitoken', 'local_stackinputhelper'),
        get_string('apitoken_desc', 'local_stackinputhelper'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'local_stackinputhelper/maxfilesize',
        get_string('maxfilesize', 'local_stackinputhelper'),
        get_string('maxfilesize_desc', 'local_stackinputhelper'),
        2,
        PARAM_INT
    ));

    $settings->add(new admin_setting_configcheckbox(
        'local_stackinputhelper/enablemobile',
        get_string('enablemobile', 'local_stackinputhelper'),
        get_string('enablemobile_desc', 'local_stackinputhelper'),
        1
    ));

    $ADMIN->add('localplugins', $settings);
}