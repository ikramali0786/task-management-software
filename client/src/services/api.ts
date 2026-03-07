import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // For refresh token cookie
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000, // 30 s — prevents infinite hang when Render backend is sleeping
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Never intercept 401s from credential-based auth endpoints — a failed login,
    // registration, or refresh should surface directly to the caller.
    // NOTE: /auth/me IS a protected endpoint that needs the refresh flow,
    // so we only block the specific endpoints that don't need token refresh.
    const AUTH_NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
    const isAuthRoute = AUTH_NO_RETRY.some((path) => originalRequest.url?.includes(path));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err: any) {
        processQueue(err, null);
        // Only redirect to login when the refresh token is truly invalid (401/403).
        // Network errors or 5xx during a cold-start shouldn't evict the user.
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
