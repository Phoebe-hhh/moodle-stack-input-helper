# STACK Input Helper

STACK Input Helper is a Moodle local plugin that adds image-based mathematical expression input support for STACK questions.

The plugin now calls Mathpix directly from Moodle PHP. A separate Node.js service, external recognizer API, port `3001`, `pm2`, or `systemd` process is not required for normal deployment.

## Features

- Adds an upload button near visible STACK answer inputs.
- Sends uploaded images from Moodle PHP to Mathpix.
- Converts Mathpix LaTeX output to STACK/Maxima-friendly syntax.
- Inserts the recognized STACK expression into the answer field.
- Supports QR-code mobile upload using a Moodle-managed temporary session.
- Stores Mathpix App ID and App Key in Moodle admin settings, not in browser JavaScript.

## Installation

Copy this folder to:

```text
moodle/local/stackinputhelper
```

Then visit Moodle as an administrator:

```text
Site administration > Notifications
```

Follow the Moodle plugin installation or upgrade prompts.

## Configuration

Configure the plugin from:

```text
Site administration > Plugins > Local plugins > STACK Input Helper
```

Required settings:

- `Mathpix App ID`
- `Mathpix App Key`

Optional settings:

- Enable/disable the helper.
- Maximum upload image size.
- Enable/disable mobile upload.

## Lab Deployment Notes

For the ILAS Nagoya University STACK testing environment:

1. Install or update the plugin folder in `moodle/local/stackinputhelper`.
2. Complete Moodle database upgrade from `Site administration > Notifications`.
3. Fill in Mathpix credentials in plugin settings.
4. Purge Moodle caches.
5. Open a STACK question preview or quiz attempt page.
6. Upload a handwritten formula image and confirm the generated STACK expression.

## Privacy and Security

- Uploaded images are sent to Mathpix for OCR.
- Mathpix credentials are used only by Moodle PHP backend code.
- Credentials are not exposed to browser JavaScript.
- Mobile upload sessions are temporary and expire automatically.
- Uploaded image files are not permanently stored by this plugin.

Site administrators should confirm that Mathpix use complies with institutional privacy and data handling policies.

## Development

The conversion logic is implemented in:

```text
classes/local/stack_converter.php
```

The Mathpix client is implemented in:

```text
classes/local/mathpix_client.php
```

The browser script currently loads:

```text
amd/build/main.min.js
```

The legacy `recognizer-api/` directory in the repository is retained for development comparison and regression testing, but it is no longer required for Moodle deployment.

## Version

Current version:

```text
0.2.0-alpha
```

