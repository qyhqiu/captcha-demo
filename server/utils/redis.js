const Redis = require('ioredis');

// Redis 连接配置（本地开发默认配置）
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    // 最多重试 3 次，每次间隔 500ms
    if (times > 3) return null;
    return 500;
  },
});

redis.on('connect', () => {
  console.log('[Redis] 连接成功');
});

redis.on('error', (error) => {
  console.error('[Redis] 连接失败:', error.message);
});

// ─── 验证码相关操作 ─────────────────────────────────────────────

const SMS_CODE_PREFIX = 'sms:code:';
const SMS_CODE_TTL = 5 * 60; // 5 分钟（秒）

/**
 * 保存短信验证码
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 */
async function saveSmsCode(phone, code) {
  const key = `${SMS_CODE_PREFIX}${phone}`;
  await redis.setex(key, SMS_CODE_TTL, code);
}

/**
 * 获取短信验证码（用于判断是否已存在未过期的验证码）
 * @param {string} phone - 手机号
 * @returns {string|null}
 */
async function getSmsCode(phone) {
  const key = `${SMS_CODE_PREFIX}${phone}`;
  return redis.get(key);
}

/**
 * 获取验证码剩余有效期（秒）
 * @param {string} phone - 手机号
 * @returns {number} 剩余秒数，-2 表示不存在，-1 表示永不过期
 */
async function getSmsCodeTTL(phone) {
  const key = `${SMS_CODE_PREFIX}${phone}`;
  return redis.ttl(key);
}

/**
 * 删除短信验证码
 * @param {string} phone - 手机号
 */
async function deleteSmsCode(phone) {
  const key = `${SMS_CODE_PREFIX}${phone}`;
  await redis.del(key);
}

// ─── 图形验证码相关操作 ──────────────────────────────────────────

const IMAGE_CAPTCHA_PREFIX = 'img:captcha:';
const IMAGE_CAPTCHA_TTL = 5 * 60; // 5 分钟

/**
 * 保存图形验证码答案
 * @param {string} sessionId - 会话 ID
 * @param {string} text - 验证码文字
 */
async function saveImageCaptcha(sessionId, text) {
  const key = `${IMAGE_CAPTCHA_PREFIX}${sessionId}`;
  await redis.setex(key, IMAGE_CAPTCHA_TTL, text.toLowerCase());
}

/**
 * 校验并消费图形验证码（一次性使用）
 * @param {string} sessionId - 会话 ID
 * @param {string} inputText - 用户输入
 * @returns {boolean}
 */
async function verifyAndConsumeImageCaptcha(sessionId, inputText) {
  const key = `${IMAGE_CAPTCHA_PREFIX}${sessionId}`;
  const storedText = await redis.get(key);
  if (!storedText) return false;
  const isValid = storedText === inputText.toLowerCase();
  if (isValid) {
    // 校验通过后立即删除，防止重复使用
    await redis.del(key);
  }
  return isValid;
}

// ─── 黑名单相关操作 ──────────────────────────────────────────────

const BLACKLIST_PREFIX = 'blacklist:';
const BLACKLIST_TTL = 10 * 60; // 黑名单封禁 10 分钟

const REQUEST_COUNT_PREFIX = 'req:count:';
const REQUEST_COUNT_TTL = 60; // 1 分钟内的请求计数窗口
const MAX_REQUESTS_PER_MINUTE = 5; // 1 分钟内最多 5 次请求

/**
 * 检查是否在黑名单中
 * @param {string} identifier - 手机号或 IP
 * @returns {boolean}
 */
async function isBlacklisted(identifier) {
  const key = `${BLACKLIST_PREFIX}${identifier}`;
  const result = await redis.get(key);
  return result !== null;
}

/**
 * 加入黑名单
 * @param {string} identifier - 手机号或 IP
 */
async function addToBlacklist(identifier) {
  const key = `${BLACKLIST_PREFIX}${identifier}`;
  await redis.setex(key, BLACKLIST_TTL, '1');
  console.log(`[黑名单] ${identifier} 已被加入黑名单，封禁 ${BLACKLIST_TTL / 60} 分钟`);
}

/**
 * 记录请求次数，超过阈值则加入黑名单
 * @param {string} identifier - 手机号或 IP
 * @returns {{ count: number, blocked: boolean }}
 */
async function recordAndCheckRequestFrequency(identifier) {
  const countKey = `${REQUEST_COUNT_PREFIX}${identifier}`;
  const count = await redis.incr(countKey);

  // 第一次请求时设置过期时间
  if (count === 1) {
    await redis.expire(countKey, REQUEST_COUNT_TTL);
  }

  if (count > MAX_REQUESTS_PER_MINUTE) {
    await addToBlacklist(identifier);
    return { count, blocked: true };
  }

  return { count, blocked: false };
}

module.exports = {
  redis,
  saveSmsCode,
  getSmsCode,
  getSmsCodeTTL,
  deleteSmsCode,
  saveImageCaptcha,
  verifyAndConsumeImageCaptcha,
  isBlacklisted,
  addToBlacklist,
  recordAndCheckRequestFrequency,
  SMS_CODE_TTL,
};
