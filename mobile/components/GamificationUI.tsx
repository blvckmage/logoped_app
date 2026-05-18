/**
 * GamificationUI — reusable gamification components for the speech therapy app.
 * Animations use only React Native's built-in Animated API (no external libraries).
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Achievement, Gamification } from '@/services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Level color map ────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, string> = {
  1: '#A8E6CF',
  2: '#4FC3F7',
  3: '#FFE066',
  4: '#FFB347',
  5: '#56C596',
  6: '#9C6FD6',
  7: '#FF6B6B',
  8: '#FF8C42',
  9: '#C0C0C0',
  10: '#FFD700',
};

export function getLevelColor(level: number): string {
  return LEVEL_COLORS[Math.min(Math.max(level, 1), 10)] ?? '#A8E6CF';
}

// ── StarsRow ─────────────────────────────────────────────────────────────────

interface StarsRowProps {
  count: number;
  size?: number;
}

export function StarsRow({ count, size = 28 }: StarsRowProps) {
  return (
    <View style={starsRowStyles.row}>
      {[1, 2, 3].map((i) => (
        <Text
          key={i}
          style={[starsRowStyles.star, { fontSize: size, opacity: i <= count ? 1 : 0.2 }]}
        >
          ⭐
        </Text>
      ))}
    </View>
  );
}

const starsRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { lineHeight: 36 },
});

// ── StarBurst ──────────────────────────────────────────────────────────────────

interface StarBurstProps {
  stars: number;
  visible: boolean;
  onDone: () => void;
}

export function StarBurst({ stars, visible, onDone }: StarBurstProps) {
  const anims = useRef([
    new Animated.ValueXY({ x: 0, y: 0 }),
    new Animated.ValueXY({ x: 0, y: 0 }),
    new Animated.ValueXY({ x: 0, y: 0 }),
  ]).current;
  const scales = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const opacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (!visible) return;

    const targets = [
      { x: -60, y: -90 },
      { x: 0,   y: -120 },
      { x: 60,  y: -90 },
    ];

    // Reset
    anims.forEach((a) => a.setValue({ x: 0, y: 0 }));
    scales.forEach((s) => s.setValue(0));
    opacities.forEach((o) => o.setValue(0));

    const count = Math.min(stars, 3);
    const animations = targets.slice(0, count).map((target, i) =>
      Animated.sequence([
        Animated.delay(i * 150),
        Animated.parallel([
          Animated.spring(anims[i], {
            toValue: target,
            useNativeDriver: true,
            damping: 10,
            stiffness: 150,
          }),
          Animated.spring(scales[i], {
            toValue: 1.4,
            useNativeDriver: true,
            damping: 8,
            stiffness: 200,
          }),
          Animated.timing(opacities[i], {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scales[i], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
            delay: 600,
          }),
          Animated.timing(opacities[i], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
            delay: 600,
          }),
        ]),
      ])
    );

    Animated.parallel(animations).start(() => {
      onDone();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={starBurstStyles.container} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <Animated.Text
          key={i}
          style={[
            starBurstStyles.star,
            {
              opacity: opacities[i],
              transform: [
                { translateX: anims[i].x },
                { translateY: anims[i].y },
                { scale: scales[i] },
              ],
            },
          ]}
        >
          ⭐
        </Animated.Text>
      ))}
    </View>
  );
}

const starBurstStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  star: { fontSize: 36, position: 'absolute' },
});

// ── XpBar ─────────────────────────────────────────────────────────────────────

interface XpBarProps {
  xp: number;
  level: number;
  xpCurrentLevel: number;
  xpNextLevel: number | null;
}

export function XpBar({ xp, level, xpCurrentLevel, xpNextLevel }: XpBarProps) {
  const levelColor = getLevelColor(level);
  const progress = xpNextLevel
    ? Math.min((xp - xpCurrentLevel) / (xpNextLevel - xpCurrentLevel), 1)
    : 1;

  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={xpBarStyles.container}>
      <View style={xpBarStyles.row}>
        <LevelBadge level={level} size="sm" />
        <View style={{ flex: 1 }}>
          <View style={xpBarStyles.track}>
            <Animated.View
              style={[
                xpBarStyles.fill,
                { width: barWidth, backgroundColor: levelColor },
              ]}
            />
          </View>
          <Text style={xpBarStyles.xpText}>
            {xp} XP
            {xpNextLevel ? ` / ${xpNextLevel} XP` : ' (MAX)'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const xpBarStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: {
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: { height: '100%', borderRadius: Radius.full },
  xpText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
});

// ── LevelBadge ────────────────────────────────────────────────────────────────

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const levelColor = getLevelColor(level);
  const dim = size === 'sm' ? 36 : size === 'lg' ? 64 : 48;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 24 : 18;

  return (
    <View
      style={[
        levelBadgeStyles.badge,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: levelColor + '30',
          borderColor: levelColor,
        },
      ]}
    >
      <Text style={[levelBadgeStyles.text, { fontSize, color: levelColor }]}>
        {level}
      </Text>
    </View>
  );
}

const levelBadgeStyles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { fontWeight: '900' },
});

// ── AchievementCard ───────────────────────────────────────────────────────────

interface AchievementCardProps {
  achievement: Achievement;
}

export function AchievementCard({ achievement }: AchievementCardProps) {
  const opacity = achievement.unlocked ? 1 : 0.4;

  return (
    <View
      style={[
        achStyles.card,
        achievement.unlocked && achStyles.cardUnlocked,
      ]}
    >
      <Text style={[achStyles.emoji, { opacity }]}>{achievement.emoji}</Text>
      <View style={achStyles.info}>
        <Text style={[achStyles.title, { opacity }]}>{achievement.title}</Text>
        <Text style={achStyles.desc} numberOfLines={2}>{achievement.desc}</Text>
        {achievement.unlocked && achievement.unlocked_at && (
          <Text style={achStyles.unlockedAt}>
            Получено {new Date(achievement.unlocked_at).toLocaleDateString('ru-RU')}
          </Text>
        )}
      </View>
      <View style={achStyles.xpBadge}>
        <Text style={achStyles.xpText}>+{achievement.xp_bonus}</Text>
        <Text style={achStyles.xpLabel}>XP</Text>
      </View>
    </View>
  );
}

const achStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cardUnlocked: {
    borderColor: Colors.yellow,
    backgroundColor: Colors.yellow + '10',
  },
  emoji: { fontSize: 32, width: 44, textAlign: 'center' },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  desc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
  unlockedAt: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  xpBadge: {
    alignItems: 'center',
    backgroundColor: Colors.yellow + '30',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minWidth: 40,
  },
  xpText: { fontSize: 13, fontWeight: '900', color: Colors.yellowDark },
  xpLabel: { fontSize: 9, fontWeight: '700', color: Colors.yellowDark, letterSpacing: 0.5 },
});

// ── LevelUpModal ──────────────────────────────────────────────────────────────

interface LevelUpModalProps {
  visible: boolean;
  oldLevel: number;
  newLevel: number;
  onClose: () => void;
}

export function LevelUpModal({ visible, oldLevel, newLevel, onClose }: LevelUpModalProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const levelColor = getLevelColor(newLevel);

  useEffect(() => {
    if (visible) {
      scale.setValue(0.4);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 200,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={levelUpStyles.overlay}>
        <Confetti visible={visible} />
        <Animated.View
          style={[
            levelUpStyles.card,
            { transform: [{ scale }], opacity },
          ]}
        >
          <Text style={levelUpStyles.celebrationEmoji}>🎉</Text>
          <Text style={levelUpStyles.levelUpText}>LEVEL UP!</Text>
          <View style={levelUpStyles.levelsRow}>
            <View style={[levelUpStyles.levelCircle, { backgroundColor: getLevelColor(oldLevel) + '30', borderColor: getLevelColor(oldLevel) }]}>
              <Text style={[levelUpStyles.levelNum, { color: getLevelColor(oldLevel) }]}>{oldLevel}</Text>
            </View>
            <Text style={levelUpStyles.arrow}>→</Text>
            <View style={[levelUpStyles.levelCircle, levelUpStyles.levelCircleBig, { backgroundColor: levelColor + '30', borderColor: levelColor }]}>
              <Text style={[levelUpStyles.levelNum, levelUpStyles.levelNumBig, { color: levelColor }]}>{newLevel}</Text>
            </View>
          </View>
          <Text style={levelUpStyles.congrats}>Поздравляю! Ты достиг уровня {newLevel}!</Text>
          <TouchableOpacity
            style={[levelUpStyles.btn, { backgroundColor: levelColor }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={levelUpStyles.btnText}>Ура! 🚀</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const levelUpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: SCREEN_W * 0.85,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  celebrationEmoji: { fontSize: 56 },
  levelUpText: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  levelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  levelCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelCircleBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
  },
  levelNum: { fontSize: 22, fontWeight: '900' },
  levelNumBig: { fontSize: 30 },
  arrow: { fontSize: 24, color: Colors.textMuted },
  congrats: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  btn: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  btnText: { fontSize: 18, fontWeight: '900', color: '#fff' },
});

// ── StreakBadge ───────────────────────────────────────────────────────────────

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null;

  const flameColor = streak >= 7 ? '#FF4500' : streak >= 3 ? '#FF6B00' : Colors.orange;

  return (
    <View style={[streakStyles.badge, { backgroundColor: flameColor + '20', borderColor: flameColor + '60' }]}>
      <Text style={streakStyles.flame}>🔥</Text>
      <Text style={[streakStyles.count, { color: flameColor }]}>{streak}</Text>
      <Text style={streakStyles.label}>дней</Text>
    </View>
  );
}

const streakStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  flame: { fontSize: 16 },
  count: { fontSize: 16, fontWeight: '900' },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
});

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  '#FF6B6B', '#4FC3F7', '#FFE066', '#56C596',
  '#9C6FD6', '#FFB347', '#FF8C42', '#A8E6CF',
  '#FFD700', '#FF69B4',
];

const NUM_CONFETTI = 20;

interface ConfettiProps {
  visible: boolean;
}

export function Confetti({ visible }: ConfettiProps) {
  const particles = useRef(
    Array.from({ length: NUM_CONFETTI }, () => ({
      x: new Animated.Value(Math.random() * SCREEN_W),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      speed: 1200 + Math.random() * 1000,
      delay: Math.random() * 600,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    particles.forEach((p) => {
      p.x.setValue(Math.random() * SCREEN_W);
      p.y.setValue(-20);
      p.rotate.setValue(0);
      p.opacity.setValue(1);
    });

    const animations = particles.map((p) =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.y, {
            toValue: SCREEN_H + 20,
            duration: p.speed,
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, {
            toValue: 720,
            duration: p.speed,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.delay(p.speed * 0.6),
            Animated.timing(p.opacity, { toValue: 0, duration: p.speed * 0.4, useNativeDriver: true }),
          ]),
        ]),
      ])
    );

    Animated.stagger(30, animations).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {particles.map((p, i) => {
        const rotateStr = p.rotate.interpolate({
          inputRange: [0, 720],
          outputRange: ['0deg', '720deg'],
        });
        return (
          <Animated.View
            key={i}
            style={[
              confettiStyles.particle,
              {
                backgroundColor: p.color,
                width: p.size,
                height: p.size * 0.6,
                borderRadius: 2,
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { rotate: rotateStr },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

// ── AchievementToast ──────────────────────────────────────────────────────────

interface AchievementToastProps {
  achievement: Achievement;
  onDone: () => void;
}

export function AchievementToast({ achievement, onDone }: AchievementToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 12,
          stiffness: 180,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <Animated.View
      style={[
        toastStyles.toast,
        { transform: [{ translateY }], opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={toastStyles.emoji}>{achievement.emoji}</Text>
      <View style={toastStyles.info}>
        <Text style={toastStyles.title}>Ачивка разблокирована!</Text>
        <Text style={toastStyles.name}>{achievement.title}</Text>
      </View>
      <View style={toastStyles.xpPill}>
        <Text style={toastStyles.xpText}>+{achievement.xp_bonus} XP</Text>
      </View>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  emoji: { fontSize: 28 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  name: { fontSize: 14, fontWeight: '800', color: '#fff' },
  xpPill: {
    backgroundColor: Colors.yellow,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  xpText: { fontSize: 12, fontWeight: '900', color: Colors.textPrimary },
});
