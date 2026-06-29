const { isBlacklisted, recordAndCheckRequestFrequency } = require('../utils/redis');

// 允许的 Referer 来源（生产环境应配置实际域名）
const ALLOWED_REFERERS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

// 可疑 UA 关键词（爬虫/自动化工具特征）
const SUSPICIOUS_UA_PATTERNS = [
  /python-requests/i,
  /curl\//i,
  /wget\//i,
  /scrapy/i,
  /httpie/i,
  /go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /^$/,  // 空 UA
];

/**
 * Referer + User-Agent 校验中间件（防爬虫）
 */
function validateRequestHeaders(req, res, next) {
  const referer = req.headers['referer'] || req.headers['origin'] || '';
  const userAgent = req.headers['user-agent'] || '';

  // 校验 User-Agent：拒绝可疑爬虫特征
  const isSuspiciousUA = SUSPICIOUS_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
  if (isSuspiciousUA) {
    console.warn(`[安全] 可疑 UA 被拦截: "${userAgent}" | IP: ${getClientIP(req)}`);
    return res.status(403).json({
      success: false,
      code: 'INVALID_UA',
      message: '请求来源不合法',
    });
  }

  // 校验 Referer：必须来自允许的域名
  const isValidReferer =
    referer === '' || // 允许直接访问（部分浏览器不发送 Referer）
    ALLOWED_REFERERS.some((allowed) => referer.startsWith(allowed));

  if (!isValidReferer) {
    console.warn(`[安全] 非法 Referer 被拦截: "${referer}" | IP: ${getClientIP(req)}`);
    return res.status(403).json({
      success: false,
      code: 'INVALID_REFERER',
      message: '请求来源不合法',
    });
  }

  next();
}

/**
 * 黑名单检查 + 请求频率统计中间件
 * 同时对手机号和 IP 进行双重检查
 */
async function checkBlacklistAndFrequency(req, res, next) {
  const clientIP = getClientIP(req);
  const phone = req.body?.phone || req.query?.phone || '';

  // 检查 IP 是否在黑名单
  const isIPBlacklisted = await isBlacklisted(`ip:${clientIP}`);
  if (isIPBlacklisted) {
    console.warn(`[黑名单] IP 被拦截: ${clientIP}`);
    return res.status(429).json({
      success: false,
      code: 'BLACKLISTED',
      message: '操作过于频繁，请稍后再试',
    });
  }

  // 检查手机号是否在黑名单
  if (phone) {
    const isPhoneBlacklisted = await isBlacklisted(`phone:${phone}`);
    if (isPhoneBlacklisted) {
      console.warn(`[黑名单] 手机号被拦截: ${phone}`);
      return res.status(429).json({
        success: false,
        code: 'BLACKLISTED',
        message: '该号码操作过于频繁，请稍后再试',
      });
    }
  }

  // 记录 IP 请求频率
  const ipFrequency = await recordAndCheckRequestFrequency(`ip:${clientIP}`);
  if (ipFrequency.blocked) {
    return res.status(429).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: '请求过于频繁，已被临时限制，请 10 分钟后再试',
    });
  }

  // 记录手机号请求频率
  if (phone) {
    const phoneFrequency = await recordAndCheckRequestFrequency(`phone:${phone}`);
    if (phoneFrequency.blocked) {
      return res.status(429).json({
        success: false,
        code: 'TOO_MANY_REQUESTS',
        message: '该号码请求过于频繁，已被临时限制，请 10 分钟后再试',
      });
    }
  }

  next();
}

/**
 * 获取真实客户端 IP（兼容代理场景）
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = {
  validateRequestHeaders,
  checkBlacklistAndFrequency,
  getClientIP,
};
