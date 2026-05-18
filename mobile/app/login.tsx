import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { StarDecor } from '@/components/AnimalCharacters';

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

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Mascot animations
  const foxBounce = useRef(new Animated.Value(0)).current;
  const bearSway = useRef(new Animated.Value(0)).current;
  const owlBob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(foxBounce, { toValue: -10, duration: 700, useNativeDriver: true }),
      Animated.timing(foxBounce, { toValue: 0, duration: 700, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bearSway, { toValue: -5, duration: 900, useNativeDriver: true }),
      Animated.timing(bearSway, { toValue: 5, duration: 900, useNativeDriver: true }),
      Animated.timing(bearSway, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(owlBob, { toValue: -8, duration: 1000, useNativeDriver: true }),
      Animated.timing(owlBob, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ])).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) { setError('Введите телефон или email'); return; }
    if (!password) { setError('Введите пароль'); return; }
    setError(null);
    try {
      const user = await login(extractLogin(email), password);
      switch (user.role) {
        case 'therapist': router.replace('/therapist' as any); break;
        case 'parent': router.replace('/parent' as any); break;
        case 'admin':
        case 'superadmin': router.replace('/admin' as any); break;
        default: router.replace('/' as any);
      }
    } catch (err: any) {
      setError(err.message || 'Неверный email или пароль');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Mascots row */}
          <Animated.View style={[styles.mascotsRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Animated.View style={{ transform: [{ translateY: foxBounce }] }}>
              <View style={styles.mascotBubble}>
                <Text style={styles.mascotEmoji}>🦊</Text>
              </View>
            </Animated.View>
            <Animated.View style={{ transform: [{ rotate: bearSway.interpolate({ inputRange: [-5, 5], outputRange: ['-5deg', '5deg'] }) }] }}>
              <View style={[styles.mascotBubble, styles.mascotBubbleLarge]}>
                <Text style={[styles.mascotEmoji, { fontSize: 44 }]}>🐻</Text>
              </View>
            </Animated.View>
            <Animated.View style={{ transform: [{ translateY: owlBob }] }}>
              <View style={styles.mascotBubble}>
                <Text style={styles.mascotEmoji}>🦉</Text>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <View style={styles.logoRow}>
              <StarDecor size={22} color={Colors.coral} />
              <Text style={styles.title}>Сөйле ИИ</Text>
              <StarDecor size={22} color={Colors.yellow} />
            </View>
            <Text style={styles.subtitle}>Войдите для доступа к платформе</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[styles.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>📱 Телефон или Email</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
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

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>🔒 Пароль</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
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
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton} activeOpacity={0.7}>
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Войти →</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerDivider}>
              <View style={styles.footerLine} />
              <Text style={styles.footerDividerText}>или</Text>
              <View style={styles.footerLine} />
            </View>
            <Text style={styles.footerText}>Для детей — вход по PIN-коду</Text>
            <TouchableOpacity onPress={() => router.push('/child' as any)} activeOpacity={0.7} style={styles.pinButton}>
              <Text style={styles.pinButtonText}>🎤 Войти по PIN</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  backButton: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: Colors.coralLight, justifyContent: 'center', alignItems: 'center',
    marginTop: Spacing.sm, marginBottom: Spacing.md,
  },
  backIcon: { fontSize: 22, color: Colors.coral, fontWeight: '700' },
  mascotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: Spacing.md, marginBottom: Spacing.lg },
  mascotBubble: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4,
    borderWidth: 2, borderColor: Colors.border,
  },
  mascotBubbleLarge: { width: 88, height: 88, borderRadius: 44 },
  mascotEmoji: { fontSize: 36, textAlign: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  title: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  form: { gap: Spacing.md },
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginLeft: Spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  input: { flex: 1, height: 54, fontSize: 15, color: Colors.textPrimary },
  eyeButton: { padding: Spacing.xs },
  eyeIcon: { fontSize: 18 },
  errorBox: {
    backgroundColor: Colors.coralLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.coral + '40',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  errorText: { fontSize: 13, color: Colors.coralDark, lineHeight: 18 },
  loginButton: {
    backgroundColor: Colors.coral, borderRadius: Radius.lg, height: 58,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.coral, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    marginTop: Spacing.xs,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  footer: { alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.md },
  footerDivider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: '100%' },
  footerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  footerDividerText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  footerText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  pinButton: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.coral + '40',
  },
  pinButtonText: { fontSize: 14, color: Colors.coral, fontWeight: '700' },
});
