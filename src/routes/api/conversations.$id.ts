import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  addMessage,
  approveDraft,
  getConversation,
  isConvStatus,
  isMessageRole,
  updateConversation,
} from '../../server/conversations-store'
import { getContact } from '../../server/contacts-store'
import { sendReply } from '../../server/channel-adapters'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/conversations/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        const conversation = getConversation(params.id)
        if (!conversation)
          return jsonResponse({ error: 'Conversation not found' }, 404)
        return jsonResponse({ conversation })
      },

      // Add a message, or approve a draft via ?action=approve-draft
      POST: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        const url = new URL(request.url)
        const action = url.searchParams.get('action')

        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          if (action === 'approve-draft') {
            if (typeof body.message_id !== 'string') {
              return jsonResponse({ error: 'message_id is required' }, 400)
            }
            const preConv = getConversation(params.id)
            if (!preConv) return jsonResponse({ error: 'Not found' }, 404)

            const draftMsg = preConv.messages.find(
              (m) => m.id === body.message_id && m.draft,
            )
            if (!draftMsg)
              return jsonResponse({ error: 'Draft message not found' }, 404)

            // Flip draft → sent in DB
            const conv = approveDraft(params.id, body.message_id)
            if (!conv) return jsonResponse({ error: 'Not found' }, 404)

            // Send the reply outbound through the originating channel
            if (preConv.contact_id) {
              const contact = getContact(preConv.contact_id)
              const handle = contact?.phone ?? contact?.email ?? ''
              if (handle) {
                // Fire-and-forget: if outbound fails, the message is already
                // stored in our DB; staff can action manually. We surface the
                // error as a header so the client can show a warning.
                const sendResult = await sendReply(
                  preConv.channel,
                  handle,
                  draftMsg.body,
                )
                if (!sendResult.ok) {
                  // Return the conversation but signal the send issue
                  return new Response(JSON.stringify({ conversation: conv, send_warning: sendResult.error }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  })
                }
              }
            }

            return jsonResponse({ conversation: conv })
          }

          if (typeof body.body !== 'string' || !body.body.trim()) {
            return jsonResponse({ error: 'body is required' }, 400)
          }
          const conv = addMessage(params.id, {
            role: isMessageRole(body.role) ? body.role : 'human',
            body: body.body,
            author: typeof body.author === 'string' ? body.author : null,
            draft: body.draft === true,
          })
          if (!conv)
            return jsonResponse({ error: 'Conversation not found' }, 404)
          return jsonResponse({ conversation: conv }, 201)
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        try {
          const body = (await request.json()) as Record<string, unknown>
          const conv = updateConversation(params.id, {
            status: isConvStatus(body.status) ? body.status : undefined,
            assignee:
              body.assignee === null || typeof body.assignee === 'string'
                ? body.assignee
                : undefined,
            unread: typeof body.unread === 'boolean' ? body.unread : undefined,
            subject:
              body.subject === null || typeof body.subject === 'string'
                ? body.subject
                : undefined,
          })
          if (!conv)
            return jsonResponse({ error: 'Conversation not found' }, 404)
          return jsonResponse({ conversation: conv })
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
