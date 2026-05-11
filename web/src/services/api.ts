const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function request(endpoint: string, options: RequestOptions = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
    } else {
      config.headers = { ...config.headers, 'Content-Type': 'application/json' };
      config.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BACKEND_URL}${endpoint}`, config);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: 'Ошибка сервера' }));
    throw new Error(errorBody.detail || errorBody.message || `HTTP ${res.status}`);
  }

  return res.json();
}

function encodeForm(data: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return params;
}

// Auth
export function authByPin(pinCode: string) {
  return request('/auth/pin/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm({ pin_code: pinCode }).toString(),
  });
}

export function getCurrentUser() {
  return request('/auth/me/');
}

// Users
export function createUser(data: {
  name: string;
  role: 'child' | 'parent' | 'therapist';
  pin_code?: string;
  email?: string;
  parent_id?: number;
  therapist_id?: number;
  age?: number;
}) {
  return request('/users/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm(data).toString(),
  });
}

export function getUsers(role?: string) {
  const query = role ? `?role=${role}` : '';
  return request(`/users/${query}`);
}

export function getUser(userId: number) {
  return request(`/users/${userId}/`);
}

export function getUserStats(userId: number) {
  return request(`/users/${userId}/stats/`);
}

export function getUserAttempts(userId: number, limit = 20) {
  return request(`/users/${userId}/attempts/?limit=${limit}`);
}

export function getProblemSounds(userId: number) {
  return request(`/users/${userId}/problem-sounds/`);
}

export function getTherapistPatients(therapistId: number) {
  return request(`/therapist/${therapistId}/patients/`);
}

// Audio
export function analyzeAudio(file: Blob, targetWord: string, userId?: number) {
  const formData = new FormData();
  formData.append('file', file, 'recording.webm');
  formData.append('target_word', targetWord);
  if (userId) {
    formData.append('user_id', String(userId));
  }

  return request('/analyze-audio/', {
    method: 'POST',
    body: formData,
  });
}

// Server health
export function getHealth() {
  return request('/');
}