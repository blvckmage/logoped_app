import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getTherapistPatients,
  createUser,
  type User,
} from '@/services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAvatarColor(avgAccuracy: number | undefined): string {
  const acc = avgAccuracy ?? 0;
  if (acc >= 80) return Colors.green;
  if (acc >= 50) return Colors.orange;
  return Colors.textMuted;
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

function isActiveToday(lastActive: string | null | undefined): boolean {
  if (!lastActive) return false;
  const date = new Date(lastActive);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────────

interface LoginScreenProps {
  onSuccess: () => void;
}

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
function smartInput(v: string): string {
  if (v.includes('@')) return v; // email — не трогаем
  if (/^[+7-8\d]/.test(v)) return formatPhone(v); // начинается как телефон
  return v;
}
function extractLogin(v: string): string {
  if (v.includes('@')) return v.trim().toLowerCase();
  const d = v.replace(/\D/g, '');
  return d.startsWith('8') ? '+7' + d.slice(1) : '+' + d;
}

function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const owlBob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(owlBob, { toValue: -8, duration: 1000, useNativeDriver: true }),
        Animated.timing(owlBob, { toValue: -4, duration: 500, useNativeDriver: true }),
        Animated.timing(owlBob, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleLogin = useCallback(async () => {
    if (!email.trim()) { setError('Введите телефон или email'); return; }
    if (!password) { setError('Введите пароль'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login(extractLogin(email), password);
      if (user.role !== 'therapist') {
        setError('Этот аккаунт не является логопедом');
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Неверный email или пароль');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login, onSuccess]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={loginStyles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Owl mascot */}
        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: owlBob }] }}>
          <View style={loginStyles.owlCircle}>
            <Text style={loginStyles.owlEmoji}>🦉</Text>
          </View>
        </Animated.View>

        <Text style={loginStyles.title}>Кабинет Логопеда</Text>
        <Text style={loginStyles.subtitle}>Войдите в свой аккаунт</Text>

        {/* Form card */}
        <View style={loginStyles.card}>
          {/* Phone or Email */}
          <View style={loginStyles.fieldGroup}>
            <Text style={loginStyles.fieldLabel}>📱 Телефон или Email</Text>
            <View style={loginStyles.inputWrap}>
              <TextInput
                style={loginStyles.input}
                placeholder="+7 (___) ___ __ __ или email"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={v => setEmail(smartInput(v))}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                maxLength={40}
              />
            </View>
          </View>

          {/* Password */}
          <View style={loginStyles.fieldGroup}>
            <Text style={loginStyles.fieldLabel}>🔒 Пароль</Text>
            <View style={loginStyles.inputWrap}>
              <TextInput
                style={[loginStyles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={loginStyles.eyeButton} activeOpacity={0.7}>
                <Text style={loginStyles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error.length > 0 && (
            <View style={loginStyles.errorBox}>
              <Text style={loginStyles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[loginStyles.loginButton, isSubmitting && loginStyles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={loginStyles.loginButtonText}>Войти →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const loginStyles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, justifyContent: 'center', alignItems: 'center', paddingTop: Spacing.xl },
  owlCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(139,111,190,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#8B6FBE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  owlEmoji: { fontSize: 56, textAlign: 'center', lineHeight: 110 },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
  card: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: Colors.purpleLight,
    padding: Spacing.md, gap: Spacing.md,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, height: 52, fontSize: 15, color: Colors.textPrimary },
  eyeButton: { padding: Spacing.xs },
  eyeIcon: { fontSize: 18 },
  errorBox: {
    backgroundColor: Colors.coralLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.coral + '40',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  errorText: { fontSize: 13, color: Colors.coralDark, lineHeight: 18 },
  loginButton: {
    backgroundColor: Colors.purple, borderRadius: Radius.lg, height: 56,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});

// ── Patient Card ───────────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: User;
  onPress: () => void;
}

function PatientCard({ patient, onPress }: PatientCardProps) {
  const avatarColor = getAvatarColor(patient.avg_accuracy);
  const lastActiveLabel = formatLastActive(patient.last_active);
  const acc = Math.round(patient.avg_accuracy ?? 0);
  const problemSounds: string[] = (patient as any).problem_sounds ?? [];

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.avatar, { backgroundColor: avatarColor + '20', borderColor: avatarColor + '50' }]}>
          <Text style={[cardStyles.avatarLetter, { color: avatarColor }]}>{patient.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={cardStyles.name} numberOfLines={1}>{patient.name}</Text>
          {patient.age != null && <Text style={cardStyles.age}>{patient.age} лет</Text>}
          <Text style={cardStyles.lastActive}>{lastActiveLabel}</Text>
        </View>
        <Text style={cardStyles.chevron}>›</Text>
      </View>

      {problemSounds.length > 0 && (
        <View style={cardStyles.chipsRow}>
          {problemSounds.slice(0, 5).map((sound) => (
            <View key={sound} style={cardStyles.problemChip}>
              <Text style={cardStyles.problemChipText}>{sound}</Text>
            </View>
          ))}
          {problemSounds.length > 5 && (
            <Text style={cardStyles.moreChips}>+{problemSounds.length - 5}</Text>
          )}
        </View>
      )}

      <View style={cardStyles.barRow}>
        <View style={cardStyles.barBg}>
          <View style={[cardStyles.barFill, { width: `${Math.min(acc, 100)}%` as any, backgroundColor: avatarColor }]} />
        </View>
        <Text style={[cardStyles.accText, { color: avatarColor }]}>{acc}%</Text>
        <Text style={cardStyles.attempts}>{patient.total_attempts ?? 0} попыток</Text>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.purpleLight,
    padding: Spacing.md, gap: Spacing.sm,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarLetter: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  age: { fontSize: 13, color: Colors.textSecondary },
  lastActive: { fontSize: 12, color: Colors.textMuted },
  chevron: { fontSize: 24, color: Colors.purple, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  problemChip: {
    backgroundColor: Colors.coralLight, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.coral + '40',
  },
  problemChipText: { fontSize: 11, fontWeight: '700', color: Colors.coral },
  moreChips: { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  accText: { fontSize: 13, fontWeight: '700', minWidth: 38, textAlign: 'right' },
  attempts: { fontSize: 12, color: Colors.textMuted, minWidth: 68, textAlign: 'right' },
});

// ── Add Patient Modal ──────────────────────────────────────────────────────────

interface AddPatientModalProps {
  visible: boolean;
  therapistId: number;
  onClose: () => void;
  onCreated: () => void;
}

function AddPatientModal({ visible, therapistId, onClose, onCreated }: AddPatientModalProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const reset = useCallback(() => {
    setName(''); setAge(''); setPin(''); setError(''); setIsCreating(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { setError('Введите имя пациента'); return; }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setError('PIN должен состоять из 4 цифр'); return; }
    setError('');
    setIsCreating(true);
    try {
      await createUser({
        name: name.trim(),
        role: 'child',
        pin_code: pin,
        age: age.trim() ? parseInt(age.trim(), 10) : undefined,
        therapist_id: therapistId,
      });
      reset();
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать пациента');
    } finally {
      setIsCreating(false);
    }
  }, [name, pin, age, therapistId, reset, onCreated]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={modalStyles.backdrop} onPress={handleClose}>
        <Pressable style={modalStyles.card} onPress={() => {}}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>👶 Новый пациент</Text>
            <TouchableOpacity onPress={handleClose} style={modalStyles.closeBtn} activeOpacity={0.7}>
              <Text style={modalStyles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: Spacing.sm }}>
            {[
              { label: '👤 Имя *', placeholder: 'Имя ребёнка', value: name, onChange: setName, autoCapitalize: 'words' as const, keyboardType: 'default' as const, secure: false },
              { label: '🎂 Возраст', placeholder: 'Лет', value: age, onChange: setAge, autoCapitalize: 'none' as const, keyboardType: 'number-pad' as const, secure: false, maxLength: 2 },
              { label: '🔑 PIN-код (4 цифры) *', placeholder: '1234', value: pin, onChange: setPin, autoCapitalize: 'none' as const, keyboardType: 'number-pad' as const, secure: true, maxLength: 4 },
            ].map((field, i) => (
              <View key={i} style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>{field.label}</Text>
                <View style={modalStyles.inputWrap}>
                  <TextInput
                    style={modalStyles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    value={field.value}
                    onChangeText={field.onChange}
                    autoCapitalize={field.autoCapitalize}
                    keyboardType={field.keyboardType}
                    secureTextEntry={field.secure}
                    maxLength={(field as any).maxLength}
                    returnKeyType="next"
                  />
                </View>
              </View>
            ))}

            {error.length > 0 && (
              <View style={modalStyles.errorBox}>
                <Text style={modalStyles.errorText}>⚠️ {error}</Text>
              </View>
            )}
          </View>

          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={modalStyles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.createBtn, isCreating && modalStyles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={isCreating}
              activeOpacity={0.85}
            >
              {isCreating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={modalStyles.createBtnText}>Создать ✓</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.purpleLight,
    padding: Spacing.md, gap: Spacing.md,
    shadowColor: Colors.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  closeIcon: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.xs },
  inputWrap: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.sm },
  input: { height: 46, fontSize: 15, color: Colors.textPrimary },
  errorBox: { backgroundColor: Colors.coralLight, borderRadius: Radius.md, padding: Spacing.sm },
  errorText: { fontSize: 13, color: Colors.coralDark },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, height: 48, borderRadius: Radius.md, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  createBtn: { flex: 1, height: 48, borderRadius: Radius.md, backgroundColor: Colors.purple, justifyContent: 'center', alignItems: 'center' },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ── Dashboard ──────────────────────────────────────────────────────────────────

interface TherapistDashboardProps {
  therapistId: number;
  onLogout: () => void;
}

function TherapistDashboard({ therapistId, onLogout }: TherapistDashboardProps) {
  const router = useRouter();
  const [patients, setPatients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTherapistPatients(therapistId);
      setPatients(data.patients ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [therapistId]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, search]);

  const totalCount = patients.length;
  const avgAccuracy = useMemo(() => {
    const withAcc = patients.filter((p) => p.avg_accuracy != null);
    if (withAcc.length === 0) return 0;
    const sum = withAcc.reduce((s, p) => s + (p.avg_accuracy ?? 0), 0);
    return Math.round(sum / withAcc.length);
  }, [patients]);
  const activeToday = useMemo(() => patients.filter((p) => isActiveToday(p.last_active)).length, [patients]);

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={dashStyles2.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Text style={{ fontSize: 28 }}>🦉</Text>
          <Text style={dashStyles2.headerTitle}>Мои пациенты</Text>
        </View>
        <TouchableOpacity style={dashStyles2.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Text style={dashStyles2.logoutIcon}>↩</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={dashStyles2.statsBar}>
        {[
          { value: totalCount, label: 'пациентов', color: Colors.purple },
          { value: `${avgAccuracy}%`, label: 'ср. точность', color: Colors.green },
          { value: activeToday, label: 'активны сег.', color: Colors.sky },
        ].map((item, i, arr) => (
          <View key={i} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
            <View style={dashStyles2.statItem}>
              <Text style={[dashStyles2.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={dashStyles2.statLabel}>{item.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={dashStyles2.statDivider} />}
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={dashStyles2.searchWrap}>
        <Text style={dashStyles2.searchIcon}>🔍</Text>
        <TextInput
          style={dashStyles2.searchInput}
          placeholder="Поиск пациента..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Text style={{ fontSize: 16, color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={dashStyles2.centered}>
          <ActivityIndicator color={Colors.purple} size="large" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={dashStyles2.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Add patient button */}
          <TouchableOpacity style={dashStyles2.addButton} onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <Text style={dashStyles2.addButtonText}>+ Добавить пациента</Text>
          </TouchableOpacity>

          {filteredPatients.length === 0 ? (
            <View style={dashStyles2.emptyState}>
              <Text style={{ fontSize: 60 }}>👥</Text>
              <Text style={dashStyles2.emptyTitle}>{search.length > 0 ? 'Не найдено' : 'Нет пациентов'}</Text>
              <Text style={dashStyles2.emptySubtitle}>
                {search.length > 0 ? 'Попробуйте другой запрос' : 'Добавьте первого пациента'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {filteredPatients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onPress={() => router.push(`/patient/${patient.id}` as any)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <AddPatientModal
        visible={showModal}
        therapistId={therapistId}
        onClose={() => setShowModal(false)}
        onCreated={() => { setShowModal(false); loadPatients(); }}
      />
    </View>
  );
}

const dashStyles2 = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  logoutBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.purpleLight, justifyContent: 'center', alignItems: 'center' },
  logoutIcon: { fontSize: 20, color: Colors.purple, fontWeight: '700' },
  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    paddingHorizontal: Spacing.md, height: 48,
  },
  searchIcon: { fontSize: 18, marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary, height: '100%' },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 40, gap: Spacing.md },
  addButton: {
    backgroundColor: Colors.purple, borderRadius: Radius.lg, height: 52,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  addButtonText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  emptyState: { paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

// ── Root ───────────────────────────────────────────────────────────────────────

export default function TherapistScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [emailAuthenticated, setEmailAuthenticated] = useState(false);

  const isTherapist = user?.role === 'therapist';
  const showDashboard = isTherapist || emailAuthenticated;

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login' as any);
  }, [logout, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={rootStyles.safe}>
        <View style={rootStyles.centered}>
          <Text style={{ fontSize: 48 }}>🦉</Text>
          <ActivityIndicator color={Colors.purple} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={rootStyles.safe}>
      {showDashboard && user ? (
        <TherapistDashboard therapistId={user.id} onLogout={handleLogout} />
      ) : (
        <LoginScreen onSuccess={() => setEmailAuthenticated(true)} />
      )}
    </SafeAreaView>
  );
}

const rootStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
});
