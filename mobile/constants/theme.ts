import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const Colors = {
  bg:           '#FFF8F2',
  surface:      '#FFFFFF',
  surfaceAlt:   '#FFF5EE',
  coral:        '#FF6B6B',
  coralDark:    '#E85555',
  coralLight:   '#FFD5D5',
  sky:          '#4FC3F7',
  skyDark:      '#29B6F6',
  skyLight:     '#E1F5FE',
  mint:         '#A8E6CF',
  mintLight:    '#E8F8F0',
  yellow:       '#FFE066',
  yellowDark:   '#F9C922',
  purple:       '#9C6FD6',
  purpleLight:  '#F2ECFC',
  orange:       '#FFB347',
  orangeLight:  '#FFF0D9',
  green:        '#56C596',
  textPrimary:  '#2D2D2D',
  textSecondary:'#6B7280',
  textMuted:    '#9CA3AF',
  border:       'rgba(0,0,0,0.07)',
  shadow:       'rgba(0,0,0,0.08)',

  // Legacy aliases used in older screens
  teal:    '#4FC3F7',
  red:     '#FF6B6B',
  mild:    '#FFE066',
  moderate:'#FFB347',
  severe:  '#FF6B6B',
  child:   '#FF6B6B',
  parent:  '#4FC3F7',
  therapist:'#9C6FD6',
  admin:   '#FF6B6B',

  light: { text: '#11181C', background: '#fff', tint: '#0a7ea4', icon: '#687076', tabIconDefault: '#687076', tabIconSelected: '#0a7ea4' },
  dark:  { text: '#ECEDEE', background: '#FFF8F2', tint: '#FF6B6B', icon: '#9BA1A6', tabIconDefault: '#9BA1A6', tabIconSelected: '#FF6B6B' },
};

export const Spacing = {
  xs:  4,  sm:  8,  md: 16,
  lg: 24,  xl: 32, xxl: 48,
};

export const Radius = {
  sm: 14, md: 18, lg: 24, xl: 32, full: 999,
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: Colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  body: { fontSize: 15, color: Colors.textSecondary },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
  },
  caption: { fontSize: 12, color: Colors.textMuted },
};

export const Screen = { W: SCREEN_W, H: SCREEN_H };

export const Fonts = Platform.select({
  ios:     { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    rounded: "'SF Pro Rounded',sans-serif",
    mono: "SFMono-Regular,Menlo,monospace",
  },
});
