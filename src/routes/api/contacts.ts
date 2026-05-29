import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createContact,
  isContactSource,
  isContactStage,
  listContacts,
} from '../../server/contacts-store'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/contacts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        const url = new URL(request.url)
        const contacts = listContacts({
          stage: url.searchParams.get('stage'),
          source: url.searchParams.get('source'),
          owner: url.searchParams.get('owner'),
          search: url.searchParams.get('search'),
        })
        return jsonResponse({ contacts })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.name || typeof body.name !== 'string') {
            return jsonResponse({ error: 'name is required' }, 400)
          }
          const contact = createContact({
            name: body.name,
            email: typeof body.email === 'string' ? body.email : null,
            phone: typeof body.phone === 'string' ? body.phone : null,
            company: typeof body.company === 'string' ? body.company : null,
            stage: isContactStage(body.stage) ? body.stage : undefined,
            source: isContactSource(body.source) ? body.source : undefined,
            tags: Array.isArray(body.tags)
              ? body.tags.filter((t): t is string => typeof t === 'string')
              : [],
            notes: typeof body.notes === 'string' ? body.notes : '',
            owner: typeof body.owner === 'string' ? body.owner : null,
          })
          return jsonResponse({ contact }, 201)
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
