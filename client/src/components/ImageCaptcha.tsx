import React, { useEffect } from 'react';
import { Button, Input, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import request from '../utils/request';

interface ImageCaptchaResponse {
  success: boolean;
  data: {
    sessionId: string;
    svg: string;
  };
}

interface ImageCaptchaProps {
  value?: string;
  onChange?: (value: string) => void;
  onSessionIdChange: (sessionId: string) => void;
}

async function fetchImageCaptcha(): Promise<ImageCaptchaResponse> {
  return request.get('/api/captcha/image');
}

const ImageCaptcha: React.FC<ImageCaptchaProps> = ({ value, onChange, onSessionIdChange }) => {
  const {
    data: captchaData,
    loading,
    run: refreshCaptcha,
  } = useRequest(fetchImageCaptcha, {
    onSuccess(result) {
      onSessionIdChange(result.data.sessionId);
    },
    onError(error: unknown) {
      console.error('获取图形验证码失败:', error);
    },
  });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Input
        placeholder="请输入图形验证码"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        style={{ flex: 1 }}
        maxLength={4}
        allowClear
      />

      {/* 图形验证码展示区 */}
      <div
        style={{
          width: 120,
          height: 40,
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f4ff',
          flexShrink: 0,
        }}
        title="点击刷新验证码"
        onClick={refreshCaptcha}
      >
        {loading ? (
          <Spin size="small" />
        ) : captchaData?.data?.svg ? (
          <div
            dangerouslySetInnerHTML={{ __html: captchaData.data.svg }}
            style={{ lineHeight: 0 }}
          />
        ) : (
          <span style={{ fontSize: 12, color: '#999' }}>加载失败</span>
        )}
      </div>

      {/* 刷新按钮 */}
      <Button
        icon={<ReloadOutlined />}
        onClick={refreshCaptcha}
        loading={loading}
        size="small"
        type="text"
        title="刷新验证码"
      />
    </div>
  );
};

export default ImageCaptcha;
