const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export type UserRole = 'superadmin' | 'admin' | 'therapist' | 'parent' | 'child';

export interface User {
  id: number;
  name: string;
  role: UserRole;
  email: string | null;
  pin_code: string | null;
  parent_id: number | null;
  therapist_id: number | null;
  created_by: number | null;
  age: number | null;
  is_active: number;
  created_at: string;
  // optional joined fields
  total_attempts?: number;
  avg_accuracy?: number;
  last_active?: string | null;
}

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

async function request(endpoint: string, options: RequestOptions = {}) {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
    } else if (typeof body === 'string') {
      config.body = body;
    } else {
      config.headers = { ...config.headers, 'Content-Type': 'application/json' };
      config.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BACKEND_URL}${endpoint}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function form(data: Record<string, any>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) p.append(k, String(v));
  }
  return p.toString();
}

// ── Auth ─────────────────────────────────────
export function loginWithEmail(email: string, password: string) {
  return request('/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ email, password }),
    skipAuth: true,
  });
}

export function loginWithPin(pinCode: string) {
  return request('/auth/pin/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ pin_code: pinCode }),
    skipAuth: true,
  });
}

// keep old name for backward compat
export const authByPin = loginWithPin;

export function registerParent(name: string, email: string, password: string) {
  return request('/auth/register/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ name, email, password }),
    skipAuth: true,
  });
}

export function getCurrentUser() {
  return request('/auth/me/');
}

// ── Users ─────────────────────────────────────
export function getUsers(role?: string) {
  const q = role ? `?role=${role}` : '';
  return request(`/users/${q}`);
}

export function getUser(userId: number) {
  return request(`/users/${userId}/`);
}

export function createUser(data: {
  name: string;
  role: string;
  email?: string;
  password?: string;
  pin_code?: string;
  parent_id?: number;
  therapist_id?: number;
  age?: number;
}) {
  return request('/users/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(data),
  });
}

export function updateUser(userId: number, data: Partial<{
  name: string; email: string; age: number; therapist_id: number; is_active: number;
}>) {
  return request(`/users/${userId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(data),
  });
}

export function deleteUser(userId: number) {
  return request(`/users/${userId}/`, { method: 'DELETE' });
}

// ── Parent ────────────────────────────────────
export function getParentChildren(parentId: number) {
  return request(`/parent/${parentId}/children/`);
}

export function addChild(parentId: number, data: {
  name: string; pin_code: string; age?: number; therapist_id?: number;
}) {
  return request(`/parent/${parentId}/children/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(data),
  });
}

// ── Therapist ─────────────────────────────────
export function getTherapistPatients(therapistId: number) {
  return request(`/therapist/${therapistId}/patients/`);
}

// ── Stats / Attempts ──────────────────────────
export function getUserStats(userId: number) {
  return request(`/users/${userId}/stats/`);
}

export function getUserAttempts(userId: number, limit = 20) {
  return request(`/users/${userId}/attempts/?limit=${limit}`);
}

export function getProblemSounds(userId: number) {
  return request(`/users/${userId}/problem-sounds/`);
}

// ── Audio ─────────────────────────────────────
export function analyzeAudio(file: Blob, targetWord: string, userId?: number) {
  const fd = new FormData();
  fd.append('file', file, 'recording.webm');
  fd.append('target_word', targetWord);
  if (userId) fd.append('user_id', String(userId));
  return request('/analyze-audio/', { method: 'POST', body: fd });
}

export function getHealth() {
  return request('/');
}