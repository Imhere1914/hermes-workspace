import { createContext, useContext, useEffect, useState } from 'react'
import { fetchBrandConfig, getCachedBrand } from '@/lib/brand-config'
import { setTheme, isValidTheme } from '@/lib/theme'
import type { ThemeId } from '@/lib/theme'
import type { BrandConfig } from '@/routes/api/brand'

const BrandContext = createContext<BrandConfig>(getCachedBrand())

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(getCachedBrand)

  useEffect(() => {
    fetchBrandConfig().then((config) => {
      setBrand(config)

      // Apply brand title and theme default
      if (document.title === 'Hermes Workspace' || !document.title) {
        document.title = config.name
      }

      // Store brand's preferred theme as a fallback if the user has no stored preference
      const THEME_KEY = 'claude-theme'
      if (!localStorage.getItem(THEME_KEY) && config.defaultTheme) {
        if (isValidTheme(config.defaultTheme)) {
          setTheme(config.defaultTheme as ThemeId)
        } else {
          localStorage.setItem(THEME_KEY, config.defaultTheme)
          document.documentElement.setAttribute('data-theme', config.defaultTheme)
        }
      }

      // Inject brand accent color as a CSS custom property override
      if (config.accentColor) {
        document.documentElement.style.setProperty('--brand-accent', config.accentColor)
      }
    })
  }, [])

  return <BrandContext value={brand}>{children}</BrandContext>
}

export function useBrand(): BrandConfig {
  return useContext(BrandContext)
}
