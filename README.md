# STACK Input Helper

Alpha Moodle local plugin for testing image-based mathematical input support in Moodle + STACK.

The current demo uses a human-in-the-loop workflow: Mathpix recognizes the whole image, the plugin displays the recognized result by line, the last line is recommended by default, and the student confirms or edits the expression before it is inserted into the STACK answer field.

This repository contains:

- `stackinputhelper/`: Moodle local plugin for STACK input assistance

Current target use:

1. Local development and smoke testing.
2. Trial deployment on the ILAS Nagoya University STACK testing course.
3. Later cleanup and packaging as a formal Moodle plugin.

## Current Demo Workflow

1. Upload a handwritten math image from the browser, or scan the QR code and upload from a phone.
2. Moodle sends the image to Mathpix from the PHP backend.
3. The recognized LaTeX is split into candidate lines.
4. The UI shows the original math/text result for review.
5. The last line is selected as the recommended answer by default.
6. The student can choose another line, drag-select part of a line, or edit the STACK preview manually.
7. Only the confirmed selection is converted to STACK/Maxima syntax and inserted into the answer box.

This is intended to reduce accidental submission of intermediate working when a student photographs a multi-line solution.

## Moodle Plugin Backend

The Moodle plugin now calls Mathpix directly from PHP. A separate Node.js service is no longer required for normal Moodle deployment.

For lab deployment:

1. Create or use a zip whose root folder is exactly `stackinputhelper/`.
2. Install it from `Site administration > Plugins > Install plugins`, or copy `stackinputhelper/` to `moodle/local/stackinputhelper`.
3. Visit `Site administration > Notifications` and complete the database upgrade.
4. Configure `Mathpix App ID` and `Mathpix App Key` under `Site administration > Plugins > Local plugins > STACK Input Helper`.
5. Open a STACK question page and test image upload.

Do not upload GitHub's full repository download zip directly to Moodle, because Moodle should receive only the `stackinputhelper/` plugin folder.

Do not commit `.env`, `node_modules/`, uploaded images, or Moodle cache files.

## Moodle Plugin

Copy the plugin folder into Moodle:

```text
moodle/local/stackinputhelper
```

Then visit Moodle as an administrator and complete plugin installation from:

```text
Site administration > Notifications
```

Configure Mathpix credentials in:

```text
Site administration > Plugins > Local plugins > STACK Input Helper
```

## Development Checks

For Moodle-side development and smoke testing, check:

- `stackinputhelper/classes/local/stack_converter.php`
- `stackinputhelper/classes/local/mathpix_client.php`
- `stackinputhelper/amd/src/main.js`
- `stackinputhelper/amd/build/main.min.js`
