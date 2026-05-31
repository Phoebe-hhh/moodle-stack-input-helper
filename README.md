# STACK Input Helper

Alpha prototype for testing image-based mathematical input support in Moodle + STACK.

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

1. Copy `stackinputhelper/` to `moodle/local/stackinputhelper`.
2. Visit `Site administration > Notifications`.
3. Configure `Mathpix App ID` and `Mathpix App Key` under `Site administration > Plugins > Local plugins > STACK Input Helper`.
4. Open a STACK question page and test image upload.

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
