import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
