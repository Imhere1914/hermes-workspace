export type ThemeId =
  | 'claude-nous'
  | 'claude-nous-light'
  | 'matrix'
  | 'matrix-light'
  | 'claude-official'
  | 'claude-official-light'
  | 'claude-classic'
  | 'claude-classic-light'
  | 'claude-slate'
  | 'claude-slate-light'
  | 'scifi'
  | 'scifi-light'
  // ── Brand themes ───────────────────────────────────────────────────
  | 'sc'
  | 'sc-deep-canopy'
  | 'sc-sage-medium'
  | 'sc-slate-moss'
  | 'hfm'
  | 'hfm-forest-grove'
  | 'hfm-desert-sand'
  | 'hfm-terracotta'

export const THEMES: Array<{
  id: ThemeId
  label: string
  description: string
  icon: string
  brand?: 'sc' | 'hfm'
}> = [
  {
    id: 'claude-nous',
    label: 'Nous',
    description: 'Deep teal background, cream accent — matches Nous Research chrome',
    icon: '◱',
  },
  {
    id: 'claude-nous-light',
    label: 'Nous Light',
    description: 'Cold paper white with restrained cobalt framing',
    icon: '◲',
  },
  {
    id: 'matrix',
    label: 'Matrix',
    description: 'Black glass terminal field with phosphor green signal glow',
    icon: '▣',
  },
  {
    id: 'matrix-light',
    label: 'Matrix Light',
    description: 'White terminal paper with green signal accents',
    icon: '▣',
  },
  {
    id: 'claude-official',
    label: 'Hermes',
    description: 'Navy and indigo flagship theme',
    icon: '⚕',
  },
  {
    id: 'claude-official-light',
    label: 'Hermes Light',
    description: 'Editorial paper white with muted cobalt accents',
    icon: '⚕',
  },
  {
    id: 'claude-classic',
    label: 'Bronze',
    description: 'Bronze accents on dark charcoal',
    icon: '🔶',
  },
  {
    id: 'claude-classic-light',
    label: 'Bronze Light',
    description: 'Warm parchment with bronze accents',
    icon: '🔶',
  },
  {
    id: 'claude-slate',
    label: 'Slate',
    description: 'Cool blue developer theme',
    icon: '🔷',
  },
  {
    id: 'claude-slate-light',
    label: 'Slate Light',
    description: 'GitHub-light palette with blue accents',
    icon: '🔷',
  },
  {
    id: 'scifi',
    label: 'SciFi',
    description: 'Cyberpunk HUD — deep navy, cyan neon, orange highlights',
    icon: '🌌',
  },
  {
    id: 'scifi-light',
    label: 'SciFi Light',
    description: 'Cold steel and teal — cyberpunk interface in daylight',
    icon: '🌌',
  },
  // ── SC brand themes (dark) ──────────────────────────────────────────
  {
    id: 'sc',
    label: 'Charcoal Forest',
    description: 'SC Intelligence — charcoal base with soft green',
    icon: '◼',
    brand: 'sc',
  },
  {
    id: 'sc-deep-canopy',
    label: 'Deep Canopy',
    description: 'SC Intelligence — deeper, richer green',
    icon: '◼',
    brand: 'sc',
  },
  {
    id: 'sc-sage-medium',
    label: 'Sage Medium',
    description: 'SC Intelligence — lighter green, medium dark base',
    icon: '◼',
    brand: 'sc',
  },
  {
    id: 'sc-slate-moss',
    label: 'Slate Moss',
    description: 'SC Intelligence — muted, balanced moss tones',
    icon: '◼',
    brand: 'sc',
  },
  // ── HFM brand themes (light) ────────────────────────────────────────
  {
    id: 'hfm',
    label: 'Warm Harvest',
    description: 'HFM Intelligence — cream base with olive and brown',
    icon: '◻',
    brand: 'hfm',
  },
  {
    id: 'hfm-forest-grove',
    label: 'Forest Grove',
    description: 'HFM Intelligence — deep olive, earthy tones',
    icon: '◻',
    brand: 'hfm',
  },
  {
    id: 'hfm-desert-sand',
    label: 'Desert Sand',
    description: 'HFM Intelligence — sandy, warm neutral',
    icon: '◻',
    brand: 'hfm',
  },
  {
    id: 'hfm-terracotta',
    label: 'Terracotta',
    description: 'HFM Intelligence — fired clay and russet accent',
    icon: '◻',
    brand: 'hfm',
  },
]

const STORAGE_KEY = 'claude-theme'
const DEFAULT_THEME: ThemeId = 'claude-nous'
const THEME_SET = new Set<ThemeId>(THEMES.map((theme) => theme.id))

// Brand themes intentionally absent from light/dark toggle maps —
// they return themselves when getThemeVariant is called.
const LIGHT_THEME_MAP: Partial<Record<ThemeId, ThemeId>> = {
  'claude-nous': 'claude-nous-light',
  matrix: 'matrix-light',
  'claude-official': 'claude-official-light',
  'claude-classic': 'claude-classic-light',
  'claude-slate': 'claude-slate-light',
  scifi: 'scifi-light',
}
const DARK_THEME_MAP: Partial<Record<ThemeId, ThemeId>> = {
  'claude-nous-light': 'claude-nous',
  'matrix-light': 'matrix',
  'claude-official-light': 'claude-official',
  'claude-classic-light': 'claude-classic',
  'claude-slate-light': 'claude-slate',
  'scifi-light': 'scifi',
}

const LIGHT_THEMES = new Set<ThemeId>([
  'claude-nous-light',
  'matrix-light',
  'claude-official-light',
  'claude-classic-light',
  'claude-slate-light',
  'scifi-light',
  // HFM themes are light
  'hfm',
  'hfm-forest-grove',
  'hfm-desert-sand',
  'hfm-terracotta',
])

/** Set of brand theme IDs — used to gate brand-specific UI */
export const BRAND_THEME_IDS = new Set<ThemeId>([
  'sc', 'sc-deep-canopy', 'sc-sage-medium', 'sc-slate-moss',
  'hfm', 'hfm-forest-grove', 'hfm-desert-sand', 'hfm-terracotta',
])

export function isValidTheme(
  value: string | null | undefined,
): value is ThemeId {
  return typeof value === 'string' && THEME_SET.has(value as ThemeId)
}

export function isDarkTheme(theme: ThemeId): boolean {
  return !LIGHT_THEMES.has(theme)
}

export function getThemeVariant(
  theme: ThemeId,
  mode: 'light' | 'dark',
): ThemeId {
  // Brand themes don't have light/dark counterparts — return as-is
  if (BRAND_THEME_IDS.has(theme)) return theme

  if (mode === 'light') {
    return isDarkTheme(theme)
      ? (LIGHT_THEME_MAP[theme] ?? theme)
      : theme
  }

  return isDarkTheme(theme)
    ? theme
    : (DARK_THEME_MAP[theme] ?? theme)
}

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(STORAGE_KEY)
  return isValidTheme(stored) ? stored : DEFAULT_THEME
}

export function setTheme(theme: ThemeId): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.remove('light', 'dark', 'system')
  const nextMode = isDarkTheme(theme) ? 'dark' : 'light'
  root.classList.add(nextMode)
  root.style.setProperty('color-scheme', nextMode)
  localStorage.setItem(STORAGE_KEY, theme)
}
