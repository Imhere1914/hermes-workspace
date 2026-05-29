import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteContact,
  getContact,
  isContactSource,
  isContactStage,
  updateContact,
} from '../../server/contacts-store'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/contacts/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        const contact = getContact(params.id)
        if (!contact) return jsonResponse({ error: 'Contact not found' }, 404)
        return jsonResponse({ contact })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        try {
          const body = (await request.json()) as Record<string, unknown>
          const contact = updateContact(params.id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            email:
              body.email === null || typeof body.email === 'string'
                ? body.email
                : undefined,
            phone:
              body.phone === null || typeof body.phone === 'string'
                ? body.phone
                : undefined,
            company:
              body.company === null || typeof body.company === 'string'
                ? body.company
                : undefined,
            stage: isContactStage(body.stage) ? body.stage : undefined,
            source: isContactSource(body.source) ? body.source : undefined,
            tags: Array.isArray(body.tags)
              ? body.tags.filter((t): t is string => typeof t === 'string')
              : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
            owner:
              body.owner === null || typeof body.owner === 'string'
                ? body.owner
                : undefined,
          })
          if (!contact) return jsonResponse({ error: 'Contact not found' }, 404)
          return jsonResponse({ contact })
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        const ok = deleteContact(params.id)
        if (!ok) return jsonResponse({ error: 'Contact not found' }, 404)
        return jsonResponse({ ok: true })
      },
    },
  },
})
