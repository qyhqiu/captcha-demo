const svgCaptcha = require('svg-captcha');

/**
 * 生成图形验证码
 * @returns {{ data: string, text: string }} SVG 字符串和验证码文字
 */
function generateImageCaptcha() {
  const captcha = svgCaptcha.create({
    size: 4,           // 验证码字符数
    ignoreChars: '0o1iIlL', // 排除易混淆字符
    noise: 3,          // 干扰线数量
    color: true,       // 彩色字符
    background: '#f0f4ff', // 背景色
    width: 120,
    height: 40,
    fontSize: 40,
  });

  return {
    data: captcha.data,   // SVG 字符串
    text: captcha.text,   // 验证码文字（用于服务端存储校验）
  };
}

module.exports = { generateImageCaptcha };
