# STACK Input Helper

Alpha prototype for testing image-based mathematical input support in Moodle + STACK.

This repository contains:

- `stackinputhelper/`: Moodle local plugin for STACK input assistance
- `recognizer-api/`: Node.js recognizer API that receives math-expression images and converts OCR LaTeX to STACK-friendly syntax

Current target use:

1. Local development and regression testing.
2. Trial deployment on the ILAS Nagoya University STACK testing course.
3. Later cleanup and packaging as a formal Moodle plugin.

## Recognizer API

```bash
cd recognizer-api
npm install
cp .env.example .env
npm test
node server.js
```

Configure the Mathpix credentials in `recognizer-api/.env`.

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

Configure the recognizer API URL in:

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
