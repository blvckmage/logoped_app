import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';

// Fox — bounces up and down (for child section)
export function FoxCharacter({ size = 100 }: { size?: number }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -12, duration: 800, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: -6,  duration: 400, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: bounce }], alignItems: 'center' }}>
      <View style={[styles.animalContainer, { width: size, height: size, backgroundColor: 'rgba(255,140,66,0.15)', borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.6, textAlign: 'center', lineHeight: size }}>🦊</Text>
      </View>
    </Animated.View>
  );
}

// Bear — sways left-right (for parent section)
export function BearCharacter({ size = 100 }: { size?: number }) {
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: -5, duration: 900, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 5,  duration: 900, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ rotate: sway.interpolate({ inputRange: [-5, 5], outputRange: ['-5deg', '5deg'] }) }], alignItems: 'center' }}>
      <View style={[styles.animalContainer, { width: size, height: size, backgroundColor: 'rgba(200,149,108,0.15)', borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.6, textAlign: 'center', lineHeight: size }}>🐻</Text>
      </View>
    </Animated.View>
  );
}

// Owl — bobs up (for therapist section)
export function OwlCharacter({ size = 100 }: { size?: number }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -8, duration: 1000, useNativeDriver: true }),
        Animated.timing(bob, { toValue: -4, duration: 500,  useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0,  duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: bob }], alignItems: 'center' }}>
      <View style={[styles.animalContainer, { width: size, height: size, backgroundColor: 'rgba(139,111,190,0.15)', borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.6, textAlign: 'center', lineHeight: size }}>🦉</Text>
      </View>
    </Animated.View>
  );
}

// Floating bubble decoration
export function FloatingBubble({ color, size, delay = 0 }: { color: string; size: number; delay?: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: -18, duration: 2500, useNativeDriver: true }),
          Animated.timing(float, { toValue: 0,   duration: 2500, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: 0.35,
      transform: [{ translateY: float }],
    }} />
  );
}

// Spinning star
export function StarDecor({ color = '#FFE066', size = 20 }: { color?: string; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.Text style={{ fontSize: size, transform: [{ rotate }] }}>⭐</Animated.Text>
  );
}

// Floating heart
export function HeartDecor({ color = '#FF6B6B', size = 16 }: { color?: string; size?: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 1200, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,  duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.Text style={{ fontSize: size, transform: [{ translateY: float }] }}>❤️</Animated.Text>
  );
}

const styles = StyleSheet.create({
  animalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
});
