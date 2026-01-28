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

export async function apiGet(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const extraHeaders = options.headers || {};
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
      ...extraHeaders,
    },
  });

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

  return response.json();
}

export async function apiPost(path, body, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const extraHeaders = options.headers || {};
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

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

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function apiPatch(path, body, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const extraHeaders = options.headers || {};
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

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

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function apiDelete(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const extraHeaders = options.headers || {};
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
      ...extraHeaders,
    },
  });

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

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
