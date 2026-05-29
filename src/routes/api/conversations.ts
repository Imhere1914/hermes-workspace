import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createConversation,
  isConvChannel,
  listConversations,
} from '../../server/conversations-store'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/conversations')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        const url = new URL(request.url)
        const conversations = listConversations({
          status: url.searchParams.get('status'),
          channel: url.searchParams.get('channel'),
        })
        return jsonResponse({ conversations })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        try {
          const body = (await request.json()) as Record<string, unknown>
          const conversation = createConversation({
            contact_id:
              typeof body.contact_id === 'string' ? body.contact_id : null,
            contact_name:
              typeof body.contact_name === 'string' ? body.contact_name : null,
            channel: isConvChannel(body.channel) ? body.channel : undefined,
            subject: typeof body.subject === 'string' ? body.subject : null,
          })
          return jsonResponse({ conversation }, 201)
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
