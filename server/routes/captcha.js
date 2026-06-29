const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateImageCaptcha } = require('../utils/captcha');
const {
  saveImageCaptcha,
  verifyAndConsumeImageCaptcha,
  saveSmsCode,
  getSmsCode,
  getSmsCodeTTL,
  SMS_CODE_TTL,
} = require('../utils/redis');
const { checkBlacklistAndFrequency } = require('../middleware/security');

const router = express.Router();

// ─── 获取图形验证码 ──────────────────────────────────────────────

/**
 * GET /api/captcha/image
 * 生成并返回图形验证码（SVG 格式）
 */
router.get('/image', async (req, res) => {
  try {
    const { data: svgData, text } = generateImageCaptcha();
    const sessionId = uuidv4();

    // 将验证码答案存入 Redis（5 分钟有效）
    await saveImageCaptcha(sessionId, text);

    res.json({
      success: true,
      data: {
        sessionId,
        svg: svgData,
      },
    });
  } catch (error) {
    console.error('[图形验证码] 生成失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ─── 发送短信验证码 ──────────────────────────────────────────────

/**
 * POST /api/captcha/send-sms
 * 发送短信验证码（含图形验证码预校验 + 黑名单 + 防重复发送）
 *
 * Body: { phone, imageCaptchaSessionId, imageCaptchaText }
 */
router.post('/send-sms', checkBlacklistAndFrequency, async (req, res) => {
  const { phone, imageCaptchaSessionId, imageCaptchaText } = req.body;

  // ── 参数校验 ──
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PHONE',
      message: '手机号格式不正确',
    });
  }

  if (!imageCaptchaSessionId || !imageCaptchaText) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_IMAGE_CAPTCHA',
      message: '请完成图形验证码校验',
    });
  }

  // ── 图形验证码校验（一次性消费）──
  const isImageCaptchaValid = await verifyAndConsumeImageCaptcha(
    imageCaptchaSessionId,
    imageCaptchaText
  );

  if (!isImageCaptchaValid) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_IMAGE_CAPTCHA',
      message: '图形验证码错误或已过期，请刷新后重试',
    });
  }

  // ── 防重复发送：验证码未过期则不重复发送 ──
  const existingCode = await getSmsCode(phone);
  if (existingCode) {
    const remainingTTL = await getSmsCodeTTL(phone);
    return res.status(429).json({
      success: false,
      code: 'CODE_ALREADY_SENT',
      message: `验证码已发送，请 ${remainingTTL} 秒后再试`,
      data: { remainingSeconds: remainingTTL },
    });
  }

  // ── 生成 6 位随机验证码 ──
  const smsCode = String(Math.floor(100000 + Math.random() * 900000));

  // ── 存入 Redis（5 分钟有效期）──
  await saveSmsCode(phone, smsCode);

  // ── 模拟发送短信（实际项目接入短信服务商 SDK）──
  console.log(`[短信] 向 ${phone} 发送验证码: ${smsCode}（有效期 ${SMS_CODE_TTL / 60} 分钟）`);

  res.json({
    success: true,
    message: '验证码已发送，请注意查收',
    // 仅开发环境返回验证码，生产环境必须删除！
    ...(process.env.NODE_ENV !== 'production' && { devCode: smsCode }),
  });
});

// ─── 校验短信验证码 ──────────────────────────────────────────────

/**
 * POST /api/captcha/verify-sms
 * 校验用户输入的短信验证码
 *
 * Body: { phone, code }
 */
router.post('/verify-sms', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_PARAMS',
      message: '参数不完整',
    });
  }

  const storedCode = await getSmsCode(phone);

  if (!storedCode) {
    return res.status(400).json({
      success: false,
      code: 'CODE_EXPIRED',
      message: '验证码已过期，请重新获取',
    });
  }

  if (storedCode !== code) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CODE',
      message: '验证码错误，请重新输入',
    });
  }

  res.json({
    success: true,
    message: '验证码校验通过',
  });
});

module.exports = router;
