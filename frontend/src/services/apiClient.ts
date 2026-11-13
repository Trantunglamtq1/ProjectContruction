import axios from 'axios';
import { message } from 'antd';
import { getSelectedProjectId, PROJECT_ACCESS_DENIED } from './projectScope';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token
apiClient.interceptors.request.use(
  (config) => {
    // Keep credentials on this application's API only.
    if (!config.url?.startsWith('/') || config.url.startsWith('//') || config.baseURL !== '/api') {
      return Promise.reject(new Error('Đường dẫn API không hợp lệ.'));
    }
    const projectId = getSelectedProjectId();
    if (projectId && config.method === 'get' && /^\/(drawings(?:\/by-name\/[^/]+)?|objects|checklists|inspections)$/.test(config.url)) {
      config.params = { ...config.params, projectId };
    }
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    let responseData = error.response?.data;
    if (error.response?.status === 403 && responseData instanceof Blob) {
      try { responseData = JSON.parse(await responseData.text()); } catch { /* Non-JSON forbidden response. */ }
    }
    if (error.response?.status === 403 && responseData?.code === 'project_access_denied') {
      window.dispatchEvent(new Event(PROJECT_ACCESS_DENIED));
    }
    if (error.response && error.response.status === 401) {
      // Clear token & cached user info
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Only show warning if not currently on login or register page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/auth/login') && !currentPath.includes('/auth/register')) {
        message.warning('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
