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

Install a zip whose root folder is exactly:

```text
stackinputhelper/
```

from:

```text
Site administration > Plugins > Install plugins
```

Alternatively, copy this folder to:

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
- Mobile public base URL, only needed when the Moodle site URL is not reachable from phones.

## Mobile Upload URL

For normal Moodle deployments, no network-specific setup is required. The mobile QR code uses the Moodle site URL configured in `$CFG->wwwroot`, for example a public or campus URL such as `https://stack.example.edu`.

Phones can only open the QR code if they can reach that Moodle URL. If a site is opened as `http://localhost:8000`, the phone will also see `localhost` and will try to connect to itself, not to the teacher's computer. In that case the plugin shows a warning instead of silently producing an unusable QR code.

For local development, use one of these options:

- Open Moodle through a hostname or IP address that the phone can reach on the same network.
- Set `Mobile public base URL` in the plugin settings to that reachable URL.
- Use a tunnel or reverse proxy URL if the phone is not on the same network.

For production Moodle plugin use, administrators normally only need to install the plugin and enter the Mathpix credentials, because the Moodle site's own URL is already stable and reachable.

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
0.2.8-alpha
```
