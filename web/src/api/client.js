const DEFAULT_API_BASE =
  typeof window === 'undefined' ? '' : window.location.origin;
const API_BASE =
  process.env.REACT_APP_API_BASE?.replace(/\/$/, '') || DEFAULT_API_BASE;

// Helper to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Core Request Function with Auto-Refresh Logic
 */
async function request(path, method, body = null, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const extraHeaders = options.headers || {};

  const config = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...extraHeaders,
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
      delete config.headers['Content-Type']; // Let browser set boundary
    } else {
      config.body = JSON.stringify(body);
    }
  }

  // Allow overriding/removing Content-Type (e.g. for FormData) manually if needed
  if (extraHeaders['Content-Type'] === null) {
    delete config.headers['Content-Type'];
  }

  let response = await fetch(url, config);

  // 1. If 401 Unauthorized, try to refresh token
  // Skip refresh if we are already on the login endpoint or refresh endpoint
  if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    if (isRefreshing) {
      try {
        await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        // Retry with new token
        config.headers = {
          ...config.headers,
          ...getAuthHeaders(),
        };
        return await fetch(url, config);
      } catch (error) {
        throw error;
      }
    }

    isRefreshing = true;

    try {
      // Attempt refresh
      const refreshResponse = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json' }, // Credentials (cookies) sent automatically by browser
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        // Update Token
        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }

        // Notify waiting requests
        processQueue(null);

        // Retry original request with new token
        config.headers = {
          ...config.headers,
          ...getAuthHeaders(),
        };
        response = await fetch(url, config);
      } else {
        // Refresh failed (session expired completely)
        const err = new Error('Session expired');
        processQueue(err);
        handleSessionExpiry();
        throw err;
      }
    } catch (e) {
      processQueue(e);
      handleSessionExpiry();
      throw e;
    } finally {
      isRefreshing = false;
    }
  }

  // 2. Handle final response (success or other errors)
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    const error = new Error(errorData.message || `API 요청 실패: ${response.status}`);
    error.response = { data: errorData, status: response.status };
    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return null;
  }

  // 200 OK but empty body, or 204 No Content
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function handleSessionExpiry() {
  console.warn('Session expired. Logging out...');
  localStorage.removeItem('access_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('keep_logged_in');
  // Trigger storage event for other tabs/components
  window.dispatchEvent(new Event('storage'));

  // Optional: Redirect to login if not already there
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Export wrappers for compatibility
export function apiGet(path, options = {}) {
  return request(path, 'GET', null, options);
}

export function apiPost(path, body, options = {}) {
  return request(path, 'POST', body, options);
}

export function apiPatch(path, body, options = {}) {
  return request(path, 'PATCH', body, options);
}

export function apiDelete(path, options = {}) {
  return request(path, 'DELETE', null, options);
}
