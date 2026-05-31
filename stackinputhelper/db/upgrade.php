<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_local_stackinputhelper_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026053100) {
        $table = new xmldb_table('local_stackinputhelper_sess');

        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('sessionid', XMLDB_TYPE_CHAR, '64', null, XMLDB_NOTNULL, null, null);
            $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table->add_field('status', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'waiting');
            $table->add_field('rawlatex', XMLDB_TYPE_TEXT, null, null, null, null, null);
            $table->add_field('stack', XMLDB_TYPE_TEXT, null, null, null, null, null);
            $table->add_field('resulttext', XMLDB_TYPE_TEXT, null, null, null, null, null);
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table->add_field('expiresat', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('sessionid_uix', XMLDB_INDEX_UNIQUE, ['sessionid']);
            $table->add_index('userid_ix', XMLDB_INDEX_NOTUNIQUE, ['userid']);
            $table->add_index('expiresat_ix', XMLDB_INDEX_NOTUNIQUE, ['expiresat']);

            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2026053100, 'local', 'stackinputhelper');
    }

    return true;
}
