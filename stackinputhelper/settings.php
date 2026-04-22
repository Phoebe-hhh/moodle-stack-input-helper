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

    $settings->add(new admin_setting_configtext(
        'local_stackinputhelper/apiurl',
        get_string('apiurl', 'local_stackinputhelper'),
        get_string('apiurl_desc', 'local_stackinputhelper'),
        'http://localhost:3001/recognize',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configtext(
        'local_stackinputhelper/apitoken',
        get_string('apitoken', 'local_stackinputhelper'),
        get_string('apitoken_desc', 'local_stackinputhelper'),
        '',
        PARAM_TEXT
    ));

    $ADMIN->add('localplugins', $settings);
}
