import React, { useRef, useState } from 'react';
import {
  Button,
  Form,
  Input,
  message,
  Card,
  Typography,
  Space,
  Tag,
  Divider,
  Alert,
} from 'antd';
import {
  MobileOutlined,
  SafetyOutlined,
  LockOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useCountDown, useRequest } from 'ahooks';
import ImageCaptcha from './ImageCaptcha';
import request from '../utils/request';

const { Title, Text } = Typography;

// 倒计时目标时间（60 秒后）
const COUNTDOWN_SECONDS = 60;

interface SendSmsResponse {
  success: boolean;
  message: string;
  devCode?: string;
  data?: { remainingSeconds: number };
}

interface VerifySmsResponse {
  success: boolean;
  message: string;
}

const CaptchaForm: React.FC = () => {
  const [form] = Form.useForm();

  // 图形验证码 sessionId（由 ImageCaptcha 子组件回传）
  const imageCaptchaSessionIdRef = useRef<string>('');

  // 倒计时目标时间
  const [countdownTarget, setCountdownTarget] = useState<number | undefined>(undefined);

  // 开发模式下展示的验证码（仅用于演示）
  const [devSmsCode, setDevSmsCode] = useState<string>('');

  // 校验结果状态
  const [verifyResult, setVerifyResult] = useState<'success' | 'error' | null>(null);

  // 倒计时 Hook（ahooks）
  const [countdown] = useCountDown({
    targetDate: countdownTarget,
    onEnd() {
      setCountdownTarget(undefined);
    },
  });

  // 剩余秒数（向上取整）
  const remainingSeconds = Math.ceil(countdown / 1000);
  const isCounting = remainingSeconds > 0;

  // ── 发送短信验证码请求 ──────────────────────────────────────────
  const { loading: sendingCode, run: sendSmsCode } = useRequest(
    async (phone: string, imageCaptchaText: string) => {
      const response: SendSmsResponse = await request.post('/api/captcha/send-sms', {
        phone,
        imageCaptchaSessionId: imageCaptchaSessionIdRef.current,
        imageCaptchaText,
      });
      return response;
    },
    {
      manual: true,
      onSuccess(result) {
        message.success(result.message || '验证码已发送');

        // 启动 60 秒倒计时
        setCountdownTarget(Date.now() + COUNTDOWN_SECONDS * 1000);

        // 开发模式：展示验证码
        if (result.devCode) {
          setDevSmsCode(result.devCode);
        }

      },
      onError(error: any) {
        const errorCode = error?.code;
        const errorMessage = error?.message || '发送失败，请稍后重试';

        if (errorCode === 'CODE_ALREADY_SENT' && error?.data?.remainingSeconds) {
          // 服务端告知剩余时间，同步前端倒计时
          const remaining = error.data.remainingSeconds;
          setCountdownTarget(Date.now() + remaining * 1000);
          message.warning(`验证码已发送，请 ${remaining} 秒后再试`);
        } else if (errorCode === 'INVALID_IMAGE_CAPTCHA') {
          message.error('图形验证码错误，请刷新后重试');
          form.setFieldValue('imageCaptchaText', '');
        } else if (errorCode === 'BLACKLISTED' || errorCode === 'TOO_MANY_REQUESTS') {
          message.error(errorMessage);
        } else {
          message.error(errorMessage);
        }
      },
    }
  );

  // ── 校验短信验证码请求 ──────────────────────────────────────────
  const { loading: verifying, run: verifySmsCode } = useRequest(
    async (phone: string, code: string) => {
      const response: VerifySmsResponse = await request.post('/api/captcha/verify-sms', {
        phone,
        code,
      });
      return response;
    },
    {
      manual: true,
      onSuccess(result) {
        message.success(result.message || '验证成功！');
        setVerifyResult('success');
      },
      onError(error: any) {
        message.error(error?.message || '验证码错误');
        setVerifyResult('error');
      },
    }
  );

  // ── 点击"获取验证码"按钮 ────────────────────────────────────────
  const handleSendCode = async () => {
    // 校验手机号和图形验证码字段
    try {
      const values = await form.validateFields(['phone', 'imageCaptchaText']);
      sendSmsCode(values.phone, values.imageCaptchaText);
    } catch {
      // antd Form 校验失败，不做额外处理
    }
  };

  // ── 提交表单（校验短信验证码）──────────────────────────────────
  const handleSubmit = async (values: { phone: string; smsCode: string }) => {
    setVerifyResult(null);
    verifySmsCode(values.phone, values.smsCode);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        bodyStyle={{ padding: '40px 40px 32px' }}
      >
        {/* 标题区 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <LockOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0, color: '#1a1a2e' }}>
            安全验证码系统
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            多重防护 · 安全可靠
          </Text>
        </div>

        {/* 安全特性标签 */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Space wrap size={6}>
            <Tag color="blue" style={{ borderRadius: 20 }}>防 DDoS</Tag>
            <Tag color="green" style={{ borderRadius: 20 }}>防刷机制</Tag>
            <Tag color="purple" style={{ borderRadius: 20 }}>图形预校验</Tag>
            <Tag color="orange" style={{ borderRadius: 20 }}>黑名单</Tag>
            <Tag color="cyan" style={{ borderRadius: 20 }}>接口防抖</Tag>
          </Space>
        </div>

        <Divider style={{ margin: '0 0 24px' }} />

        {/* 主表单 */}
        <Form form={form} autoComplete="off" layout="vertical" onFinish={handleSubmit} size="large">
          {/* 手机号 */}
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input
              prefix={<MobileOutlined style={{ color: '#bbb' }} />}
              placeholder="请输入手机号"
              maxLength={11}
            />
          </Form.Item>

          {/* 图形验证码 */}
          <Form.Item
            name="imageCaptchaText"
            label={
              <span>
                图形验证码
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  （发送前必须通过图形验证）
                </Text>
              </span>
            }
            rules={[
              { required: true, message: '请输入图形验证码' },
              { len: 4, message: '请输入 4 位图形验证码' },
            ]}
          >
            <ImageCaptcha
              onSessionIdChange={(sessionId) => {
                imageCaptchaSessionIdRef.current = sessionId;
              }}
            />
          </Form.Item>

          {/* 短信验证码 */}
          <Form.Item
            name="smsCode"
            label="短信验证码"
            rules={[
              { required: true, message: '请输入短信验证码' },
              { len: 6, message: '请输入 6 位验证码' },
            ]}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                prefix={<SafetyOutlined style={{ color: '#bbb' }} />}
                placeholder="请输入 6 位验证码"
                maxLength={6}
                style={{ flex: 1 }}
              />
              {/* 获取验证码按钮（含防抖倒计时） */}
              <Button
                type="primary"
                onClick={handleSendCode}
                loading={sendingCode}
                disabled={isCounting}
                style={{
                  minWidth: 120,
                  background: isCounting ? undefined : 'linear-gradient(135deg, #667eea, #764ba2)',
                  border: 'none',
                  borderRadius: 8,
                }}
              >
                {isCounting ? `${remainingSeconds}s 后重试` : '获取验证码'}
              </Button>
            </div>
          </Form.Item>

          {/* 开发模式提示：展示验证码 */}
          {devSmsCode && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 8 }}
              message={
                <span>
                  <Text strong>【开发模式】</Text> 验证码：
                  <Text code style={{ fontSize: 16, color: '#764ba2' }}>
                    {devSmsCode}
                  </Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    （生产环境不会展示）
                  </Text>
                </span>
              }
            />
          )}

          {/* 校验结果提示 */}
          {verifyResult === 'success' && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="验证码校验通过，身份验证成功！"
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}
          {verifyResult === 'error' && (
            <Alert
              type="error"
              showIcon
              message="验证码错误或已过期，请重新获取"
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}

          {/* 提交按钮 */}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={verifying}
              block
              style={{
                height: 48,
                fontSize: 16,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
              }}
            >
              验证并登录
            </Button>
          </Form.Item>
        </Form>

        {/* 底部安全说明 */}
        <div style={{ marginTop: 24, padding: '16px', background: '#f8f9ff', borderRadius: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            🔐 <Text strong style={{ fontSize: 12 }}>安全防护说明：</Text>
            验证码有效期 5 分钟，未过期不重复发送；
            同一手机号 1 分钟内超过 5 次请求将被临时封禁 10 分钟。
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default CaptchaForm;
