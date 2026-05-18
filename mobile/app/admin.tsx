import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getUsers, createUser, type User, type UserRole } from '@/services/api';

// ── Phone formatting helpers ──────────────────────────────────────────────────

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
  if (v.includes('@')) return v;
  if (/^[+7-8\d]/.test(v)) return formatPhone(v);
  return v;
}
function extractLogin(v: string): string {
  if (v.includes('@')) return v.trim().toLowerCase();
  const d = v.replace(/\D/g, '');
  return d.startsWith('8') ? '+7' + d.slice(1) : '+' + d;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRoleColor(role: UserRole): string {
  switch (role) {
    case 'child':     return Colors.child;
    case 'parent':    return Colors.parent;
    case 'therapist': return Colors.therapist;
    case 'admin':     return Colors.admin;
    case 'superadmin':return Colors.coral;
    default:          return Colors.textMuted;
  }
}

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'child':     return 'Ребёнок';
    case 'parent':    return 'Родитель';
    case 'therapist': return 'Логопед';
    case 'admin':     return 'Админ';
    case 'superadmin':return 'Суперадмин';
    default:          return role;
  }
}

function getRoleEmoji(role: UserRole): string {
  switch (role) {
    case 'child':     return '👦';
    case 'parent':    return '👨‍👩‍👧';
    case 'therapist': return '🩺';
    case 'admin':     return '🛡️';
    case 'superadmin':return '⭐';
    default:          return '👤';
  }
}

// ── Login form (shown when not authenticated as admin) ────────────────────────

interface AdminLoginProps {
  onSuccess: () => void;
}

function AdminLoginForm({ onSuccess }: AdminLoginProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }
    setError(null);
    try {
      const user = await login(extractLogin(email), password);
      if (user.role !== 'admin' && user.role !== 'superadmin') {
        setError('Недостаточно прав. Требуется роль администратора.');
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Неверный email или пароль');
    }
  };

  return (
    <KeyboardAvoidingView
      style={loginStyles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={loginStyles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={loginStyles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={40} color={Colors.coral} />
        </View>
        <Text style={loginStyles.title}>Администратор</Text>
        <Text style={loginStyles.subtitle}>Требуется авторизация</Text>

        <View style={loginStyles.form}>
          <View style={loginStyles.fieldGroup}>
            <Text style={loginStyles.fieldLabel}>📱 Телефон или Email</Text>
            <View style={loginStyles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={loginStyles.icon} />
              <TextInput
                style={loginStyles.input}
                placeholder="+7 (XXX) XXX-XX-XX или email"
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

          <View style={loginStyles.fieldGroup}>
            <Text style={loginStyles.fieldLabel}>Пароль</Text>
            <View style={loginStyles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={loginStyles.icon} />
              <TextInput
                style={[loginStyles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={loginStyles.eye}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={loginStyles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.red} />
              <Text style={loginStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[loginStyles.button, isLoading && loginStyles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={loginStyles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const loginStyles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.coral + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.coral + '40',
  },
  title: { ...Typography.h2, marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg },
  form: { width: '100%', gap: Spacing.md },
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginLeft: Spacing.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  icon: { marginRight: Spacing.sm },
  input: { flex: 1, height: 52, fontSize: 15, color: Colors.textPrimary },
  eye: { padding: Spacing.xs },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.red + '18',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.red + '40',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.red, lineHeight: 18 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.coral,
    borderRadius: Radius.md,
    height: 54,
    marginTop: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ── Add User Modal ────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'child',     label: 'Ребёнок' },
  { value: 'parent',   label: 'Родитель' },
  { value: 'therapist',label: 'Логопед' },
  { value: 'admin',    label: 'Администратор' },
];

interface AddUserModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function AddUserModal({ visible, onClose, onCreated }: AddUserModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('child');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [age, setAge] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(''); setRole('child'); setEmail('');
    setPassword(''); setPin(''); setAge('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Введите имя'); return; }
    if (role === 'child' && !pin) { setError('PIN-код обязателен для ребёнка'); return; }
    if (role !== 'child' && !email.trim()) { setError('Email обязателен'); return; }
    if (role !== 'child' && !password) { setError('Пароль обязателен'); return; }

    setError(null);
    setIsLoading(true);
    try {
      await createUser({
        name: name.trim(),
        role,
        email: email.trim() || undefined,
        password: password || undefined,
        pin_code: pin || undefined,
        age: age ? Number(age) : undefined,
      });
      reset();
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании пользователя');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={modalStyles.safeArea}>
        <KeyboardAvoidingView
          style={modalStyles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Добавить пользователя</Text>
            <TouchableOpacity style={modalStyles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={modalStyles.flex}
            contentContainerStyle={modalStyles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Name */}
            <View style={modalStyles.fieldGroup}>
              <Text style={modalStyles.fieldLabel}>Имя *</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="Иван Иванов"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
                returnKeyType="next"
              />
            </View>

            {/* Role selector */}
            <View style={modalStyles.fieldGroup}>
              <Text style={modalStyles.fieldLabel}>Роль *</Text>
              <View style={modalStyles.rolesRow}>
                {ROLES.map((r) => {
                  const active = r.value === role;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        modalStyles.roleChip,
                        active && { backgroundColor: getRoleColor(r.value) + '25', borderColor: getRoleColor(r.value) },
                      ]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          modalStyles.roleChipText,
                          active && { color: getRoleColor(r.value) },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Email (not for child) */}
            {role !== 'child' && (
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Email *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="user@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {/* Password (not for child) */}
            {role !== 'child' && (
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Пароль *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="Минимум 6 символов"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* PIN (for child) */}
            {role === 'child' && (
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>PIN-код (4 цифры) *</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="1234"
                  placeholderTextColor={Colors.textMuted}
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            )}

            {/* Age */}
            <View style={modalStyles.fieldGroup}>
              <Text style={modalStyles.fieldLabel}>Возраст</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="8"
                placeholderTextColor={Colors.textMuted}
                value={age}
                onChangeText={(t) => setAge(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            {/* Error */}
            {error ? (
              <View style={modalStyles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.red} />
                <Text style={modalStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Create button */}
            <TouchableOpacity
              style={[modalStyles.createButton, isLoading && modalStyles.buttonDisabled]}
              onPress={handleCreate}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={modalStyles.createButtonText}>Создать пользователя</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { ...Typography.h3 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginLeft: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  roleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.red + '18',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.red + '40',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.red, lineHeight: 18 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.coral,
    borderRadius: Radius.md,
    height: 54,
    marginTop: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  createButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

const FILTER_ROLES: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all',      label: 'Все' },
  { value: 'therapist',label: 'Логопеды' },
  { value: 'parent',   label: 'Родители' },
  { value: 'child',    label: 'Дети' },
  { value: 'admin',    label: 'Админы' },
];

interface DashboardProps {
  adminUser: User;
}

function AdminDashboard({ adminUser }: DashboardProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось загрузить список пользователей');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers =
    filterRole === 'all' ? users : users.filter((u) => u.role === filterRole);

  const stats = {
    therapist: users.filter((u) => u.role === 'therapist').length,
    parent:    users.filter((u) => u.role === 'parent').length,
    child:     users.filter((u) => u.role === 'child').length,
    admin:     users.filter((u) => u.role === 'admin' || u.role === 'superadmin').length,
  };

  const handleUserPress = (user: User) => {
    Alert.alert(
      `${getRoleEmoji(user.role)} ${user.name}`,
      [
        `Роль: ${getRoleLabel(user.role)}`,
        user.email ? `Email: ${user.email}` : '',
        user.age != null ? `Возраст: ${user.age} лет` : '',
        `Активен: ${user.is_active ? 'Да' : 'Нет'}`,
        `ID: ${user.id}`,
        `Зарегистрирован: ${new Date(user.created_at).toLocaleDateString('ru-RU')}`,
      ]
        .filter(Boolean)
        .join('\n'),
      [{ text: 'OK' }],
    );
  };

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Администратор</Text>
          <Text style={styles.headerSub}>{adminUser.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            logout();
            router.replace('/');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.dashContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Логопеды', value: stats.therapist, color: Colors.therapist, emoji: '🩺' },
            { label: 'Родители', value: stats.parent,    color: Colors.parent,    emoji: '👨‍👩‍👧' },
            { label: 'Дети',     value: stats.child,     color: Colors.child,     emoji: '👦' },
            { label: 'Админы',   value: stats.admin,     color: Colors.admin,     emoji: '🛡️' },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[styles.statCard, { borderColor: stat.color + '33' }]}
            >
              <Text style={styles.statEmoji}>{stat.emoji}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_ROLES.map((f) => {
            const active = f.value === filterRole;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilterRole(f.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
                {active && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>{filteredUsers.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Users list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ПОЛЬЗОВАТЕЛИ</Text>
          <View style={styles.sectionLine} />
          <TouchableOpacity onPress={loadUsers} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.coral} size="large" />
            <Text style={styles.loadingText}>Загрузка...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Нет пользователей</Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((user) => {
              const roleColor = getRoleColor(user.role);
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userRow}
                  onPress={() => handleUserPress(user)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.userAvatar, { backgroundColor: roleColor + '20' }]}>
                    <Text style={styles.userAvatarEmoji}>{getRoleEmoji(user.role)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                    {user.email ? (
                      <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                    ) : (
                      <Text style={styles.userEmail}>PIN-код доступ</Text>
                    )}
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                      {getRoleLabel(user.role)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add" size={22} color="#fff" />
        <Text style={styles.fabText}>Добавить</Text>
      </TouchableOpacity>

      <AddUserModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => {
          setShowAddModal(false);
          loadUsers();
        }}
      />
    </View>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const { user, isLoading } = useAuth();
  const [localAuth, setLocalAuth] = useState(false);

  const isAdmin =
    user?.role === 'admin' || user?.role === 'superadmin';
  const showDashboard = isAdmin || localAuth;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.coral} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {showDashboard && user ? (
        <AdminDashboard adminUser={user} />
      ) : (
        <AdminLoginForm onSuccess={() => setLocalAuth(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  // Filter
  filterRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.coral + '20',
    borderColor: Colors.coral,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.coral,
  },
  filterCount: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    flexShrink: 0,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  // Users list
  loadingWrap: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyWrap: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  usersList: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  userAvatarEmoji: {
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 1,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  roleBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    flexShrink: 0,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.coral,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    shadowColor: Colors.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
