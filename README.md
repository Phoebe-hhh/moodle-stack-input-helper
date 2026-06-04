# STACK Input Helper

Alpha Moodle local plugin for testing image-based mathematical input support in Moodle + STACK.

This repository contains:

- `stackinputhelper/`: Moodle local plugin for STACK input assistance
- `recognizer-api/`: Legacy/development Node.js recognizer API and regression reference

Current target use:

1. Local development and regression testing.
2. Trial deployment on the ILAS Nagoya University STACK testing course.
3. Later cleanup and packaging as a formal Moodle plugin.

## Moodle Plugin Backend

The Moodle plugin now calls Mathpix directly from PHP. A separate Node.js service is no longer required for normal Moodle deployment.

For lab deployment:

1. Create or use a zip whose root folder is exactly `stackinputhelper/`.
2. Install it from `Site administration > Plugins > Install plugins`, or copy `stackinputhelper/` to `moodle/local/stackinputhelper`.
3. Visit `Site administration > Notifications` and complete the database upgrade.
4. Configure `Mathpix App ID` and `Mathpix App Key` under `Site administration > Plugins > Local plugins > STACK Input Helper`.
5. Open a STACK question page and test image upload.

Do not upload GitHub's full repository download zip directly to Moodle, because that zip contains this README and the legacy `recognizer-api/` folder. Moodle should receive only the `stackinputhelper/` plugin folder.

## Legacy Recognizer API

```bash
cd recognizer-api
npm install
cp .env.example .env
npm test
node server.js
```

The Node.js recognizer is kept for development comparison and regression testing. It is not required by the Moodle plugin runtime.

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

## Testing

The recognizer API includes regression tests for the current OCR-to-STACK conversion rules:

```bash
cd recognizer-api
npm test
```

The test coverage currently includes constants, inequalities, sets and intervals, absolute values, limits, derivatives, integrals, sums, products, vectors, matrices, determinants, and piecewise functions.
