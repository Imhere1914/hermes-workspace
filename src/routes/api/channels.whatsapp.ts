import { createFileRoute } from '@tanstack/react-router'
import { upsertWebContact } from '../../server/contacts-store'
import {
  addMessage,
  createConversation,
  findOpenConversationByContact,
} from '../../server/conversations-store'
import { getClientIp, rateLimit } from '../../server/rate-limit'

/**
 * Meta WhatsApp Business API inbound webhook (Phase 4b).
 *
 * Meta sends a GET for webhook verification and POSTs message events.
 *
 * Setup:
 *   1. Meta Developer Console → WhatsApp → Configuration → Webhook URL:
 *      https://<your-domain>/api/channels/whatsapp
 *   2. Set WHATSAPP_VERIFY_TOKEN (any secret) and WHATSAPP_ACCESS_TOKEN in .env.
 *   3. Subscribe to `messages` webhook field.
 *
 * For Instagram DMs and Facebook Messenger, subscribe the same page/IG account
 * to this webhook or create separate /api/channels/instagram and /api/channels/messenger
 * routes with identical logic.
 */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type WAMessage = {
  from?: string
  id?: string
  text?: { body?: string }
  type?: string
}

type WAContact = { profile?: { name?: string }; wa_id?: string }

type WAPayload = {
  object?: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WAMessage[]
        contacts?: WAContact[]
        metadata?: { phone_number_id?: string }
      }
    }>
  }>
}

const RATE_MAX = 60
const RATE_WINDOW_MS = 60_000

export const Route = createFileRoute('/api/channels/whatsapp')({
  server: {
    handlers: {
      // Meta webhook verification handshake
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim()

        if (!verifyToken) {
          // No verify token configured — refuse (unsafe to accept without it)
          return new Response('WHATSAPP_VERIFY_TOKEN not configured', { status: 403 })
        }

        if (mode === 'subscribe' && token === verifyToken) {
          return new Response(challenge ?? '', { status: 200 })
        }
        return new Response('Forbidden', { status: 403 })
      },

      POST: async ({ request }) => {
        const ip = getClientIp(request)
        if (!rateLimit(`whatsapp:${ip}`, RATE_MAX, RATE_WINDOW_MS)) {
          return json({ error: 'Too many requests' }, 429)
        }

        let payload: WAPayload
        try {
          payload = (await request.json()) as WAPayload
        } catch {
          return json({ error: 'Invalid JSON' }, 400)
        }

        // Process all messages from all entries
        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const value = change.value
            if (!value?.messages?.length) continue

            // Build a name lookup from the contacts array Meta includes
            const nameById: Record<string, string> = {}
            for (const c of value.contacts ?? []) {
              if (c.wa_id && c.profile?.name) {
                nameById[c.wa_id] = c.profile.name
              }
            }

            for (const msg of value.messages) {
              if (msg.type !== 'text' || !msg.from || !msg.text?.body) continue

              const phone = msg.from
              const name = nameById[phone] || phone
              const body = msg.text.body.slice(0, 4096)

              const contact = upsertWebContact({ name, phone: `+${phone}` })
              const conv =
                findOpenConversationByContact(contact.id, 'whatsapp') ??
                createConversation({
                  contact_id: contact.id,
                  contact_name: contact.name,
                  channel: 'whatsapp',
                  subject: `WhatsApp from ${name}`,
                })

              addMessage(conv.id, {
                role: 'contact',
                body,
                author: contact.name,
              })
            }
          }
        }

        // Meta requires HTTP 200 within 20s or it retries
        return json({ ok: true })
      },
    },
  },
})
