# STACK Input Helper

STACK Input Helper is a Moodle local plugin that provides image-based and mobile-based mathematical expression input support for STACK questions.

This plugin adds helper buttons near STACK answer input fields, allowing users to upload an image of a mathematical expression or use a mobile device to capture and submit handwritten mathematics. The recognized expression is then inserted into the STACK answer field.

This plugin is currently an alpha prototype developed for research and local testing.

---

## Features

- Adds an **Upload math image** button near STACK answer fields
- Supports image-based mathematical expression recognition
- Supports **Mobile Math Upload** using a QR code
- Allows users to take a photo of handwritten mathematics on a mobile device
- Sends the uploaded image to a configurable external recognizer API
- Inserts the recognized mathematical expression into the STACK answer field
- Provides administrator settings for the recognizer API URL and optional API token
- Designed for Moodle + STACK environments

---

## Plugin information

Plugin type:

```text
local
```

Component name:

```text
local_stackinputhelper
```

Installation path:

```text
moodle/local/stackinputhelper
```

Current development status:

```text
Alpha prototype
```

---

## Requirements

- Moodle 4.0 or later
- STACK question type installed and configured
- A mathematical expression recognizer API

For local development and testing, this plugin can be used together with a Node.js-based recognition server.

Example local recognizer API URL:

```text
http://localhost:3001/recognize
```

The recognition server may internally use OCR services such as Mathpix or other mathematical expression recognition tools.

---

## Installation

1. Copy the plugin folder to the Moodle local plugin directory:

```text
moodle/local/stackinputhelper
```

2. Visit the Moodle site as an administrator.

3. Go to:

```text
Site administration > Notifications
```

4. Follow the installation or upgrade instructions shown by Moodle.

5. After installation, confirm that the plugin appears under:

```text
Site administration > Plugins > Plugins overview > Local plugins
```

You should see:

```text
STACK Input Helper
```

---

## Configuration

After installation, configure the plugin from:

```text
Site administration > Plugins > Local plugins > STACK Input Helper
```

The following settings are available.

### Recognizer API URL

The HTTP endpoint that accepts an uploaded image and returns recognized mathematical text.

Example for local testing:

```text
http://localhost:3001/recognize
```

For production or shared use, this should be changed to the URL of the actual recognition server.

### Recognizer API token

An optional bearer token used when calling the recognizer API.

If the external recognition service requires authentication, set the token here. The token should not be hard-coded in JavaScript or exposed to users.

---

## Usage

1. Open a Moodle quiz attempt page or a STACK question preview page.

2. Find a STACK answer input field.

3. Click **Upload math image** to upload a mathematical expression image from the current device.

4. Alternatively, click **Mobile Math Upload**.

5. A QR code will be displayed on the desktop page.

6. Scan the QR code with a mobile phone or tablet.

7. Take a photo of a handwritten mathematical expression or upload an image from the mobile device.

8. Submit the image from the mobile device.

9. The desktop page will receive the recognition result automatically.

10. The recognized expression will be inserted into the STACK answer input field.

---

## Recognition API

This plugin expects an external recognizer API that accepts an image upload and returns recognized mathematical text.

A typical request flow is:

```text
Moodle page
    ↓
STACK Input Helper plugin
    ↓
External recognizer API
    ↓
OCR / mathematical expression recognition service
    ↓
Recognized expression
    ↓
STACK answer field
```

The recognizer API should return a response that can be converted into a STACK-compatible or Maxima-compatible mathematical expression.

Example recognized input:

```text
2x^2 + 1
```

Expected STACK-friendly output:

```text
2*x^2+1
```

---

## STACK / Maxima syntax conversion

STACK answers are interpreted by Maxima, so mathematical expressions often need to be converted into an explicit syntax.

For example:

```text
2x^2 + 1
```

should be converted to:

```text
2*x^2+1
```

Other examples:

```text
3(x+1)      → 3*(x+1)
x(x+1)      → x*(x+1)
sqrt(x)     → sqrt(x)
sin(x)      → sin(x)
pi          → pi
```

The conversion rules are still under development. Recognition results should be checked carefully before submission.

---

## Privacy

This plugin itself does not store uploaded mathematical expression images in Moodle.

However, uploaded images may be sent to an external recognition API configured by the site administrator. The external recognition API may further send the image to a third-party OCR service depending on its implementation.

Site administrators should make sure that the configured recognition service complies with their institution's privacy, security, and data protection policies.

Users should be informed that uploaded mathematical expression images may be processed by an external service.

---

## Security notes

- Do not hard-code API keys in JavaScript files.
- API tokens should be configured through Moodle administrator settings.
- The recognition API should require authentication if it is exposed publicly.
- Uploaded file size should be limited.
- Uploaded file types should be restricted to safe image formats such as PNG and JPEG.
- The recognition endpoint should only be available to authenticated Moodle users.
- Site administrators should avoid using an unauthenticated public recognition endpoint in production.

---

## Development status

This plugin is currently in alpha status.

Implemented features include:

- Moodle local plugin structure
- Administrator configuration page
- Image upload button
- Mobile upload button
- QR code based mobile upload flow
- External recognizer API integration
- Insertion of recognition results into STACK answer fields

Planned improvements include:

- Improved STACK / Maxima syntax conversion
- Better handling of implicit multiplication
- Better error messages
- Privacy API implementation
- More detailed administrator settings
- Support for more mathematical expression patterns
- Usability evaluation in Moodle + STACK learning environments

---

## Development

The plugin source code is located in:

```text
moodle/local/stackinputhelper
```

Typical plugin structure:

```text
stackinputhelper/
├── amd/
│   ├── src/
│   └── build/
├── classes/
│   └── external/
├── db/
│   ├── hooks.php
│   └── services.php
├── lang/
│   └── en/
│       └── local_stackinputhelper.php
├── lib.php
├── settings.php
├── version.php
└── README.md
```

When JavaScript files under `amd/src` are modified, rebuild the AMD JavaScript files before testing or distribution.

Depending on the Moodle development environment, this can usually be done with:

```bash
npx grunt amd
```

After changing plugin settings, services, hooks, or version information, purge Moodle caches from:

```text
Site administration > Development > Purge caches
```

or run the Moodle CLI cache purge command.

---

## Version

Current version:

```text
0.1.0-alpha
```

Moodle plugin version:

```text
2026042200
```

---

## Uninstallation

To uninstall the plugin, go to:

```text
Site administration > Plugins > Plugins overview > Local plugins
```

Find **STACK Input Helper** and click **Uninstall**.

After uninstalling, remove the plugin directory if necessary:

```text
moodle/local/stackinputhelper
```

---

## Known limitations

- The plugin is currently tested mainly in a local Moodle + STACK environment.
- Recognition accuracy depends on the external recognizer API.
- Some OCR results may not be valid STACK / Maxima syntax.
- Implicit multiplication, such as `2x`, may need additional conversion to `2*x`.
- Mobile upload requires the mobile device to access the recognition or upload URL.
- The current implementation is not yet intended for large-scale production use.

---

## Research context

This plugin is developed as part of research on improving mathematical input support in Moodle + STACK learning environments.

The main motivation is to reduce the input burden of mathematical expressions in online assessment systems, especially when students need to enter complex formulas using a keyboard.

The plugin explores the use of handwritten mathematical expression recognition, image upload, and mobile device capture to support more natural mathematical input.

---

## License

This plugin is distributed under the GNU General Public License v3 or later.

See:

```text
https://www.gnu.org/licenses/gpl-3.0.html
```

---

## Author

Developed by Huang Jiajun.

```text
Moodle local plugin: STACK Input Helper
Component: local_stackinputhelper
```