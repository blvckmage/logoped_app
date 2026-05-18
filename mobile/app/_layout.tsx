import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" />
          <Stack.Screen name="child" />
          <Stack.Screen name="parent" />
          <Stack.Screen name="therapist" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="patient/[id]" />
          <Stack.Screen name="plan/[childId]" />
        </Stack>
        <StatusBar style="light" />
      </View>
    </AuthProvider>
  );
}
