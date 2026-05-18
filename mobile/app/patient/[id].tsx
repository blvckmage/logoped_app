import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getUser,
  getUserStats,
  getUserAttempts,
  getActivePlan,
  createPlan,
  updatePlanStatus,
  deletePlan,
  type User,
  type Plan,
  type PlanExercise,
} from '@/services/api';

// ── Available sounds ──────────────────────────────────────────────────────────

const AVAILABLE_SOUNDS = [
  { sound: 'р', sound_letter: 'Р', words: ['Рама', 'Рак', 'Рыба', 'Рука'] },
  { sound: 'л', sound_letter: 'Л', words: ['Лампа', 'Луна', 'Ложка', 'Лиса'] },
  { sound: 'қ', sound_letter: 'Қ', words: ['Қала', 'Қар', 'Қол', 'Қас'] },
  { sound: 'с', sound_letter: 'С', words: ['Сыр', 'Сан', 'Су'] },
  { sound: 'ш', sound_letter: 'Ш', words: ['Шар', 'Шелек', 'Шаш', 'Шығу'] },
  { sound: 'ч', sound_letter: 'Ч', words: ['Чашка', 'Чай'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseWords(wordsJson: string): string[] {
  try {
    const parsed = JSON.parse(wordsJson);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return wordsJson.split(',').map((w) => w.trim()).filter(Boolean);
  }
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return Colors.green;
  if (accuracy >= 50) return Colors.orange;
  return Colors.red;
}

const SOUND_COLORS = [Colors.coral, Colors.teal, Colors.purple, Colors.green, Colors.orange, Colors.yellow ?? Colors.orange];

function getSoundColor(index: number): string {
  return SOUND_COLORS[index % SOUND_COLORS.length];
}

// ── Create Plan Modal ─────────────────────────────────────────────────────────

interface SoundConfig {
  sound: string;
  sound_letter: string;
  words: string[];
  target_accuracy: string;
  sessions_target: string;
}

interface CreatePlanModalProps {
  visible: boolean;
  patientId: number;
  onClose: () => void;
  onCreated: () => void;
}

function CreatePlanModal({ visible, patientId, onClose, onCreated }: CreatePlanModalProps) {
  const [title, setTitle] = useState('Индивидуальный план');
  const [description, setDescription] = useState('');
  const [selectedSounds, setSelectedSounds] = useState<Record<string, SoundConfig>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setTitle('Индивидуальный план');
    setDescription('');
    setSelectedSounds({});
    setError('');
    setIsCreating(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const toggleSound = useCallback((s: typeof AVAILABLE_SOUNDS[0]) => {
    setSelectedSounds((prev) => {
      if (prev[s.sound]) {
        const next = { ...prev };
        delete next[s.sound];
        return next;
      }
      return {
        ...prev,
        [s.sound]: {
          sound: s.sound,
          sound_letter: s.sound_letter,
          words: s.words,
          target_accuracy: '80',
          sessions_target: '5',
        },
      };
    });
  }, []);

  const updateSoundConfig = useCallback(
    (sound: string, field: 'target_accuracy' | 'sessions_target', value: string) => {
      setSelectedSounds((prev) => ({
        ...prev,
        [sound]: { ...prev[sound], [field]: value },
      }));
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      setError('Введите название плана');
      return;
    }
    const keys = Object.keys(selectedSounds);
    if (keys.length === 0) {
      setError('Выберите хотя бы один звук');
      return;
    }
    setError('');
    setIsCreating(true);
    try {
      const exercises = keys.map((k) => {
        const sc = selectedSounds[k];
        return {
          sound: sc.sound,
          sound_letter: sc.sound_letter,
          words: sc.words,
          target_accuracy: Math.min(100, Math.max(0, parseInt(sc.target_accuracy, 10) || 80)),
          sessions_target: Math.max(1, parseInt(sc.sessions_target, 10) || 5),
        };
      });
      await createPlan({
        child_id: patientId,
        title: title.trim(),
        description: description.trim(),
        exercises,
      });
      reset();
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать план');
    } finally {
      setIsCreating(false);
    }
  }, [title, description, selectedSounds, patientId, reset, onCreated]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={modalStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={modalStyles.backdrop} onPress={handleClose}>
          <Pressable style={modalStyles.sheet} onPress={() => {}}>
            {/* Handle bar */}
            <View style={modalStyles.handleBar} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={modalStyles.scrollContent}
            >
              {/* Header */}
              <View style={modalStyles.headerRow}>
                <Text style={modalStyles.sheetTitle}>Создать план занятий</Text>
                <TouchableOpacity onPress={handleClose} style={modalStyles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Title input */}
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Название плана</Text>
                <TextInput
                  style={modalStyles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Индивидуальный план"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="next"
                />
              </View>

              {/* Description input */}
              <View style={modalStyles.fieldGroup}>
                <Text style={modalStyles.fieldLabel}>Описание (необязательно)</Text>
                <TextInput
                  style={[modalStyles.textInput, modalStyles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Цели и особенности занятий..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Sound picker */}
              <Text style={modalStyles.sectionLabel}>Выберите звуки для работы</Text>
              <View style={modalStyles.soundChipsRow}>
                {AVAILABLE_SOUNDS.map((s) => {
                  const isSelected = !!selectedSounds[s.sound];
                  return (
                    <TouchableOpacity
                      key={s.sound}
                      style={[modalStyles.soundChip, isSelected && modalStyles.soundChipSelected]}
                      onPress={() => toggleSound(s)}
                      activeOpacity={0.8}
                    >
                      <Text style={[modalStyles.soundChipText, isSelected && modalStyles.soundChipTextSelected]}>
                        {s.sound_letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Per-sound config */}
              {Object.values(selectedSounds).map((sc, idx) => (
                <View key={sc.sound} style={[modalStyles.soundConfig, { borderLeftColor: getSoundColor(idx) }]}>
                  <View style={modalStyles.soundConfigHeader}>
                    <View style={[modalStyles.soundCircleSmall, { backgroundColor: getSoundColor(idx) + '30', borderColor: getSoundColor(idx) + '60' }]}>
                      <Text style={[modalStyles.soundCircleSmallText, { color: getSoundColor(idx) }]}>{sc.sound_letter}</Text>
                    </View>
                    <Text style={modalStyles.soundConfigTitle}>Звук «{sc.sound_letter}»</Text>
                  </View>
                  <View style={modalStyles.soundConfigRow}>
                    <View style={modalStyles.soundConfigField}>
                      <Text style={modalStyles.soundConfigLabel}>Цель точности (%)</Text>
                      <TextInput
                        style={modalStyles.soundConfigInput}
                        value={sc.target_accuracy}
                        onChangeText={(v) => updateSoundConfig(sc.sound, 'target_accuracy', v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={modalStyles.soundConfigField}>
                      <Text style={modalStyles.soundConfigLabel}>Кол-во занятий</Text>
                      <TextInput
                        style={modalStyles.soundConfigInput}
                        value={sc.sessions_target}
                        onChangeText={(v) => updateSoundConfig(sc.sound, 'sessions_target', v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>
                  <View style={modalStyles.wordChipsRow}>
                    {sc.words.map((w) => (
                      <View key={w} style={modalStyles.wordChipSmall}>
                        <Text style={modalStyles.wordChipSmallText}>{w}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}

              {/* Error */}
              {error.length > 0 && (
                <View style={modalStyles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.red} />
                  <Text style={modalStyles.errorText}>{error}</Text>
                </View>
              )}

              {/* Submit button */}
              <TouchableOpacity
                style={[modalStyles.createBtn, isCreating && modalStyles.createBtnDisabled]}
                onPress={handleCreate}
                disabled={isCreating}
                activeOpacity={0.85}
              >
                {isCreating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={modalStyles.createBtnText}>Создать план</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '92%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl + 20,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
  },
  sheetTitle: {
    ...Typography.h3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    color: Colors.textPrimary,
    height: 48,
  },
  textArea: {
    height: 88,
    paddingTop: Spacing.sm + 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  soundChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  soundChip: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soundChipSelected: {
    backgroundColor: Colors.purple + '20',
    borderColor: Colors.purple,
  },
  soundChipText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  soundChipTextSelected: {
    color: Colors.purple,
  },
  soundConfig: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  soundConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  soundCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soundCircleSmallText: {
    fontSize: 15,
    fontWeight: '800',
  },
  soundConfigTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  soundConfigRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  soundConfigField: {
    flex: 1,
    gap: Spacing.xs,
  },
  soundConfigLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  soundConfigInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    height: 44,
    textAlign: 'center',
  },
  wordChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  wordChipSmall: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordChipSmallText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
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
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.red,
    lineHeight: 18,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.purple,
    borderRadius: Radius.md,
    height: 54,
    marginTop: Spacing.sm,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PatientDetailScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = parseInt(id, 10);

  const [patient, setPatient] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [planActionLoading, setPlanActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userRes, statsRes, attemptsRes, planRes] = await Promise.all([
        getUser(patientId),
        getUserStats(patientId),
        getUserAttempts(patientId, 10),
        getActivePlan(patientId),
      ]);
      setPatient(userRes.user ?? userRes);
      setStats(statsRes.stats ?? statsRes);
      setAttempts(attemptsRes.attempts ?? []);
      setActivePlan(planRes.plan ?? null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCompletePlan = useCallback(() => {
    if (!activePlan) return;
    Alert.alert(
      'Завершить план',
      'Вы уверены, что хотите завершить этот план?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          style: 'default',
          onPress: async () => {
            setPlanActionLoading(true);
            try {
              await updatePlanStatus(activePlan.id, 'completed');
              await loadData();
            } catch (err: any) {
              Alert.alert('Ошибка', err.message || 'Не удалось завершить план');
            } finally {
              setPlanActionLoading(false);
            }
          },
        },
      ],
    );
  }, [activePlan, loadData]);

  const handleDeletePlan = useCallback(() => {
    if (!activePlan) return;
    Alert.alert(
      'Удалить план',
      'Вы уверены? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setPlanActionLoading(true);
            try {
              await deletePlan(activePlan.id);
              await loadData();
            } catch (err: any) {
              Alert.alert('Ошибка', err.message || 'Не удалось удалить план');
            } finally {
              setPlanActionLoading(false);
            }
          },
        },
      ],
    );
  }, [activePlan, loadData]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login' as any);
  }, [logout, router]);

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.centered}>
          <ActivityIndicator color={Colors.purple} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !patient) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Пациент</Text>
          <View style={s.iconBtn} />
        </View>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.red} />
          <Text style={s.errorText}>{error || 'Пациент не найден'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadData} activeOpacity={0.85}>
            <Text style={s.retryBtnText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const problemSounds: string[] = stats?.problem_sounds ?? [];
  const soundProgress: any[] = stats?.sound_progress ?? [];
  const breakdown = stats?.accuracy_breakdown ?? { excellent: 0, good: 0, needs_practice: 0 };
  const totalBreakdown = (breakdown.excellent + breakdown.good + breakdown.needs_practice) || 1;

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Пациент</Text>
        <TouchableOpacity onPress={handleLogout} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Patient card */}
        <View style={s.patientCard}>
          <View style={s.avatarLarge}>
            <Text style={s.avatarLetter}>{patient.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.patientName}>{patient.name}</Text>
          {patient.age != null && (
            <Text style={s.patientAge}>{patient.age} лет</Text>
          )}
          {problemSounds.length > 0 && (
            <View style={s.problemChipsRow}>
              {problemSounds.map((sound) => (
                <View key={sound} style={s.problemChip}>
                  <Text style={s.problemChipText}>{sound}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: Colors.teal }]}>{stats?.total_minutes ?? 0}</Text>
            <Text style={s.statLabel}>минут</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: Colors.purple }]}>{stats?.total_attempts ?? 0}</Text>
            <Text style={s.statLabel}>попыток</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: Colors.green }]}>{Math.round(stats?.avg_accuracy ?? 0)}%</Text>
            <Text style={s.statLabel}>точность</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: Colors.orange }]}>{problemSounds.length}</Text>
            <Text style={s.statLabel}>проблем. звуков</Text>
          </View>
        </View>

        {/* Active plan section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Индивидуальный план</Text>

          {activePlan ? (
            <View style={s.planCard}>
              {/* Plan header */}
              <View style={s.planCardHeader}>
                <View style={s.flex}>
                  <Text style={s.planTitle}>{activePlan.title}</Text>
                  {activePlan.description ? (
                    <Text style={s.planDescription}>{activePlan.description}</Text>
                  ) : null}
                </View>
                <View style={[s.statusBadge, s[`status_${activePlan.status}`]]}>
                  <Text style={[s.statusBadgeText, s[`statusText_${activePlan.status}`]]}>
                    {activePlan.status === 'active' ? 'Активен' : activePlan.status === 'paused' ? 'Пауза' : 'Завершён'}
                  </Text>
                </View>
              </View>

              <View style={s.planMeta}>
                <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
                <Text style={s.planMetaText}>{activePlan.exercises.length} упражнений</Text>
                <Text style={s.planMetaDot}>·</Text>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={s.planMetaText}>{formatDate(activePlan.created_at)}</Text>
              </View>

              {/* Exercises */}
              {activePlan.exercises.length > 0 && (
                <View style={s.exercisesList}>
                  {activePlan.exercises.map((ex, idx) => {
                    const words = parseWords(ex.words);
                    const color = getSoundColor(idx);
                    return (
                      <View key={ex.id} style={s.exerciseItem}>
                        <View style={[s.soundCircle, { backgroundColor: color + '25', borderColor: color + '50' }]}>
                          <Text style={[s.soundLetter, { color }]}>{ex.sound_letter}</Text>
                        </View>
                        <View style={s.exerciseInfo}>
                          <Text style={s.exerciseSoundName}>Звук «{ex.sound_letter}»</Text>
                          <Text style={s.exerciseTarget}>Цель: {ex.target_accuracy}%</Text>
                          <View style={s.exerciseWordChips}>
                            {words.map((w) => (
                              <View key={w} style={s.wordChip}>
                                <Text style={s.wordChipText}>{w}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Plan actions */}
              {planActionLoading ? (
                <ActivityIndicator color={Colors.purple} style={{ marginTop: Spacing.sm }} />
              ) : (
                <View style={s.planActions}>
                  <TouchableOpacity
                    style={s.completePlanBtn}
                    onPress={handleCompletePlan}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={Colors.green} />
                    <Text style={s.completePlanBtnText}>Завершить план</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.deletePlanBtn}
                    onPress={handleDeletePlan}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.red} />
                    <Text style={s.deletePlanBtnText}>Удалить план</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={s.noPlanCard}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
              <Text style={s.noPlanText}>Нет активного плана</Text>
              <TouchableOpacity
                style={s.createPlanBtn}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.createPlanBtnText}>Создать план</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Accuracy breakdown */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Результаты</Text>
          <View style={s.breakdownCard}>
            {/* Excellent */}
            <View style={s.breakdownRow}>
              <View style={[s.breakdownDot, { backgroundColor: Colors.green }]} />
              <Text style={s.breakdownLabel}>Отлично (≥80%)</Text>
              <View style={s.breakdownBarBg}>
                <View
                  style={[
                    s.breakdownBarFill,
                    {
                      width: `${Math.round((breakdown.excellent / totalBreakdown) * 100)}%` as any,
                      backgroundColor: Colors.green,
                    },
                  ]}
                />
              </View>
              <Text style={[s.breakdownCount, { color: Colors.green }]}>{breakdown.excellent}</Text>
            </View>
            {/* Good */}
            <View style={s.breakdownRow}>
              <View style={[s.breakdownDot, { backgroundColor: Colors.orange }]} />
              <Text style={s.breakdownLabel}>Хорошо (50–79%)</Text>
              <View style={s.breakdownBarBg}>
                <View
                  style={[
                    s.breakdownBarFill,
                    {
                      width: `${Math.round((breakdown.good / totalBreakdown) * 100)}%` as any,
                      backgroundColor: Colors.orange,
                    },
                  ]}
                />
              </View>
              <Text style={[s.breakdownCount, { color: Colors.orange }]}>{breakdown.good}</Text>
            </View>
            {/* Needs practice */}
            <View style={s.breakdownRow}>
              <View style={[s.breakdownDot, { backgroundColor: Colors.red }]} />
              <Text style={s.breakdownLabel}>Нужна работа (&lt;50%)</Text>
              <View style={s.breakdownBarBg}>
                <View
                  style={[
                    s.breakdownBarFill,
                    {
                      width: `${Math.round((breakdown.needs_practice / totalBreakdown) * 100)}%` as any,
                      backgroundColor: Colors.red,
                    },
                  ]}
                />
              </View>
              <Text style={[s.breakdownCount, { color: Colors.red }]}>{breakdown.needs_practice}</Text>
            </View>
          </View>
        </View>

        {/* Sound progress */}
        {soundProgress.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Прогресс по звукам</Text>
            <View style={s.soundProgressList}>
              {soundProgress.map((sp: any, idx: number) => {
                const color = getAccuracyColor(sp.accuracy);
                return (
                  <View key={sp.sound + idx} style={s.soundProgressItem}>
                    <View style={[s.soundCircleSmall, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                      <Text style={[s.soundLetterSmall, { color }]}>{sp.sound_letter || sp.sound}</Text>
                    </View>
                    <View style={s.soundProgressInfo}>
                      <View style={s.soundProgressTopRow}>
                        <Text style={s.soundProgressName}>Звук «{sp.sound_letter || sp.sound}»</Text>
                        <Text style={[s.soundProgressAcc, { color }]}>{Math.round(sp.accuracy)}%</Text>
                      </View>
                      <View style={s.soundProgressBarBg}>
                        <View
                          style={[
                            s.soundProgressBarFill,
                            { width: `${Math.min(sp.accuracy, 100)}%` as any, backgroundColor: color },
                          ]}
                        />
                      </View>
                      <Text style={s.soundProgressAttempts}>{sp.attempts_count} попыток</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent attempts */}
        {attempts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Последние попытки</Text>
            <View style={s.attemptsList}>
              {attempts.map((attempt: any) => {
                const accColor = getAccuracyColor(attempt.accuracy);
                return (
                  <View key={attempt.id} style={s.attemptItem}>
                    <View style={s.attemptTopRow}>
                      <Text style={s.attemptWord}>{attempt.target_word}</Text>
                      <Text style={[s.attemptAcc, { color: accColor }]}>{Math.round(attempt.accuracy)}%</Text>
                    </View>
                    {attempt.transcription ? (
                      <Text style={s.attemptTranscription}>«{attempt.transcription}»</Text>
                    ) : null}
                    <View style={s.attemptBarBg}>
                      <View
                        style={[
                          s.attemptBarFill,
                          { width: `${Math.min(attempt.accuracy, 100)}%` as any, backgroundColor: accColor },
                        ]}
                      />
                    </View>
                    <Text style={s.attemptDate}>{formatDate(attempt.created_at)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Create Plan Modal */}
      <CreatePlanModal
        visible={showCreateModal}
        patientId={patientId}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          loadData();
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 15,
    color: Colors.red,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: Colors.purple,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    ...Typography.h3,
    textAlign: 'center',
  },

  // Scroll
  scrollContent: {
    paddingBottom: 48,
    gap: Spacing.md,
  },

  // Patient card
  patientCard: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.purple + '30',
    borderWidth: 3,
    borderColor: Colors.purple + '60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.purple,
  },
  patientName: {
    ...Typography.h2,
    textAlign: 'center',
  },
  patientAge: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  problemChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  problemChip: {
    backgroundColor: Colors.red + '20',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.red + '40',
  },
  problemChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.red,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  // Section
  section: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Plan card
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  planDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  statusBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    flexShrink: 0,
  },
  status_active: {
    backgroundColor: Colors.green + '20',
    borderColor: Colors.green + '40',
  },
  status_paused: {
    backgroundColor: Colors.orange + '20',
    borderColor: Colors.orange + '40',
  },
  status_completed: {
    backgroundColor: Colors.textMuted + '20',
    borderColor: Colors.textMuted + '40',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusText_active: { color: Colors.green },
  statusText_paused: { color: Colors.orange },
  statusText_completed: { color: Colors.textMuted },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  planMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  planMetaDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Exercises list
  exercisesList: {
    gap: Spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  soundCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  soundLetter: {
    fontSize: 18,
    fontWeight: '800',
  },
  exerciseInfo: {
    flex: 1,
    gap: 4,
  },
  exerciseSoundName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  exerciseTarget: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  exerciseWordChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  wordChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Plan actions
  planActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  completePlanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.green + '15',
    borderWidth: 1,
    borderColor: Colors.green + '40',
  },
  completePlanBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.green,
  },
  deletePlanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.red + '15',
    borderWidth: 1,
    borderColor: Colors.red + '40',
  },
  deletePlanBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.red,
  },

  // No plan
  noPlanCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noPlanText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  createPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.purple,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  createPlanBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Breakdown
  breakdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    width: 130,
    flexShrink: 0,
  },
  breakdownBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: 8,
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'right',
  },

  // Sound progress
  soundProgressList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  soundProgressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  soundCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  soundLetterSmall: {
    fontSize: 16,
    fontWeight: '800',
  },
  soundProgressInfo: {
    flex: 1,
    gap: 4,
  },
  soundProgressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundProgressName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  soundProgressAcc: {
    fontSize: 14,
    fontWeight: '800',
  },
  soundProgressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  soundProgressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  soundProgressAttempts: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Attempts
  attemptsList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  attemptItem: {
    padding: Spacing.md,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  attemptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attemptWord: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  attemptAcc: {
    fontSize: 15,
    fontWeight: '800',
  },
  attemptTranscription: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  attemptBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  attemptBarFill: {
    height: 4,
    borderRadius: 2,
  },
  attemptDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
} as any);
