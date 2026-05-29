import { createFileRoute } from '@tanstack/react-router'
import { upsertWebContact } from '../../server/contacts-store'
import {
  addMessage,
  createConversation,
  findOpenConversationByContact,
} from '../../server/conversations-store'
import { getClientIp, rateLimit } from '../../server/rate-limit'

/**
 * Twilio SMS inbound webhook (Phase 4b).
 *
 * Twilio POST-encodes inbound SMS to this endpoint. Every message upserts
 * a contact by phone number and threads into the workspace Conversations inbox.
 *
 * Setup:
 *   1. Buy a Twilio number, set Webhook URL → POST https://<your-domain>/api/channels/sms
 *   2. Set TWILIO_AUTH_TOKEN in workspace .env for signature verification.
 *   3. Optionally set TWILIO_ACCOUNT_SID for logging.
 *
 * Security:
 *   - Twilio signature verification via X-Twilio-Signature + TWILIO_AUTH_TOKEN.
 *     Without TWILIO_AUTH_TOKEN set, the endpoint accepts all requests
 *     (development only — set the token in production).
 *   - Per-IP rate limit (30/min) as a backstop.
 */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function twimlOk() {
  // Twilio expects a TwiML response; empty response = no reply SMS.
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

async function verifyTwilioSignature(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!authToken) return true // dev mode: skip verification

  const signature = request.headers.get('x-twilio-signature') ?? ''
  const url = request.url

  // Twilio HMAC-SHA1 signature: HMAC(authToken, url + sorted-params-values)
  const { createHmac } = await import('node:crypto')
  const params = new URLSearchParams(rawBody)
  const sortedParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join('')
  const expected = createHmac('sha1', authToken)
    .update(url + sortedParams)
    .digest('base64')
  return expected === signature
}

const MAX_BODY = 1600 // SMS max is 1600 chars (multi-segment)
const RATE_MAX = 30
const RATE_WINDOW_MS = 60_000

export const Route = createFileRoute('/api/channels/sms')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request)
        if (!rateLimit(`sms:${ip}`, RATE_MAX, RATE_WINDOW_MS)) {
          return json({ error: 'Too many requests' }, 429)
        }

        let rawBody: string
        try {
          rawBody = await request.text()
        } catch {
          return json({ error: 'Failed to read body' }, 400)
        }

        const valid = await verifyTwilioSignature(request, rawBody)
        if (!valid) {
          return json({ error: 'Invalid Twilio signature' }, 401)
        }

        const params = new URLSearchParams(rawBody)
        const from = params.get('From')?.trim() ?? ''
        const body = params.get('Body')?.trim().slice(0, MAX_BODY) ?? ''
        const name = params.get('ProfileName')?.trim() ?? from // WhatsApp sends name here too

        if (!from || !body) {
          return twimlOk() // malformed but ack so Twilio doesn't retry
        }

        const contact = upsertWebContact({ name: name || from, phone: from })
        const conv =
          findOpenConversationByContact(contact.id, 'sms') ??
          createConversation({
            contact_id: contact.id,
            contact_name: contact.name,
            channel: 'sms',
            subject: `SMS from ${from}`,
          })

        addMessage(conv.id, {
          role: 'contact',
          body,
          author: contact.name,
        })

        return twimlOk()
      },
    },
  },
})
