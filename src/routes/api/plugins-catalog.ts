import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { PLUGINS } from '../../lib/plugins-catalog'
import {
  envConfigured,
  getEnabledMap,
  setPluginEnabled,
} from '../../server/plugins-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * GET — returns the catalog merged with per-brand enabled state + whether each
 * plugin's required env vars are configured server-side.
 * POST — toggle a plugin enabled/disabled for a brand.
 */
export const Route = createFileRoute('/api/plugins-catalog')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const brand = url.searchParams.get('brand') || 'default'
        const enabled = getEnabledMap(brand)
        const plugins = PLUGINS.map((p) => ({
          ...p,
          enabled: enabled[p.id] === true,
          configured: envConfigured(p.env_vars),
        }))
        return json({ plugins })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (typeof body.plugin_id !== 'string') {
            return json({ error: 'plugin_id is required' }, 400)
          }
          if (typeof body.enabled !== 'boolean') {
            return json({ error: 'enabled (boolean) is required' }, 400)
          }
          const brand = typeof body.brand === 'string' ? body.brand : 'default'
          if (!PLUGINS.some((p) => p.id === body.plugin_id)) {
            return json({ error: 'Unknown plugin' }, 404)
          }
          setPluginEnabled(body.plugin_id, brand, body.enabled)
          return json({ ok: true })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
