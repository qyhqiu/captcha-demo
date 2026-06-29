const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { validateRequestHeaders } = require('./middleware/security');
const captchaRoutes = require('./routes/captcha');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── 基础中间件 ──────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 配置（仅允许前端开发地址）
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── 全局限流（DDoS 防护）───────────────────────────────────────
// 每个 IP 每 15 分钟最多 100 次请求
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试',
  },
  handler(req, res, next, options) {
    console.warn(`[限流] IP ${req.ip} 触发全局限流`);
    res.status(429).json(options.message);
  },
});

app.use(globalRateLimiter);

// ─── 安全请求头校验（防爬虫）────────────────────────────────────
app.use('/api', validateRequestHeaders);

// ─── 路由注册 ────────────────────────────────────────────────────
app.use('/api/captcha', captchaRoutes);

// ─── 健康检查 ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 处理 ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// ─── 全局错误处理 ────────────────────────────────────────────────
app.use((error, req, res, next) => {
  console.error('[服务器错误]', error);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 验证码服务已启动: http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔐 图形验证码: GET http://localhost:${PORT}/api/captcha/image`);
  console.log(`📱 发送短信: POST http://localhost:${PORT}/api/captcha/send-sms`);
  console.log(`✅ 校验验证码: POST http://localhost:${PORT}/api/captcha/verify-sms\n`);
});
