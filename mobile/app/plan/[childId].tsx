import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { getActivePlan, type Plan, type PlanExercise } from '@/services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
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

const EXERCISE_COLORS = [
  Colors.coral,
  Colors.teal,
  Colors.purple,
  Colors.green,
  Colors.orange,
  '#FFD93D',
];

function getExerciseColor(index: number): string {
  return EXERCISE_COLORS[index % EXERCISE_COLORS.length];
}

// ── Status badge ──────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: Plan['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    active: { label: 'Активен', bg: Colors.green + '20', border: Colors.green + '40', text: Colors.green },
    paused: { label: 'Пауза', bg: Colors.orange + '20', border: Colors.orange + '40', text: Colors.orange },
    completed: { label: 'Завершён', bg: Colors.textMuted + '20', border: Colors.textMuted + '30', text: Colors.textMuted },
  }[status];

  return (
    <View style={[badge.wrap, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[badge.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ── Exercise card ─────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: PlanExercise;
  index: number;
  onTrain: () => void;
}

function ExerciseCard({ exercise, index, onTrain }: ExerciseCardProps) {
  const color = getExerciseColor(index);
  const words = parseWords(exercise.words);

  return (
    <View style={ex.card}>
      {/* Top row: circle + info */}
      <View style={ex.topRow}>
        <View style={[ex.soundCircle, { backgroundColor: color + '25', borderColor: color + '60' }]}>
          <Text style={[ex.soundLetter, { color }]}>{exercise.sound_letter}</Text>
        </View>
        <View style={ex.infoCol}>
          <Text style={ex.soundName}>Звук {exercise.sound_letter}</Text>
          <Text style={ex.targetAccuracy}>Цель: {exercise.target_accuracy}%</Text>
        </View>
      </View>

      {/* Words to practice */}
      {words.length > 0 && (
        <View style={ex.wordsSection}>
          <Text style={ex.wordsLabel}>Слова для тренировки</Text>
          <View style={ex.wordsRow}>
            {words.map((word) => (
              <View key={word} style={[ex.wordChip, { borderColor: color + '40', backgroundColor: color + '12' }]}>
                <Text style={[ex.wordChipText, { color }]}>{word}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Train button */}
      <TouchableOpacity
        style={[ex.trainBtn, { backgroundColor: color }]}
        onPress={onTrain}
        activeOpacity={0.85}
      >
        <Ionicons name="mic-outline" size={18} color="#fff" />
        <Text style={ex.trainBtnText}>Тренировать</Text>
      </TouchableOpacity>
    </View>
  );
}

const ex = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  soundCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  soundLetter: {
    fontSize: 26,
    fontWeight: '900',
  },
  infoCol: {
    flex: 1,
    gap: 4,
  },
  soundName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  targetAccuracy: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  wordsSection: {
    gap: Spacing.sm,
  },
  wordsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  wordChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  wordChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 50,
    borderRadius: Radius.md,
  },
  trainBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const childIdNum = parseInt(childId, 10);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getActivePlan(childIdNum);
      setPlan(res.plan ?? null);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки плана');
    } finally {
      setLoading(false);
    }
  }, [childIdNum]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleTrain = useCallback(
    (exercise: PlanExercise) => {
      const words = parseWords(exercise.words);
      const firstWord = words[0] ?? '';
      router.push(`/child?sound=${exercise.sound}&word=${encodeURIComponent(firstWord)}` as any);
    },
    [router],
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Мой план</Text>
          <View style={s.iconBtn} />
        </View>
        <View style={s.centered}>
          <ActivityIndicator color={Colors.coral} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Мой план</Text>
          <View style={s.iconBtn} />
        </View>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.red} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadPlan} activeOpacity={0.85}>
            <Text style={s.retryBtnText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Мой план</Text>
        <View style={s.iconBtn} />
      </View>

      {!plan ? (
        /* ── Empty state ── */
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>📋</Text>
          <Text style={s.emptyTitle}>Нет активного плана</Text>
          <Text style={s.emptySubtitle}>Твой логопед ещё не создал план занятий</Text>
        </View>
      ) : (
        /* ── Plan content ── */
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan header card */}
          <View style={s.planHeaderCard}>
            <View style={s.planHeaderTop}>
              <View style={s.flex}>
                <Text style={s.planTitle}>{plan.title}</Text>
                {plan.description ? (
                  <Text style={s.planDescription}>{plan.description}</Text>
                ) : null}
              </View>
              <StatusBadge status={plan.status} />
            </View>

            <View style={s.planMeta}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
              <Text style={s.planMetaText}>Создан {formatDate(plan.created_at)}</Text>
              <Text style={s.planMetaDot}>·</Text>
              <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
              <Text style={s.planMetaText}>{plan.exercises.length} упражнений</Text>
            </View>
          </View>

          {/* Exercises section */}
          {plan.exercises.length > 0 && (
            <View style={s.exercisesSection}>
              <Text style={s.exercisesSectionTitle}>Упражнения</Text>
              {plan.exercises
                .slice()
                .sort((a, b) => a.order_index - b.order_index)
                .map((exercise, idx) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    index={idx}
                    onTrain={() => handleTrain(exercise)}
                  />
                ))}
            </View>
          )}

          {/* Motivation note */}
          <View style={s.motivationNote}>
            <Ionicons name="star-outline" size={20} color={Colors.orange} />
            <Text style={s.motivationText}>
              Занимайся каждый день для лучших результатов!
            </Text>
          </View>
        </ScrollView>
      )}
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
    backgroundColor: Colors.coral,
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

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 72,
    lineHeight: 88,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 48,
    gap: Spacing.lg,
  },

  // Plan header card
  planHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  planHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  planTitle: {
    ...Typography.h3,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  planMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  planMetaDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Exercises section
  exercisesSection: {
    gap: Spacing.md,
  },
  exercisesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Motivation note
  motivationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.orange + '15',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.orange + '30',
    padding: Spacing.md,
  },
  motivationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.orange,
    fontWeight: '600',
    lineHeight: 20,
  },
});
