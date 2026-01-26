const DEFAULT_API_BASE =
  typeof window === 'undefined' ? '' : window.location.origin;
const API_BASE =
  process.env.REACT_APP_API_BASE?.replace(/\/$/, '') || DEFAULT_API_BASE;

export async function apiGet(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const extraHeaders = options.headers || {};
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    const message = `API 요청 실패: ${response.status} ${response.statusText}`;
    throw new Error(message);
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
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const fallback = await response.text();
    const message = fallback
      ? `API 요청 실패: ${response.status} ${response.statusText} - ${fallback}`
      : `API 요청 실패: ${response.status} ${response.statusText}`;
    throw new Error(message);
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
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const fallback = await response.text();
    const message = fallback
      ? `API 요청 실패: ${response.status} ${response.statusText} - ${fallback}`
      : `API 요청 실패: ${response.status} ${response.statusText}`;
    throw new Error(message);
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
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    const message = `API 요청 실패: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
