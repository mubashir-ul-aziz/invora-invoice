/**
 * Metriqo's design tokens — "Kinetic Ledger": professional, minimal, financial-
 * app UI with generous but controlled spacing, subtle borders, and restrained
 * cards. This is the ONE token file every screen imports (`@/theme/colors`);
 * every existing key below keeps its original name and meaning so no existing
 * screen needs to change to pick up the new palette — only the values (and a
 * handful of new, additive keys) changed.
 */
export const colors = {
  background: '#F5F6FA',
  surface: '#FFFFFF',
  /** A faint, slightly raised surface for a card nested inside another card (e.g. a stat tile inside a summary card). */
  surfaceAlt: '#F8FAFC',

  primary: '#2563EB',
  /** Pressed/active state of `primary` — used for pressed buttons and active tab/segment fills. */
  primaryDark: '#1D4ED8',
  primaryText: '#FFFFFF',
  /** A light tint of `primary` for badges/pills/icon chips on a primary-adjacent surface (e.g. "MOST POPULAR", the current-plan pill). */
  primarySurface: '#EFF4FF',

  text: '#171923',
  textMuted: '#5B6270',
  /** Faintest text — captions, fine print, disabled labels. */
  textFaint: '#94A0B8',

  border: '#E2E5EC',
  /** A slightly stronger border for an emphasized/selected card outline. */
  borderStrong: '#C7CEDC',
  placeholder: '#C8CCD6',

  danger: '#C0362C',
  dangerBg: '#FBE4E2',
  success: '#1E7B41',
  successBg: '#E3F3E8',
  warning: '#8A6D1D',
  warningBg: '#FFF3D6',

  /** The muted slate used for locked/restricted content — deliberately calmer than `danger` (a plan limitation is not an error). */
  locked: '#5B6270',
  lockedBg: '#EEF0F5',
} as const;

/** 4px-based spacing scale. Existing screens mostly use literal numbers in their own `StyleSheet.create` — this is for new/refined code, not a required migration. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner-radius scale, matching the radii already in common use across the app's cards/buttons/pills. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Type scale. `weight` is a valid React Native `fontWeight`. */
export const typography = {
  h1: { fontSize: 24, lineHeight: 30, weight: '800' as const },
  h2: { fontSize: 18, lineHeight: 24, weight: '700' as const },
  h3: { fontSize: 15, lineHeight: 20, weight: '700' as const },
  body: { fontSize: 14, lineHeight: 20, weight: '400' as const },
  bodyBold: { fontSize: 14, lineHeight: 20, weight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, weight: '500' as const },
  label: { fontSize: 11, lineHeight: 14, weight: '700' as const },
} as const;
