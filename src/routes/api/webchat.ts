import { createFileRoute } from '@tanstack/react-router'
import { upsertContactByHandle } from '../../server/contacts-store'
import {
  addMessage,
  createConversation,
  findOpenConversationByContact,
  getConversation,
} from '../../server/conversations-store'
import type { ConvMessage } from '../../server/conversations-store'

/**
 * PUBLIC web-chat ingest endpoint.
 *
 * Called by the embeddable widget on external landing pages, so it is NOT
 * behind workspace auth. Optional shared-secret gate via WEBCHAT_WIDGET_KEY.
 * Every inbound message upserts a contact and threads into a single open
 * web-chat conversation, surfacing in the workspace Conversations inbox.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

/** Visitor-safe view: hide internal drafts and system messages. */
function publicMessages(messages: ConvMessage[]) {
  return messages
    .filter((m) => !m.draft && m.role !== 'system')
    .map((m) => ({
      role: m.role === 'contact' ? 'visitor' : 'agent',
      body: m.body,
      created_at: m.created_at,
    }))
}

export const Route = createFileRoute('/api/webchat')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const requiredKey = process.env.WEBCHAT_WIDGET_KEY?.trim()
        try {
          const body = (await request.json()) as Record<string, unknown>

          if (requiredKey) {
            const provided =
              typeof body.key === 'string' ? body.key : undefined
            if (provided !== requiredKey) {
              return json({ error: 'Invalid widget key' }, 401)
            }
          }

          const message =
            typeof body.message === 'string' ? body.message.trim() : ''
          if (!message) return json({ error: 'message is required' }, 400)

          const name =
            typeof body.name === 'string' && body.name.trim()
              ? body.name.trim()
              : 'Web visitor'
          const email =
            typeof body.email === 'string' && body.email.trim()
              ? body.email.trim()
              : null

          // 1. Resume an existing conversation if the widget passed its id.
          let conversationId =
            typeof body.conversation_id === 'string'
              ? body.conversation_id
              : null
          let conv = conversationId ? getConversation(conversationId) : null

          // 2. Otherwise tie to a contact and find/create their open thread.
          if (!conv) {
            const contact = upsertContactByHandle({
              name,
              email,
              source: 'webchat',
            })
            conv =
              findOpenConversationByContact(contact.id, 'webchat') ??
              createConversation({
                contact_id: contact.id,
                contact_name: contact.name,
                channel: 'webchat',
                subject: 'Web chat',
              })
            conversationId = conv.id
          }

          const updated = addMessage(conv.id, {
            role: 'contact',
            body: message,
            author: name,
          })
          if (!updated) return json({ error: 'Failed to record message' }, 500)

          return json(
            {
              conversation_id: updated.id,
              messages: publicMessages(updated.messages),
            },
            201,
          )
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
