import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createCampaign,
  listCampaigns,
} from '../../server/campaigns-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/campaigns')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const campaigns = listCampaigns({
          status: url.searchParams.get('status'),
          brand: url.searchParams.get('brand'),
        })
        return json({ campaigns })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.name || typeof body.name !== 'string') {
            return json({ error: 'name is required' }, 400)
          }
          if (!body.subject || typeof body.subject !== 'string') {
            return json({ error: 'subject is required' }, 400)
          }
          const audienceRaw = (body.audience ?? {}) as Record<string, unknown>
          const campaign = createCampaign({
            name: body.name,
            subject: body.subject,
            body: typeof body.body === 'string' ? body.body : '',
            brand: typeof body.brand === 'string' ? body.brand : undefined,
            scheduled_at:
              typeof body.scheduled_at === 'string' ? body.scheduled_at : null,
            audience: {
              stages: Array.isArray(audienceRaw.stages)
                ? (audienceRaw.stages as unknown[]).filter(
                    (s): s is string => typeof s === 'string',
                  )
                : [],
              tags: Array.isArray(audienceRaw.tags)
                ? (audienceRaw.tags as unknown[]).filter(
                    (t): t is string => typeof t === 'string',
                  )
                : [],
              include_unverified: audienceRaw.include_unverified === true,
            },
          })
          return json({ campaign }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
