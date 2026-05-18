import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getParentChildren,
  getUserStats,
  type User,
} from '@/services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SoundProgress {
  sound: string;
  accuracy: number;
  attempts_count: number;
}

interface RecentAttempt {
  id: number;
  target_word: string;
  transcription: string;
  accuracy: number;
  created_at: string;
}

interface ChildStats {
  total_attempts: number;
  avg_accuracy: number;
  total_minutes: number;
  sound_progress: SoundProgress[];
  recent_attempts: RecentAttempt[];
  attempt_trend: number;
  problem_sounds: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return Colors.green;
  if (accuracy >= 50) return Colors.orange;
  return Colors.coral;
}

function formatLastActive(lastActive: string | null | undefined): string {
  if (!lastActive) return 'Нет активности';
  const date = new Date(lastActive);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  return `${diffDays} дней назад`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

const SOUND_PALETTE = [Colors.sky, Colors.coral, Colors.purple, Colors.orange, Colors.green, Colors.mint];
function getSoundColor(index: number): string {
  return SOUND_PALETTE[index % SOUND_PALETTE.length];
}

// ── Phone formatter ───────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const d = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
  const n = d.startsWith('7') ? d : d.length ? '7' + d : '';
  if (n.length === 0) return '';
  if (n.length <= 1)  return '+7';
  if (n.length <= 4)  return `+7 (${n.slice(1)}`;
  if (n.length <= 7)  return `+7 (${n.slice(1,4)}) ${n.slice(4)}`;
  if (n.length <= 9)  return `+7 (${n.slice(1,4)}) ${n.slice(4,7)}-${n.slice(7)}`;
  return               `+7 (${n.slice(1,4)}) ${n.slice(4,7)}-${n.slice(7,9)}-${n.slice(9,11)}`;
}
function unformatPhone(f: string): string {
  const d = f.replace(/\D/g, '');
  return d.startsWith('8') ? '+7' + d.slice(1) : '+' + d;
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function ParentLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bearSway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bearSway, { toValue: -6, duration: 900, useNativeDriver: true }),
        Animated.timing(bearSway, { toValue: 6, duration: 900, useNativeDriver: true }),
        Animated.timing(bearSway, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    const clean = unformatPhone(phone);
    if (clean.replace(/\D/g,'').length < 11 || !password) { setError('Заполни все поля'); return; }
    setIsLoading(true); setError('');
    try {
      const user = await login(clean, password);
      if (user.role !== 'parent') { setError('Этот аккаунт не является родительским'); return; }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Неверный номер телефона или пароль');
    } finally { setIsLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={loginSt.container} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ rotate: bearSway.interpolate({ inputRange: [-6, 6], outputRange: ['-6deg', '6deg'] }) }] }}>
          <View style={loginSt.mascot}><Text style={loginSt.mascotEmoji}>🐻</Text></View>
        </Animated.View>

        <Text style={loginSt.title}>Кабинет родителя</Text>
        <Text style={loginSt.subtitle}>Войди чтобы следить за успехами ребёнка</Text>

        <View style={loginSt.form}>
          <View style={loginSt.field}>
            <Text style={loginSt.label}>📱 Номер телефона</Text>
            <TextInput
              style={loginSt.input}
              placeholder="+7 (___) ___ __ __"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={v => setPhone(formatPhone(v))}
              keyboardType="phone-pad"
              autoCapitalize="none"
              returnKeyType="next"
              maxLength={18}
            />
          </View>

          <View style={loginSt.field}>
            <Text style={loginSt.label}>🔒 Пароль</Text>
            <View style={loginSt.passwordRow}>
              <TextInput
                style={[loginSt.input, { flex: 1 }]}
                placeholder="••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={loginSt.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Text style={loginSt.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={loginSt.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[loginSt.btn, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={loginSt.btnText}>📊 Войти в кабинет</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const loginSt = StyleSheet.create({
  container:   { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl, backgroundColor: Colors.bg },
  mascot:      { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(200,149,108,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, shadowColor: '#C8956C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  mascotEmoji: { fontSize: 56, textAlign: 'center', lineHeight: 110 },
  title:       { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' },
  subtitle:    { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
  form:        { width: '100%', gap: Spacing.md },
  field:       { gap: Spacing.xs },
  label:       { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  input:       { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 54, fontSize: 16, color: Colors.textPrimary },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eyeBtn:      { width: 54, height: 54, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  eyeText:     { fontSize: 20 },
  error:       { fontSize: 14, color: Colors.coral, fontWeight: '600', textAlign: 'center', backgroundColor: Colors.coralLight, borderRadius: Radius.md, padding: Spacing.sm },
  btn:         { backgroundColor: Colors.sky, borderRadius: Radius.lg, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.sky, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnText:     { fontSize: 18, fontWeight: '800', color: '#fff' },
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface DashboardProps {
  parentId: number;
  onLogout: () => void;
}

function Dashboard({ parentId, onLogout }: DashboardProps) {
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [stats, setStats] = useState<ChildStats | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingChildren(true);
      try {
        const data = await getParentChildren(parentId);
        if (!cancelled) {
          setChildren(data.children ?? []);
          if (data.children && data.children.length > 0) {
            setSelectedChildId(data.children[0].id);
          }
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoadingChildren(false); }
    })();
    return () => { cancelled = true; };
  }, [parentId]);

  useEffect(() => {
    if (selectedChildId == null) return;
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      setStats(null);
      try {
        const data = await getUserStats(selectedChildId);
        if (!cancelled) setStats(data.stats ?? null);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoadingStats(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedChildId]);

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? null;

  if (loadingChildren) {
    return (
      <View style={dashStyles.centered}>
        <ActivityIndicator color={Colors.sky} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={dashStyles.header}>
        <View style={dashStyles.headerLeft}>
          <Text style={dashStyles.headerEmoji}>🐻</Text>
          <Text style={dashStyles.headerTitle}>Кабинет Родителя</Text>
        </View>
        <TouchableOpacity style={dashStyles.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Text style={dashStyles.logoutIcon}>↩</Text>
        </TouchableOpacity>
      </View>

      {children.length === 0 ? (
        <View style={dashStyles.centered}>
          <Text style={{ fontSize: 56 }}>👶</Text>
          <Text style={dashStyles.emptyTitle}>Нет детей</Text>
          <Text style={dashStyles.emptySubtitle}>Обратитесь к логопеду для добавления ребёнка</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={dashStyles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Child selector tabs */}
          {children.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={dashStyles.tabsRow}>
                {children.map((child) => {
                  const active = child.id === selectedChildId;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[dashStyles.tab, active && dashStyles.tabActive]}
                      onPress={() => setSelectedChildId(child.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[dashStyles.tabText, active && dashStyles.tabTextActive]}>{child.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Child card */}
          {selectedChild && (
            <View style={dashStyles.childCard}>
              <View style={dashStyles.avatarCircle}>
                <Text style={dashStyles.avatarText}>{selectedChild.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={dashStyles.childName}>{selectedChild.name}</Text>
                {selectedChild.age != null && (
                  <Text style={dashStyles.childAge}>{selectedChild.age} лет</Text>
                )}
                <Text style={dashStyles.childLastActive}>{formatLastActive(selectedChild.last_active)}</Text>
              </View>
            </View>
          )}

          {loadingStats ? (
            <View style={dashStyles.statsLoading}>
              <ActivityIndicator color={Colors.sky} size="large" />
            </View>
          ) : stats ? (
            <>
              {/* Stats grid */}
              <View style={dashStyles.statsGrid}>
                {[
                  { emoji: '⏱', value: stats.total_minutes ?? 0, label: 'минут', color: Colors.sky },
                  { emoji: '🎤', value: stats.total_attempts ?? 0, label: 'попыток', color: Colors.purple },
                  { emoji: '📈', value: `${stats.avg_accuracy != null ? Math.round(stats.avg_accuracy) : 0}%`, label: 'точность', color: Colors.green },
                  { emoji: '⚠️', value: stats.problem_sounds?.length ?? 0, label: 'проблем.', color: Colors.orange },
                ].map((item, i) => (
                  <View key={i} style={[dashStyles.statCard, { borderColor: item.color + '40' }]}>
                    <Text style={dashStyles.statEmoji}>{item.emoji}</Text>
                    <Text style={[dashStyles.statValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={dashStyles.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Sound progress */}
              {stats.sound_progress && stats.sound_progress.length > 0 && (
                <View style={dashStyles.section}>
                  <Text style={dashStyles.sectionTitle}>🔊 ПРОГРЕСС ПО ЗВУКАМ</Text>
                  <View style={{ gap: Spacing.sm }}>
                    {stats.sound_progress.map((sp, idx) => {
                      const color = getSoundColor(idx);
                      const acc = Math.round(sp.accuracy ?? 0);
                      const barColor = getAccuracyColor(sp.accuracy ?? 0);
                      return (
                        <View key={sp.sound} style={[dashStyles.soundRow, { borderColor: color + '30' }]}>
                          <View style={[dashStyles.soundCircle, { backgroundColor: color + '20', borderColor: color + '50' }]}>
                            <Text style={[dashStyles.soundLetter, { color }]}>{sp.sound.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={dashStyles.soundName}>{sp.sound}</Text>
                              <Text style={[dashStyles.soundAccuracy, { color: barColor }]}>{acc}%</Text>
                            </View>
                            <View style={dashStyles.progressBarBg}>
                              <View style={[dashStyles.progressBarFill, { width: `${Math.min(acc, 100)}%` as any, backgroundColor: barColor }]} />
                            </View>
                            <Text style={dashStyles.soundAttempts}>{sp.attempts_count} попыток</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Recent attempts */}
              {stats.recent_attempts && stats.recent_attempts.length > 0 && (
                <View style={dashStyles.section}>
                  <Text style={dashStyles.sectionTitle}>📋 ПОСЛЕДНИЕ ПОПЫТКИ</Text>
                  <View style={{ gap: Spacing.sm }}>
                    {stats.recent_attempts.slice(0, 5).map((att) => {
                      const acc = Math.round(att.accuracy ?? 0);
                      const barColor = getAccuracyColor(att.accuracy ?? 0);
                      return (
                        <View key={att.id} style={dashStyles.attemptRow}>
                          <View style={[dashStyles.attemptIndicator, { backgroundColor: barColor + '20' }]}>
                            <Text style={{ fontSize: 18 }}>{acc >= 80 ? '✅' : '🔄'}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={dashStyles.attemptWord}>{att.target_word}</Text>
                              <Text style={dashStyles.attemptDate}>{formatDate(att.created_at)}</Text>
                            </View>
                            {att.transcription ? (
                              <Text style={dashStyles.attemptTranscription} numberOfLines={1}>«{att.transcription}»</Text>
                            ) : null}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                              <View style={dashStyles.attemptBarBg}>
                                <View style={[dashStyles.attemptBarFill, { width: `${Math.min(acc, 100)}%` as any, backgroundColor: barColor }]} />
                              </View>
                              <Text style={[dashStyles.attemptAccText, { color: barColor }]}>{acc}%</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={dashStyles.noStats}>
              <Text style={{ fontSize: 40 }}>📊</Text>
              <Text style={dashStyles.noStatsText}>Нет данных о прогрессе</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const dashStyles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerEmoji: { fontSize: 28 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  logoutBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.skyLight, justifyContent: 'center', alignItems: 'center',
  },
  logoutIcon: { fontSize: 20, color: Colors.sky, fontWeight: '700' },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: 40, paddingTop: Spacing.md, gap: Spacing.md },
  tabsRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.xs },
  tab: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.sky + '20', borderColor: Colors.sky },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.sky },
  childCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.skyLight,
    padding: Spacing.md,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.sky + '25', borderWidth: 2, borderColor: Colors.sky + '50',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: Colors.sky },
  childName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  childAge: { fontSize: 13, color: Colors.textSecondary },
  childLastActive: { fontSize: 12, color: Colors.textMuted },
  statsLoading: { paddingVertical: Spacing.xl, alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.md, alignItems: 'center', gap: 4,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label },
  soundRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.md,
  },
  soundCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  soundLetter: { fontSize: 18, fontWeight: '800' },
  soundName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  soundAccuracy: { fontSize: 15, fontWeight: '700' },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },
  soundAttempts: { fontSize: 11, color: Colors.textMuted },
  attemptRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  attemptIndicator: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  attemptWord: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  attemptDate: { fontSize: 12, color: Colors.textMuted },
  attemptTranscription: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  attemptBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  attemptBarFill: { height: 6, borderRadius: 3 },
  attemptAccText: { fontSize: 12, fontWeight: '700', minWidth: 34, textAlign: 'right' },
  noStats: { paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  noStatsText: { fontSize: 14, color: Colors.textMuted },
});

// ── Root ──────────────────────────────────────────────────────────────────────

export default function ParentScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [pinAuthenticated, setPinAuthenticated] = useState(false);

  const isParent = user?.role === 'parent';
  const showDashboard = isParent || pinAuthenticated;

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login' as any);
  }, [logout, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={rootStyles.safe}>
        <View style={rootStyles.centered}>
          <Text style={{ fontSize: 48 }}>🐻</Text>
          <ActivityIndicator color={Colors.sky} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={rootStyles.safe}>
      {showDashboard && user ? (
        <Dashboard parentId={user.id} onLogout={handleLogout} />
      ) : (
        <ParentLoginScreen onSuccess={() => setPinAuthenticated(true)} />
      )}
    </SafeAreaView>
  );
}

const rootStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
});
