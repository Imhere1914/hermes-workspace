/**
 * GET /api/supervisor-health
 *
 * Server-side proxy to the supervisor container. The supervisor is an
 * internal Docker service not published to the browser, so the workspace
 * server fetches on its behalf and returns the result.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'

const SUPERVISOR_URL = process.env.SUPERVISOR_URL || 'http://supervisor:3099'
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || ''

export const Route = createFileRoute('/api/supervisor-health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const headers: Record<string, string> = { Accept: 'application/json' }
          if (SUPERVISOR_TOKEN) headers['Authorization'] = `Bearer ${SUPERVISOR_TOKEN}`

          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 3000)
          const res = await fetch(`${SUPERVISOR_URL}/supervisor/health`, {
            signal: ctrl.signal,
            headers,
          })
          clearTimeout(timer)

          if (!res.ok) {
            return json({ agent: 'unknown', ui: 'up', error: `supervisor ${res.status}` })
          }
          const data = await res.json()
          return json(data)
        } catch {
          return json({ agent: 'unknown', ui: 'up', error: 'supervisor unreachable' })
        }
      },
    },
  },
})
