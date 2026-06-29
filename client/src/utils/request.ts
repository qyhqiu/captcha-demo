import axios from 'axios';

const request = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorData = error.response?.data;
    return Promise.reject(errorData || error);
  }
);

export default request;
