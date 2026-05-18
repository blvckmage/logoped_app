import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { FoxCharacter, BearCharacter, OwlCharacter, StarDecor, FloatingBubble } from '@/components/AnimalCharacters';

const ROLE_CARDS = [
  {
    id: 'child',
    title: 'Ребёнок',
    description: 'Тренируй произношение с ИИ-анализом',
    features: ['🎤 Запись голоса', '🤖 ИИ-диагностика', '⭐ Получай звёзды'],
    color: Colors.coral,
    bgColor: 'rgba(255,107,107,0.08)',
    borderColor: 'rgba(255,107,107,0.2)',
    route: '/child',
    Animal: FoxCharacter,
  },
  {
    id: 'parent',
    title: 'Родитель',
    description: 'Следи за прогрессом ребёнка',
    features: ['📊 Статистика', '📈 Прогресс', '🎯 Планы занятий'],
    color: Colors.sky,
    bgColor: 'rgba(79,195,247,0.08)',
    borderColor: 'rgba(79,195,247,0.2)',
    route: '/parent',
    Animal: BearCharacter,
  },
  {
    id: 'therapist',
    title: 'Логопед',
    description: 'Управляй пациентами и планами',
    features: ['👥 Пациенты', '📋 Планы лечения', '📊 Аналитика'],
    color: Colors.purple,
    bgColor: 'rgba(156,111,214,0.08)',
    borderColor: 'rgba(156,111,214,0.2)',
    route: '/therapist',
    Animal: OwlCharacter,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;
    const routes: Record<string, string> = {
      child: '/child', parent: '/parent',
      therapist: '/therapist', admin: '/admin', superadmin: '/admin',
    };
    if (routes[user.role]) router.replace(routes[user.role] as any);
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <FoxCharacter size={80} />
        <Text style={styles.loadingText}>Загружаем...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Floating decorations */}
        <View style={styles.decorRow}>
          <FloatingBubble color={Colors.yellow} size={60} delay={0} />
          <FloatingBubble color={Colors.skyLight} size={40} delay={800} />
          <FloatingBubble color={Colors.mintLight} size={50} delay={1600} />
        </View>

        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim }]}>
          <View style={styles.logoRow}>
            <StarDecor size={28} color={Colors.coral} />
            <Text style={styles.logoText}>Сөйле ИИ</Text>
            <StarDecor size={28} color={Colors.yellow} />
          </View>
          <Text style={styles.subtitle}>Логопедическая платформа с ИИ-анализом речи для детей</Text>

          <View style={styles.statRow}>
            <View style={styles.statChip}><Text style={styles.statText}>🤖 ИИ-анализ</Text></View>
            <View style={styles.statChip}><Text style={styles.statText}>🎯 Казахский</Text></View>
            <View style={styles.statChip}><Text style={styles.statText}>❤️ Для детей</Text></View>
          </View>
        </Animated.View>

        {/* Section label */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>КЕМ ТЫ ЯВЛЯЕШЬСЯ?</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          {ROLE_CARDS.map((card, i) => (
            <Animated.View
              key={card.id}
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30 + i * 15, 0] }) }],
              }}
            >
              <TouchableOpacity
                style={[styles.card, { backgroundColor: card.bgColor, borderColor: card.borderColor }]}
                onPress={() => router.push(card.route as any)}
                activeOpacity={0.85}
              >
                {/* Animal mascot */}
                <View style={styles.cardAnimal}>
                  <card.Animal size={72} />
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: card.color }]}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.description}</Text>
                  <View style={styles.cardFeatures}>
                    {card.features.map(f => (
                      <Text key={f} style={styles.featureText}>{f}</Text>
                    ))}
                  </View>
                </View>

                <View style={[styles.cardBtn, { backgroundColor: card.color }]}>
                  <Text style={styles.cardBtnText}>→</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Admin link */}
        <TouchableOpacity style={styles.adminLink} onPress={() => router.push('/admin' as any)}>
          <Text style={styles.adminText}>🛡️ Войти как администратор</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  loading:      { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText:  { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  decorRow:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: Spacing.md, paddingHorizontal: Spacing.xl, opacity: 0.7 },
  hero:         { alignItems: 'center', paddingVertical: Spacing.lg },
  logoRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  logoText:     { fontSize: 34, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  subtitle:     { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.md, paddingHorizontal: Spacing.md },
  statRow:      { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  statChip:     { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  statText:     { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  sectionLabel: { ...Typography.label, flexShrink: 0 },
  sectionLine:  { flex: 1, height: 1, backgroundColor: Colors.border },
  cards:        { gap: Spacing.md },
  card:         { borderRadius: Radius.xl, borderWidth: 2, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3, backgroundColor: Colors.surface },
  cardAnimal:   { alignItems: 'center', justifyContent: 'center', width: 80 },
  cardBody:     { flex: 1 },
  cardTitle:    { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  cardDesc:     { fontSize: 12, color: Colors.textSecondary, marginBottom: Spacing.xs, lineHeight: 18 },
  cardFeatures: { gap: 2 },
  featureText:  { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  cardBtn:      { width: 36, height: 36, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  cardBtnText:  { color: '#fff', fontSize: 18, fontWeight: '700' },
  adminLink:    { alignItems: 'center', marginTop: Spacing.xl, paddingVertical: Spacing.md },
  adminText:    { fontSize: 13, color: Colors.textMuted },
});
