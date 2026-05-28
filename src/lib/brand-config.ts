import type { BrandConfig } from '@/routes/api/brand'

const DEFAULT_BRAND: BrandConfig = {
  id: 'hermes',
  name: 'Hermes Workspace',
  shortName: 'HW',
  description: 'Hermes Agent workspace',
  logoPath: '/logo.svg',
  defaultTheme: 'claude-nous',
  accentColor: '#4A9EA1',
}

let cached: BrandConfig | null = null
let fetchPromise: Promise<BrandConfig> | null = null

export async function fetchBrandConfig(): Promise<BrandConfig> {
  if (cached) return cached
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/brand', { cache: 'no-store' })
      if (!res.ok) return DEFAULT_BRAND
      const data = (await res.json()) as BrandConfig
      cached = data
      return data
    } catch {
      return DEFAULT_BRAND
    }
  })()

  return fetchPromise
}

export function getCachedBrand(): BrandConfig {
  return cached ?? DEFAULT_BRAND
}

export function clearBrandCache() {
  cached = null
  fetchPromise = null
}
