/**
 * GET /api/brand
 *
 * Returns the active brand configuration. Values come from BRAND_* env vars
 * set in the Compose stack, with sane Hermes defaults so the app still works
 * when no brand is configured.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'

export type BrandConfig = {
  id: string
  name: string
  shortName: string
  description: string
  logoPath: string
  defaultTheme: string
  accentColor: string
}

function getBrandConfig(): BrandConfig {
  const id = process.env.BRAND || 'hermes'
  return {
    id,
    name: process.env.BRAND_NAME || 'Hermes Workspace',
    shortName: process.env.BRAND_SHORT_NAME || 'HW',
    description: process.env.BRAND_DESCRIPTION || 'Hermes Agent workspace',
    logoPath: process.env.BRAND_LOGO_PATH || `/brands/${id}/logo.svg`,
    defaultTheme: process.env.BRAND_THEME || 'claude-nous',
    accentColor: process.env.BRAND_ACCENT_COLOR || '#4A9EA1',
  }
}

export const Route = createFileRoute('/api/brand')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        return json(getBrandConfig())
      },
    },
  },
})
