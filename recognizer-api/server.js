require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Recognizer API is running' });
});

function normalizeMathOCR(text) {
  let s = text || '';

  // 1. 标准化空白
  s = s.replace(/\s+/g, ' ').trim();

  // 2. 修正常见 OCR 对幂号的误识别
  // x^{\wedge}2 -> x^2
  s = s.replace(/\^\{\s*\\wedge\s*\}\s*/g, '^');
  // x^(\wedge)2 -> x^2
  s = s.replace(/\^\(\s*\\wedge\s*\)\s*/g, '^');
  // x^(^)2 -> x^2
  s = s.replace(/\^\(\s*\^\s*\)\s*/g, '^');

  // 3. 剩余 \wedge 统一替换成 ^
  s = s.replace(/\\wedge/g, '^');

  // 4. 清理单独包裹的 ^
  s = s.replace(/\{\s*\^\s*\}/g, '^');
  s = s.replace(/\(\s*\^\s*\)/g, '^');

  // 5. 去掉幂号周围多余空格
  s = s.replace(/\s*\^\s*/g, '^');

  // 6. 连续多个 ^ 压成一个
  s = s.replace(/\^{2,}/g, '^');

  // 7. 收紧四则运算符空格
  s = s.replace(/\s*\+\s*/g, '+');
  s = s.replace(/\s*-\s*/g, '-');
  s = s.replace(/\s*\*\s*/g, '*');
  s = s.replace(/\s*\/\s*/g, '/');

  return s.trim();
}

function latexToStackSyntax(text) {
  let s = text || '';

  // 1. 去掉 LaTeX 自动括号控制
  s = s.replace(/\\left\s*/g, '');
  s = s.replace(/\\right\s*/g, '');

  // 2. 常见乘号
  s = s.replace(/\\cdot/g, '*');
  s = s.replace(/\\times/g, '*');

  // 3. 常量
  s = s.replace(/\\pi/g, 'pi');

  // 4. 分式
  s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)');

  // 5. 根号
  s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');

  // 6. 指数
  s = s.replace(/\^\{([^{}]+)\}/g, '^$1');

  // 7. 三角函数
  s = s.replace(/\\sin\s*\(?\s*([a-zA-Z0-9+\-*/^_]+)\s*\)?/g, 'sin($1)');
  s = s.replace(/\\cos\s*\(?\s*([a-zA-Z0-9+\-*/^_]+)\s*\)?/g, 'cos($1)');
  s = s.replace(/\\tan\s*\(?\s*([a-zA-Z0-9+\-*/^_]+)\s*\)?/g, 'tan($1)');

  // 8. 对数、指数函数
  s = s.replace(/\\log/g, 'log');
  s = s.replace(/\\ln/g, 'ln');
  s = s.replace(/\\exp/g, 'exp');

  return s;
}

function postCleanExpression(text) {
  let s = text || '';

  // 去掉残留大括号
  s = s.replace(/[{}]/g, '');

  // 去掉美元符号
  s = s.replace(/\$/g, '');

  // 去掉多余空白
  s = s.replace(/\s+/g, '');

  // 再压一次连续多个 ^
  s = s.replace(/\^{2,}/g, '^');

  // 去掉多余乘号附近异常
  s = s.replace(/\*{2,}/g, '*');

  // 处理空括号
  s = s.replace(/\(\)/g, '');

  return s.trim();
}

function toStackSyntax(text) {
  let s = normalizeMathOCR(text);
  s = latexToStackSyntax(s);
  s = postCleanExpression(s);
  return s;
}
app.post('/recognize', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image uploaded'
    });
  }

  try {
    const imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });
    const src = `data:${req.file.mimetype};base64,${imageBase64}`;

    const response = await axios.post(
      'https://api.mathpix.com/v3/text',
      {
        src,
        formats: ['latex_styled'],
        data_options: {
          include_latex: true
        }
      },
      {
        headers: {
          app_id: process.env.MATHPIX_APP_ID,
          app_key: process.env.MATHPIX_APP_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const latex =
      response.data.latex_styled ||
      response.data.latex ||
      response.data.text ||
      '';

    const normalized = normalizeMathOCR(latex);
    const stackText = toStackSyntax(latex);

    console.log('--- OCR RESULT ---');
    console.log('raw latex:', latex);
    console.log('normalized:', normalized);
    console.log('stack text:', stackText);
    console.log('------------------');

    return res.json({
      success: true,
      raw: response.data,
      latex,
      normalized,
      text: stackText,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('Mathpix error:', error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: 'Mathpix OCR failed',
      details: error.response?.data || error.message
    });
  } finally {
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Recognizer API running on http://localhost:${port}`);
});