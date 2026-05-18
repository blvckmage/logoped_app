import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { analyzeAudio, getChildGamification, type AnalysisResult, type Gamification, type Achievement } from '@/services/api';
import { StarDecor } from '@/components/AnimalCharacters';
import {
  XpBar, LevelBadge, StreakBadge, StarsRow,
  StarBurst, LevelUpModal, Confetti, AchievementToast, AchievementCard,
} from '@/components/GamificationUI';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SoundOption {
  letter: string;
  word: string;
  label: string;
  examples: string[];
  color: string;
}

const SOUNDS: SoundOption[] = [
  { letter: 'Р', word: 'Рама',  label: 'Р', examples: ['Рама','Рак','Рыба','Рука'],       color: Colors.coral },
  { letter: 'Л', word: 'Лампа', label: 'Л', examples: ['Лампа','Луна','Ложка','Лиса'],    color: Colors.sky },
  { letter: 'Қ', word: 'Қала',  label: 'Қ', examples: ['Қала','Қар','Қол','Қас'],          color: Colors.mint },
  { letter: 'С', word: 'Сыр',   label: 'С', examples: ['Сыр','Сөз','Сан','Су'],            color: Colors.yellow },
  { letter: 'Ш', word: 'Шар',   label: 'Ш', examples: ['Шар','Шелек','Шаш','Шығу'],        color: Colors.orange },
  { letter: 'Ч', word: 'Чашка', label: 'Ч', examples: ['Чашка','Чай','Чудо','Часы'],       color: Colors.purple },
];

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 90) return Colors.green;
  if (accuracy >= 70) return Colors.yellow;
  if (accuracy >= 40) return Colors.orange;
  return Colors.coral;
}

function getAccuracyLabel(accuracy: number): string {
  if (accuracy >= 90) return '🏆 Превосходно!';
  if (accuracy >= 70) return '⭐ Хорошо!';
  if (accuracy >= 40) return '💪 Почти!';
  return '🔄 Попробуй снова';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'mild': return Colors.mint;
    case 'moderate': return Colors.yellow;
    case 'severe': return Colors.coral;
    default: return Colors.textMuted;
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'mild': return 'лёгкое';
    case 'moderate': return 'среднее';
    case 'severe': return 'тяжёлое';
    default: return severity;
  }
}

// ── Phone formatter ───────────────────────────────────────────────────────────
// Formats raw digits into +7 (XXX) XXX-XX-XX as user types

function formatPhone(raw: string): string {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, '');
  // Normalise: if user starts with 8 treat as 7
  const d = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
  const n = d.startsWith('7') ? d : d.length ? '7' + d : '';

  if (n.length === 0) return '';
  if (n.length <= 1)  return '+7';
  if (n.length <= 4)  return `+7 (${n.slice(1)}`;
  if (n.length <= 7)  return `+7 (${n.slice(1,4)}) ${n.slice(4)}`;
  if (n.length <= 9)  return `+7 (${n.slice(1,4)}) ${n.slice(4,7)}-${n.slice(7)}`;
  return               `+7 (${n.slice(1,4)}) ${n.slice(4,7)}-${n.slice(7,9)}-${n.slice(9,11)}`;
}

function unformatPhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  return digits.startsWith('8') ? '+7' + digits.slice(1) : '+' + digits;
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const foxBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(foxBounce, { toValue: -10, duration: 700, useNativeDriver: true }),
        Animated.timing(foxBounce, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    const clean = unformatPhone(phone);
    if (clean.replace(/\D/g,'').length < 11 || !password) { setError('Заполни все поля 😊'); return; }
    setIsLoading(true); setError('');
    try {
      const user = await login(clean, password);
      if (user.role !== 'child') { setError('Этот аккаунт не является детским 😢'); return; }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Неверный номер телефона или пароль 😢');
    } finally { setIsLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={loginStyles.container} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateY: foxBounce }] }}>
          <View style={loginStyles.mascot}><Text style={loginStyles.mascotEmoji}>🦊</Text></View>
        </Animated.View>

        <Text style={loginStyles.title}>Привет! Войди в игру</Text>
        <Text style={loginStyles.subtitle}>Введи свой номер телефона и пароль</Text>

        <View style={loginStyles.form}>
          <View style={loginStyles.field}>
            <Text style={loginStyles.label}>📱 Номер телефона</Text>
            <TextInput
              style={loginStyles.input}
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

          <View style={loginStyles.field}>
            <Text style={loginStyles.label}>🔒 Пароль</Text>
            <View style={loginStyles.passwordRow}>
              <TextInput
                style={[loginStyles.input, { flex: 1 }]}
                placeholder="••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={loginStyles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Text style={loginStyles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={loginStyles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[loginStyles.btn, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={loginStyles.btnText}>🎮 Войти и играть!</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const loginStyles = StyleSheet.create({
  container:    { flexGrow: 1, alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl, backgroundColor: Colors.bg },
  mascot:       { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,140,66,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, shadowColor: '#FF8C42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  mascotEmoji:  { fontSize: 56, textAlign: 'center', lineHeight: 110 },
  title:        { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' },
  subtitle:     { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
  form:         { width: '100%', gap: Spacing.md },
  field:        { gap: Spacing.xs },
  label:        { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  input:        { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 54, fontSize: 16, color: Colors.textPrimary },
  passwordRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eyeBtn:       { width: 54, height: 54, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  eyeText:      { fontSize: 20 },
  error:        { fontSize: 14, color: Colors.coral, fontWeight: '600', textAlign: 'center', backgroundColor: Colors.coralLight, borderRadius: Radius.md, padding: Spacing.sm },
  btn:          { backgroundColor: Colors.coral, borderRadius: Radius.lg, height: 56, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.coral, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnText:      { fontSize: 18, fontWeight: '800', color: '#fff' },
});

// ── Trainer Screen ────────────────────────────────────────────────────────────

interface TrainerProps {
  userId?: number;
}

function TrainerContent({ userId }: TrainerProps) {
  const [selectedSound, setSelectedSound] = useState<SoundOption>(SOUNDS[0]);
  const [activeWord, setActiveWord] = useState(SOUNDS[0].word);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  // Gamification state
  const [gamification, setGamification] = useState<Gamification | null>(null);
  const [showStarBurst, setShowStarBurst] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ old: 1, new: 2 });
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);
  const [currentAchievementIdx, setCurrentAchievementIdx] = useState(0);
  const [showAchievements, setShowAchievements] = useState(false);

  const foxBounce = useRef(new Animated.Value(0)).current;
  const foxScale = useRef(new Animated.Value(1)).current;
  const recordPulse = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Idle fox bounce
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(foxBounce, { toValue: -8, duration: 800, useNativeDriver: true }),
        Animated.timing(foxBounce, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Excited fox when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(foxScale, { toValue: 1.08, duration: 300, useNativeDriver: true }),
          Animated.timing(foxScale, { toValue: 0.95, duration: 300, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(recordPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      foxScale.stopAnimation(); foxScale.setValue(1);
      recordPulse.stopAnimation(); recordPulse.setValue(1);
    }
  }, [isRecording]);

  // Fade in result
  useEffect(() => {
    if (result) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [result]);

  // Load gamification on mount
  useEffect(() => {
    if (userId) {
      getChildGamification(userId).then(setGamification).catch(() => {});
    }
  }, [userId]);

  const startRecording = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          Alert.alert('Нет доступа к микрофону', 'Разрешите доступ к микрофону в настройках устройства.');
          return;
        }
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setResult(null);
    } catch {
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      if (uri) await uploadAudio(uri);
    } catch {
      setRecording(null);
      Alert.alert('Ошибка', 'Не удалось остановить запись');
    }
  };

  const uploadAudio = async (uri: string) => {
    setIsUploading(true);
    setResult(null);
    try {
      const data = await analyzeAudio(uri, activeWord, userId, selectedSound.letter);
      setResult(data);

      // Handle gamification rewards
      const gm = data.gamification;
      if (gm) {
        // Update local gamification state optimistically
        setGamification(prev => prev ? {
          ...prev,
          xp: gm.new_level !== undefined ? (gm.xp_earned !== undefined ? prev.xp + gm.xp_earned : prev.xp) : prev.xp,
          level: gm.new_level ?? prev.level,
          streak_days: gm.streak ?? prev.streak_days,
          total_stars: (prev.total_stars ?? 0) + (gm.stars_earned ?? 0),
        } : null);

        // Star burst for any stars earned
        if ((gm.stars_earned ?? 0) > 0) {
          setShowStarBurst(true);
          if (gm.stars_earned === 3) setShowConfetti(true);
        }

        // Level up celebration
        if (gm.level_up) {
          setLevelUpData({ old: gm.old_level ?? 1, new: gm.new_level ?? 2 });
          setTimeout(() => setShowLevelUp(true), 1400);
        }

        // Queue achievement toasts
        if (gm.unlocked_achievements && gm.unlocked_achievements.length > 0) {
          setPendingAchievements(gm.unlocked_achievements);
          setCurrentAchievementIdx(0);
        }

        // Refresh full gamification from server after 2s
        if (userId) {
          setTimeout(() => getChildGamification(userId).then(setGamification).catch(() => {}), 2000);
        }
      }
    } catch (err: any) {
      Alert.alert('Ошибка анализа', err.message || 'Не удалось проанализировать запись');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordPress = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const starsEarned: number = (result?.gamification as any)?.stars_earned ?? 0;
  const currentAchievement = pendingAchievements[currentAchievementIdx] ?? null;

  return (
    <>
    {/* Gamification overlays */}
    <StarBurst
      stars={starsEarned}
      visible={showStarBurst}
      onDone={() => setShowStarBurst(false)}
    />
    <Confetti visible={showConfetti} />
    <LevelUpModal
      visible={showLevelUp}
      oldLevel={levelUpData.old}
      newLevel={levelUpData.new}
      onClose={() => { setShowLevelUp(false); setShowConfetti(false); }}
    />
    {currentAchievement && (
      <AchievementToast
        achievement={currentAchievement}
        onDone={() => {
          if (currentAchievementIdx + 1 < pendingAchievements.length) {
            setCurrentAchievementIdx(i => i + 1);
          } else {
            setPendingAchievements([]);
            setCurrentAchievementIdx(0);
          }
        }}
      />
    )}

    {/* Achievements modal */}
    {showAchievements && gamification && (
      <View style={achieveStyles.overlay}>
        <View style={achieveStyles.modal}>
          <View style={achieveStyles.modalHeader}>
            <Text style={achieveStyles.modalTitle}>🏅 Достижения</Text>
            <TouchableOpacity onPress={() => setShowAchievements(false)} style={achieveStyles.closeBtn}>
              <Text style={achieveStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={achieveStyles.grid}>
              {gamification.achievements.map(a => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    )}

    <ScrollView style={{ flex: 1 }} contentContainerStyle={trainerStyles.content} showsVerticalScrollIndicator={false}>

      {/* XP Bar + Streak + Achievements button */}
      {gamification && (
        <View style={trainerStyles.gamificationHeader}>
          <View style={trainerStyles.gamificationLeft}>
            <LevelBadge level={gamification.level} size="sm" />
            <XpBar
              xp={gamification.xp}
              level={gamification.level}
              xpCurrentLevel={gamification.xp_current_level}
              xpNextLevel={gamification.xp_next_level}
            />
          </View>
          <View style={trainerStyles.gamificationRight}>
            <StreakBadge streak={gamification.streak_days} />
            <TouchableOpacity style={trainerStyles.trophyBtn} onPress={() => setShowAchievements(true)}>
              <Text style={trainerStyles.trophyEmoji}>🏅</Text>
              <Text style={trainerStyles.trophyCount}>
                {gamification.achievements.filter(a => a.unlocked).length}/{gamification.achievements.length}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Fox mascot */}
      <View style={trainerStyles.mascotArea}>
        <Animated.View style={{ transform: [{ translateY: foxBounce }, { scale: foxScale }] }}>
          <View style={trainerStyles.foxCircle}>
            <Text style={trainerStyles.foxEmoji}>🦊</Text>
          </View>
        </Animated.View>
        <Text style={trainerStyles.mascotCaption}>
          {isRecording ? '🎤 Слушаю тебя...' : isUploading ? '🤔 Анализирую...' : '👋 Я помогу тебе!'}
        </Text>
      </View>

      {/* Sound chips */}
      <Text style={trainerStyles.sectionLabel}>ВЫБЕРИ ЗВУК</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
        <View style={trainerStyles.chipRow}>
          {SOUNDS.map((s) => {
            const active = s.letter === selectedSound.letter;
            return (
              <TouchableOpacity
                key={s.letter}
                style={[trainerStyles.chip, active && { backgroundColor: s.color, borderColor: s.color }]}
                onPress={() => { setSelectedSound(s); setActiveWord(s.word); setResult(null); }}
                activeOpacity={0.8}
              >
                <Text style={[trainerStyles.chipText, active && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Word card */}
      <View style={[trainerStyles.wordCard, { borderColor: selectedSound.color + '40' }]}>
        <View style={trainerStyles.wordCardTop}>
          <StarDecor color={Colors.yellow} size={20} />
          <Text style={trainerStyles.wordCardLabel}>ПРОИЗНЕСИ СЛОВО</Text>
          <StarDecor color={Colors.yellow} size={20} />
        </View>
        <Text style={[trainerStyles.wordBig, { color: selectedSound.color }]}>{activeWord}</Text>
        <View style={trainerStyles.wordExamples}>
          {selectedSound.examples.filter(e => e !== activeWord).slice(0, 3).map(e => (
            <TouchableOpacity key={e} onPress={() => { setActiveWord(e); setResult(null); }} style={[trainerStyles.exampleChip, { borderColor: selectedSound.color + '60' }]}>
              <Text style={[trainerStyles.exampleChipText, { color: selectedSound.color }]}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Record button */}
      <View style={trainerStyles.recordArea}>
        {isUploading ? (
          <View style={trainerStyles.analyzingContainer}>
            <Text style={trainerStyles.analyzingEmoji}>🔬</Text>
            <Text style={trainerStyles.analyzingText}>Анализирую произношение...</Text>
          </View>
        ) : (
          !result && (
            <Animated.View style={{ transform: [{ scale: recordPulse }] }}>
              <TouchableOpacity
                style={[trainerStyles.recordBtn, isRecording && trainerStyles.recordBtnActive]}
                onPress={handleRecordPress}
                activeOpacity={0.85}
              >
                <Text style={trainerStyles.recordBtnEmoji}>{isRecording ? '⏹' : '🎤'}</Text>
                <Text style={trainerStyles.recordBtnText}>{isRecording ? 'Остановить' : 'Записать'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )
        )}
        <Text style={trainerStyles.recordHint}>
          {isRecording ? 'Говори чётко и ясно' : isUploading ? '' : 'Нажми и произнеси слово'}
        </Text>
      </View>

      {/* Result */}
      {result && (
        <Animated.View style={[trainerStyles.result, { opacity: fadeAnim }]}>
          {/* Accuracy */}
          <View style={[trainerStyles.accuracyCard, { backgroundColor: getAccuracyColor(result.accuracy) + '15', borderColor: getAccuracyColor(result.accuracy) + '40' }]}>
            <Text style={trainerStyles.accuracyEmoji}>
              {result.accuracy >= 90 ? '🏆' : result.accuracy >= 70 ? '⭐' : result.accuracy >= 40 ? '💪' : '🔄'}
            </Text>
            <StarsRow count={starsEarned} size={32} />
            <Text style={[trainerStyles.accuracyNumber, { color: getAccuracyColor(result.accuracy) }]}>
              {Math.round(result.accuracy)}%
            </Text>
            <Text style={trainerStyles.accuracyLabelText}>{getAccuracyLabel(result.accuracy)}</Text>
            <Text style={trainerStyles.accuracyMsg}>{result.message}</Text>
          </View>

          {/* Transcription */}
          {result.transcription ? (
            <View style={trainerStyles.transcriptionCard}>
              <Text style={trainerStyles.transcriptionLabel}>Я услышал:</Text>
              <Text style={trainerStyles.transcriptionText}>«{result.transcription}»</Text>
            </View>
          ) : null}

          {/* Disorders */}
          {result.phoneme_analysis && result.phoneme_analysis.disorders_found.length > 0 && (
            <View style={trainerStyles.disordersSection}>
              <Text style={trainerStyles.disordersTitle}>🔍 Найденные особенности:</Text>
              {result.phoneme_analysis.disorders_found.map((d, i) => (
                <View key={i} style={trainerStyles.disorderCard}>
                  <View style={trainerStyles.disorderHeader}>
                    <Text style={trainerStyles.disorderName}>{d.disorder}</Text>
                    <View style={[trainerStyles.severityBadge, { backgroundColor: getSeverityColor(d.severity) + '30' }]}>
                      <Text style={[trainerStyles.severityText, { color: getSeverityColor(d.severity) }]}>
                        {getSeverityLabel(d.severity)}
                      </Text>
                    </View>
                  </View>
                  {d.errors.length > 0 && (
                    <View style={trainerStyles.errorsList}>
                      {d.errors.map((e, ei) => (
                        <Text key={ei} style={trainerStyles.errorItem}>• {e}</Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Recommendations */}
          {result.phoneme_analysis && result.phoneme_analysis.recommendations.length > 0 && (
            <View style={trainerStyles.recSection}>
              <Text style={trainerStyles.recTitle}>💡 Рекомендации:</Text>
              {result.phoneme_analysis.recommendations.map((rec, i) => (
                <Text key={i} style={trainerStyles.recItem}>💡 {rec}</Text>
              ))}
            </View>
          )}

          {/* Try again */}
          <TouchableOpacity style={trainerStyles.tryAgainBtn} onPress={() => setResult(null)}>
            <Text style={trainerStyles.tryAgainText}>🔄 Попробовать ещё раз</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

    </ScrollView>
    </>
  );
}

const achieveStyles = StyleSheet.create({
  overlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 200 },
  modal:       { backgroundColor: Colors.bg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '85%', padding: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalTitle:  { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  closeBtn:    { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  closeBtnText:{ fontSize: 16, color: Colors.textSecondary, fontWeight: '700' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.xl },
});

const trainerStyles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, paddingTop: Spacing.md },
  gamificationHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.sm,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  gamificationLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginRight: Spacing.sm },
  gamificationRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trophyBtn:         { alignItems: 'center', backgroundColor: Colors.yellowDark + '20', borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.yellowDark + '40' },
  trophyEmoji:       { fontSize: 18 },
  trophyCount:       { fontSize: 10, fontWeight: '700', color: Colors.yellowDark },
  mascotArea: { alignItems: 'center', marginBottom: Spacing.lg },
  foxCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,140,66,0.15)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF8C42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  foxEmoji: { fontSize: 52, textAlign: 'center', lineHeight: 100 },
  mascotCaption: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600', marginTop: Spacing.sm },
  sectionLabel: { ...Typography.label, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    minWidth: 56, alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  chipText: { fontSize: 18, fontWeight: '800', color: Colors.textSecondary },
  wordCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 2, padding: Spacing.lg, alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  wordCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  wordCardLabel: { ...Typography.label },
  wordBig: { fontSize: 52, fontWeight: '900', letterSpacing: -1, marginBottom: Spacing.md },
  wordExamples: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  exampleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1.5,
    backgroundColor: Colors.bg,
  },
  exampleChipText: { fontSize: 13, fontWeight: '700' },
  recordArea: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.md },
  analyzingContainer: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  analyzingEmoji: { fontSize: 40 },
  analyzingText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  recordBtn: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.coral,
    justifyContent: 'center', alignItems: 'center',
    gap: 4,
    shadowColor: Colors.coral, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  recordBtnActive: { backgroundColor: Colors.coralDark },
  recordBtnEmoji: { fontSize: 32 },
  recordBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  recordHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  result: { gap: Spacing.md },
  accuracyCard: {
    borderRadius: Radius.xl, borderWidth: 2, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.xs,
  },
  accuracyEmoji: { fontSize: 40 },
  accuracyNumber: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  accuracyLabelText: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  accuracyMsg: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  transcriptionCard: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  transcriptionLabel: { ...Typography.label, marginBottom: 4 },
  transcriptionText: { fontSize: 16, color: Colors.textPrimary, fontStyle: 'italic', fontWeight: '600' },
  disordersSection: { gap: Spacing.sm },
  disordersTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  disorderCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs,
  },
  disorderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  disorderName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  severityBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  severityText: { fontSize: 11, fontWeight: '700' },
  errorsList: { gap: 2 },
  errorItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  recSection: { gap: Spacing.xs },
  recTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  recItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, backgroundColor: Colors.yellow + '15', borderRadius: Radius.sm, padding: Spacing.sm },
  tryAgainBtn: {
    backgroundColor: Colors.coral, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, alignItems: 'center',
    shadowColor: Colors.coral, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  tryAgainText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

// ── Root ───────────────────────────────────────────────────────────────────────

export default function ChildScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [pinAuthenticated, setPinAuthenticated] = useState(false);

  const isChild = user?.role === 'child';
  const showTrainer = isChild || pinAuthenticated;

  if (isLoading) {
    return (
      <SafeAreaView style={rootStyles.safe}>
        <View style={rootStyles.centered}>
          <Text style={{ fontSize: 48 }}>🦊</Text>
          <ActivityIndicator color={Colors.coral} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={rootStyles.safe}>
      {/* Header */}
      <View style={rootStyles.header}>
        <TouchableOpacity style={rootStyles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={rootStyles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={rootStyles.headerTitle}>🎤 Тренировка речи</Text>
        <View style={{ width: 40 }}>
          {showTrainer && user && (
            <Text style={rootStyles.headerUser} numberOfLines={1}>{user.name}</Text>
          )}
        </View>
      </View>

      {showTrainer ? (
        <TrainerContent userId={user?.id} />
      ) : (
        <LoginScreen onSuccess={() => setPinAuthenticated(true)} />
      )}
    </SafeAreaView>
  );
}

const rootStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.coralLight, justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 20, color: Colors.coral, fontWeight: '700' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  headerUser: { fontSize: 11, color: Colors.textMuted, textAlign: 'right' },
});
