import AsyncStorage from '@react-native-async-storage/async-storage';

// Update this to your local machine IP when testing on a real device
export const BACKEND_URL = 'http://127.0.0.1:8000';

export type UserRole = 'superadmin' | 'admin' | 'therapist' | 'parent' | 'child';

export interface User {
  id: number;
  name: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  parent_id: number | null;
  therapist_id: number | null;
  age: number | null;
  is_active: number;
  created_at: string;
  total_attempts?: number;
  avg_accuracy?: number;
  last_active?: string | null;
}

export interface PhonemeError {
  operation: string;
  target_phoneme: string;
  actual_phoneme: string;
  target_letter: string;
  actual_letter: string;
  disorder: string;
  description: string;
  severity: 'mild' | 'moderate' | 'severe';
  position: 'initial' | 'medial' | 'final';
}

export interface DisorderFound {
  disorder: string;
  severity: 'mild' | 'moderate' | 'severe';
  errors: string[];
  recommendations: string[];
}

export interface PhonemeAnalysis {
  target_phonemes: string[];
  actual_phonemes: string[];
  phoneme_errors: PhonemeError[];
  disorders_found: DisorderFound[];
  overall_severity: 'none' | 'mild' | 'moderate' | 'severe';
  severity_label: string;
  severity_detail: string;
  recommendations: string[];
  edit_distance: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  xp_bonus: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface Gamification {
  xp: number;
  level: number;
  streak_days: number;
  total_stars: number;
  xp_current_level: number;
  xp_next_level: number | null;
  achievements: Achievement[];
  // Returned per-attempt:
  stars_earned?: number;
  xp_earned?: number;
  level_up?: boolean;
  old_level?: number;
  new_level?: number;
  unlocked_achievements?: Achievement[];
  streak?: number;
  bonus_xp?: number;
}

export interface AnalysisResult {
  status: string;
  message: string;
  transcription: string;
  target_word: string;
  accuracy: number;
  detected_errors: string[];
  phoneme_analysis?: PhonemeAnalysis;
  processing_time_ms: number;
  attempt_id?: number;
  gamification?: Gamification;
}

export interface PlanExercise {
  id: number;
  plan_id: number;
  sound: string;
  sound_letter: string;
  words: string;       // JSON string, parse with JSON.parse
  target_accuracy: number;
  order_index: number;
  sessions_target: number;
}

export interface Plan {
  id: number;
  child_id: number;
  therapist_id: number;
  title: string;
  description: string;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  exercises: PlanExercise[];
  child_name?: string;
  child_age?: number | null;
}

// ── Internal request helper ───────────────────────────────────────────────────

async function request(endpoint: string, options: {
  method?: string;
  body?: FormData | string | null;
  headers?: Record<string, string>;
  skipAuth?: boolean;
} = {}) {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;
  const token = await AsyncStorage.getItem('authToken');

  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body instanceof FormData) {
    config.body = body;
    // Don't set Content-Type for FormData — let the browser set it with boundary
  } else if (body) {
    config.body = body;
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log(`[API] ${method} ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error(`[API] Timeout after 10s: ${url}`);
  }, 10_000);

  let res: Response;
  try {
    res = await fetch(url, { ...config, signal: controller.signal });
  } catch (networkErr: any) {
    if (networkErr?.name === 'AbortError') {
      throw new Error(`Сервер не отвечает 10 сек (${BACKEND_URL}). Проверь IP и что бэкенд запущен.`);
    }
    console.error(`[API] Network error for ${url}:`, networkErr);
    throw new Error(`Нет связи с сервером (${BACKEND_URL}). Проверь IP и что бэкенд запущен.`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let errBody: any;
    try {
      errBody = await res.json();
    } catch {
      errBody = { detail: `HTTP ${res.status} ${res.statusText}` };
    }
    console.error(`[API] HTTP ${res.status} from ${url}:`, errBody);
    throw new Error(errBody.detail || errBody.message || `Ошибка сервера (HTTP ${res.status})`);
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

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Login with phone number or email + password (works for all roles). */
export function loginWithPhone(login: string, password: string) {
  console.log(`[API] loginWithPhone: login="${login}", backend=${BACKEND_URL}`);
  return request('/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ login, password }),
    skipAuth: true,
  });
}

/** @deprecated use loginWithPhone */
export function loginWithEmail(email: string, password: string) {
  return loginWithPhone(email, password);
}

export function getCurrentUser() {
  return request('/auth/me/');
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function getUsers(role?: string) {
  return request(`/users/${role ? `?role=${role}` : ''}`);
}

export function getUser(userId: number) {
  return request(`/users/${userId}/`);
}

export function createUser(data: {
  name: string; role: string; email?: string; password?: string;
  pin_code?: string; parent_id?: number; therapist_id?: number; age?: number;
}) {
  return request('/users/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(data),
  });
}

export function deleteUser(userId: number) {
  return request(`/users/${userId}/`, { method: 'DELETE' });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getUserStats(userId: number) {
  return request(`/users/${userId}/stats/`);
}

export function getUserAttempts(userId: number, limit = 20) {
  return request(`/users/${userId}/attempts/?limit=${limit}`);
}

// ── Parent / Therapist ────────────────────────────────────────────────────────

export function getParentChildren(parentId: number) {
  return request(`/parent/${parentId}/children/`);
}

export function addChild(parentId: number, data: {
  name: string; phone: string; password: string; age?: number; therapist_id?: number;
}) {
  return request(`/parent/${parentId}/children/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(data),
  });
}

export function getTherapistPatients(therapistId: number) {
  return request(`/therapist/${therapistId}/patients/`);
}

// ── Audio analysis ────────────────────────────────────────────────────────────

export async function analyzeAudio(
  uri: string,
  targetWord: string,
  userId?: number,
  sound?: string,
): Promise<AnalysisResult> {
  const fd = new FormData();
  fd.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' } as any);
  fd.append('target_word', targetWord);
  if (userId) fd.append('user_id', String(userId));
  if (sound) fd.append('sound', sound);

  return request('/analyze-audio/', { method: 'POST', body: fd });
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export function getActivePlan(childId: number): Promise<{ plan: Plan | null }> {
  return request(`/children/${childId}/plan/`);
}

export function getChildPlans(childId: number): Promise<{ plans: Plan[] }> {
  return request(`/children/${childId}/plans/`);
}

export function getTherapistPlans(therapistId: number): Promise<{ plans: Plan[] }> {
  return request(`/therapist/${therapistId}/plans/`);
}

export function createPlan(data: {
  child_id: number;
  title: string;
  description: string;
  exercises: Array<{
    sound: string;
    sound_letter: string;
    words: string[];
    target_accuracy: number;
    sessions_target: number;
  }>;
}) {
  return request('/plans/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      child_id:    data.child_id,
      title:       data.title,
      description: data.description,
      exercises:   JSON.stringify(data.exercises),
    }),
  });
}

export function updatePlanStatus(planId: number, status: string) {
  return request(`/plans/${planId}/status/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ status }),
  });
}

export function deletePlan(planId: number) {
  return request(`/plans/${planId}/`, { method: 'DELETE' });
}

// ── Gamification ──────────────────────────────────────────────────────────────

export function getChildGamification(childId: number): Promise<Gamification & { status: string }> {
  return request(`/children/${childId}/gamification/`);
}

export function getChildAchievements(childId: number): Promise<{ status: string; achievements: Achievement[] }> {
  return request(`/children/${childId}/achievements/`);
}
