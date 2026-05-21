import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

const MATHPIX_APP_ID =
  process.env.MATHPIX_APP_ID ||
  process.env.APP_ID ||
  '';

const MATHPIX_APP_KEY =
  process.env.MATHPIX_APP_KEY ||
  process.env.APP_KEY ||
  '';

const sessions = new Map();

//获取本机ip地址，优先返回局域网地址
const HOST_IP = process.env.HOST_IP || getLocalIPv4();
function getLocalIPv4() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            const isIPv4 = net.family === 'IPv4' || net.family === 4;
            const isInternal = net.internal === true;

            if (isIPv4 && !isInternal) {
                // 优先返回局域网地址
                if (
                    net.address.startsWith('192.168.') ||
                    net.address.startsWith('10.') ||
                    net.address.startsWith('172.')
                ) {
                    return net.address;
                }
            }
        }
    }

    return 'localhost';
}
function isSessionExpired(session) {
    if (!session) {
        return true;
    }
    return Date.now() > session.expires_at;
}

function markSessionExpired(session) {
    if (!session) {
        return;
    }
    session.status = 'expired';
}
function extractMainMathExpression(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    let s = input.trim();

    // 去掉 array / aligned / cases 等环境包裹
    s = s.replace(/\\begin\{array\}\{[^}]*\}/g, '');
    s = s.replace(/\\end\{array\}/g, '');

    s = s.replace(/\\begin\{aligned\}/g, '');
    s = s.replace(/\\end\{aligned\}/g, '');

    s = s.replace(/\\begin\{cases\}/g, '');
    s = s.replace(/\\end\{cases\}/g, '');

    // 按 LaTeX 换行拆分
    const parts = s
        .split(/\\\\/)
        .map(x => x.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return s;
    }

    // 优先取最后一条非空表达式
    // 对你现在这个例子，会取到 \left(x^{2}+1\right)+3
    return parts[parts.length - 1];
}

function normalizeLatexToStack(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    let s = extractMainMathExpression(input);

    // 去掉 \left \right
    s = s.replace(/\\left/g, '');
    s = s.replace(/\\right/g, '');

    // 乘号
    s = s.replace(/\\cdot/g, '*');
    s = s.replace(/\\times/g, '*');

    // 去掉空白类命令
    s = s.replace(/\\,/g, '');
    s = s.replace(/\\!/g, '');
    s = s.replace(/\\;/g, '');
    s = s.replace(/\\:/g, '');
    s = s.replace(/\\ /g, '');

    // 分式
    while (/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(s)) {
        s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
    }

    // 根式
    while (/\\sqrt\s*\{([^{}]+)\}/.test(s)) {
        s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');
    }

    // 三角函数
    s = s.replace(/\\sin\s*\{([^{}]+)\}/g, 'sin($1)');
    s = s.replace(/\\cos\s*\{([^{}]+)\}/g, 'cos($1)');
    s = s.replace(/\\tan\s*\{([^{}]+)\}/g, 'tan($1)');
    s = s.replace(/\\log\s*\{([^{}]+)\}/g, 'log($1)');
    s = s.replace(/\\ln\s*\{([^{}]+)\}/g, 'ln($1)');

    // 幂
    s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');

    // 下标先简单处理
    s = s.replace(/_\{([^{}]+)\}/g, '_$1');

    // 花括号改圆括号
    s = s.replace(/\{/g, '(');
    s = s.replace(/\}/g, ')');

    // 去掉剩余 LaTeX 命令斜杠
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');

    // 压缩空格
    s = s.replace(/\s+/g, '');

    return s.trim();
}
function createSessionId() {
    return crypto.randomBytes(8).toString('hex');
}

function getMobileUrl(sessionId) {
    return `http://${HOST_IP}:${PORT}/mobile/${sessionId}`;
}

app.get('/', (req, res) => {
    res.json({
        ok: true,
        message: 'Recognizer API is running'
    });
});

app.post('/session/create', (req, res) => {
    const sessionId = createSessionId();
    const now = Date.now();

    sessions.set(sessionId, {
        session_id: sessionId,
        status: 'waiting',
        created_at: now,
        expires_at: now + SESSION_TTL_MS,
        raw_latex: '',
        stack: '',
        text: ''
    });

    res.json({
        success: true,
        session_id: sessionId,
        mobile_url: getMobileUrl(sessionId),
        expires_at: now + SESSION_TTL_MS
    });
});

app.get('/session/:id/result', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    if (isSessionExpired(session) && session.status !== 'done') {
        markSessionExpired(session);

        return res.json({
            success: true,
            ready: false,
            expired: true,
            status: 'expired'
        });
    }

    if (session.status !== 'done') {
        return res.json({
            success: true,
            ready: false,
            expired: false,
            status: session.status
        });
    }

    return res.json({
        success: true,
        ready: true,
        expired: false,
        status: 'done',
        raw_latex: session.raw_latex,
        stack: session.stack,
        text: session.text
    });
});

app.post('/session/:id/result', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }

    if (isSessionExpired(session)) {
        markSessionExpired(session);

        return res.status(410).json({
            success: false,
            error: 'Session expired'
        });
    }

    const raw_latex = req.body.raw_latex || '';
    const stack = req.body.stack || '';
    const text = req.body.text || '';

    session.status = 'done';
    session.raw_latex = raw_latex;
    session.stack = stack;
    session.text = text;

    sessions.set(req.params.id, session);

    return res.json({
        success: true
    });
});

app.post('/recognize', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image uploaded'
            });
        }

        if (!MATHPIX_APP_ID || !MATHPIX_APP_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Missing Mathpix credentials'
            });
        }

        const imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });

        const mathpixResponse = await axios.post(
            'https://api.mathpix.com/v3/text',
            {
                src: `data:${req.file.mimetype};base64,${imageBase64}`,
                formats: ['text', 'latex_styled'],
                data_options: {
                    include_asciimath: true
                }
            },
            {
                headers: {
                    'app_id': MATHPIX_APP_ID,
                    'app_key': MATHPIX_APP_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = mathpixResponse.data || {};

        const rawLatex =
            data.latex_styled ||
            data.latex_normal ||
            data.text ||
            '';

        const text = data.text || '';
        const normalized = normalizeLatexToStack(rawLatex);
        const stack = normalized || text || '';

        fs.unlink(req.file.path, () => {});

        return res.json({
            success: true,
            raw_latex: rawLatex,
            text,
            normalized,
            stack
        });
    } catch (error) {
        console.error('recognize error:', error?.response?.data || error.message);

        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }

        return res.status(500).json({
            success: false,
            error: error?.response?.data || error.message || 'Recognition failed'
        });
    }
});

app.get('/mobile/:id', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {

        return res.status(404).send('<h1>Session not found</h1>');

    }

    if (isSessionExpired(session) && session.status !== 'done') {

        markSessionExpired(session);

        return res.status(410).send('<h1>Session expired</h1><p>Please return to the desktop and create a new session.</p>');

    }
    res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Mobile Math Upload</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: sans-serif; padding: 16px; max-width: 720px; margin: 0 auto; }
    button { padding: 10px 14px; margin-top: 10px; }
    textarea { width: 100%; box-sizing: border-box; margin-top: 8px; margin-bottom: 12px; }
    .box { border: 1px solid #ddd; padding: 12px; margin-top: 12px; background: #fafafa; }
  </style>
</head>
<body>
  <h2>Capture and Upload a Math Expression</h2>
  <p>Session: ${req.params.id}</p>

  <input id="file" type="file" accept="image/*" capture="environment" />
  <br />
  <button id="recognizeBtn">Recognizing...</button>

  <div class="box" id="resultBox" style="display:none;">
    <div><strong>OCR raw result:</strong></div>
    <textarea id="raw" rows="3" readonly></textarea>

    <div><strong>STACK result:</strong></div>
    <textarea id="stack" rows="3"></textarea>

    <button id="submitBtn">Submit to Desktop</button>
  </div>

  <script>
    const fileInput = document.getElementById('file');
    const recognizeBtn = document.getElementById('recognizeBtn');
    const resultBox = document.getElementById('resultBox');
    const rawEl = document.getElementById('raw');
    const stackEl = document.getElementById('stack');
    const submitBtn = document.getElementById('submitBtn');

    let latestResult = null;

    recognizeBtn.onclick = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        alert('Please select or take a photo of the image first');
        return;
      }

      const fd = new FormData();
      fd.append('image', file);

      try {
        recognizeBtn.disabled = true;
        recognizeBtn.textContent = 'Recognizing...';

        const resp = await fetch('/recognize', {
          method: 'POST',
          body: fd
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Recognition failed');
        }

        latestResult = data;
        rawEl.value = data.raw_latex || '';
        stackEl.value = data.stack || data.normalized || data.text || '';
        resultBox.style.display = 'block';
      } catch (e) {
        alert('Recognition failed: ' + e.message);
      } finally {
        recognizeBtn.disabled = false;
        recognizeBtn.textContent = 'Recognize';
      }
    };

    submitBtn.onclick = async () => {
      try {
        const body = {
          raw_latex: rawEl.value || '',
          stack: stackEl.value || '',
          text: latestResult?.text || ''
        };

        const resp = await fetch('/session/${req.params.id}/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Submit failed');
        }

        alert('Successfully submitted to desktop, please go back to the desktop to view.');
      } catch (e) {
        alert('Submit failed: ' + e.message);
      }
    };
  </script>
</body>
</html>
    `);
});

setInterval(() => {
    const now = Date.now();

    for (const [sessionId, session] of sessions.entries()) {
        const tooOldDoneSession =
            session.status === 'done' && now - session.created_at > 30 * 60 * 1000;

        const expiredWaitingSession =
            session.status !== 'done' && now > session.expires_at;

        if (expiredWaitingSession) {
            session.status = 'expired';
        }

        if (tooOldDoneSession || expiredWaitingSession) {
            sessions.delete(sessionId);
        }
    }
}, 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Recognizer API listening on http://0.0.0.0:${PORT}`);
    console.log(`Mobile access base URL: http://${HOST_IP}:${PORT}`);
});