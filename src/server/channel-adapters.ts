/**
 * Channel outbound adapters (Phase 4b).
 *
 * When a human approves an agent draft in the Conversations inbox, this
 * module sends the reply back through the originating channel.
 *
 * Current state:
 *   - webchat: no outbound needed (widget polls/receives the approved message)
 *   - sms: Twilio Messages API
 *   - whatsapp: Meta WhatsApp Cloud API
 *   - email: placeholder — wire to ESP in Phase 4d
 *
 * All functions are called from /api/conversations/$id PATCH when
 * a draft is approved, passing the conversation and message body.
 */

import type { ConvChannel } from './conversations-store'

export type SendResult =
  | { ok: true; message_sid?: string }
  | { ok: false; error: string }

// ── Twilio SMS ────────────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: 'Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    })
    const data = (await res.json()) as { sid?: string; message?: string }
    if (!res.ok) {
      return { ok: false, error: data.message ?? `Twilio error ${res.status}` }
    }
    return { ok: true, message_sid: data.sid }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Meta WhatsApp Cloud API ───────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()

  if (!token || !phoneNumberId) {
    return { ok: false, error: 'Meta credentials not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)' }
  }

  // Strip leading + from WhatsApp recipient numbers
  const to_e164 = to.replace(/^\+/, '')

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to_e164,
          type: 'text',
          text: { body },
        }),
      },
    )
    const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } }
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message ?? `Meta error ${res.status}` }
    }
    return { ok: true, message_sid: data.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Send a reply back through the channel a conversation arrived on.
 *
 * Called by the approve-draft endpoint after flipping draft=false.
 * `recipientHandle` is the contact's phone number (SMS/WA) or email.
 *
 * Returns { ok: true } for web chat (no outbound needed — widget reads
 * from the conversation API) and for unsupported channels (non-fatal: the
 * message is still stored in our DB for staff to action manually).
 */
export async function sendReply(
  channel: ConvChannel,
  recipientHandle: string,
  body: string,
): Promise<SendResult> {
  switch (channel) {
    case 'webchat':
    case 'manual':
      // web chat: the widget polls /api/webchat and receives stored messages.
      // manual: staff handles externally.
      return { ok: true }

    case 'sms':
      return sendSms(recipientHandle, body)

    case 'whatsapp':
      return sendWhatsApp(recipientHandle, body)

    case 'email':
      // Phase 4d: wire to ESP (Resend/SES/Postmark)
      return { ok: false, error: 'Email outbound not yet configured — draft saved, send manually' }

    case 'social':
      return { ok: false, error: 'Social DM outbound not yet configured — draft saved, send manually' }

    default:
      return { ok: false, error: `Unknown channel: ${channel as string}` }
  }
}
