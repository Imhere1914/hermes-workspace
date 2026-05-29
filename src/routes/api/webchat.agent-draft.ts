import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { addMessage, getConversation } from '../../server/conversations-store'
import {
  createSession,
  deleteSession,
  sendChat,
} from '../../server/claude-api'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Generate a live agent draft reply for a conversation.
 *
 * - Creates a short-lived hermes session with a brand-aware system prompt
 *   that injects the SOUL.md guardrails (draft-don't-send, never-diagnose).
 * - Sends the full conversation history so the agent has full context.
 * - Deletes the ephemeral session after getting the reply.
 * - Saves the result with `draft: true` — NEVER auto-sent; requires human
 *   "Approve & send" in the inbox (the guardrail).
 */

function brandSystemPrompt(): string {
  const brand = (process.env.BRAND ?? '').toLowerCase()

  const sharedRules = `
You are drafting a reply to a web chat message. Your reply will be saved as a DRAFT and reviewed by a human before sending.

IMPORTANT RULES:
- Write ONLY the reply text — no preamble, no "Here's a draft:", no meta-commentary.
- Be warm, concise, and professional.
- Do NOT make specific commitments or promises on behalf of the business.
- NEVER claim to be a human — you are an AI assistant.
- Keep the reply to 2-4 short paragraphs maximum.
`.trim()

  if (brand === 'hfm') {
    return `${sharedRules}

Brand: Holistic Functional Care — functional medicine practice for women in Texas and Louisiana.
Tone: Empathetic, supportive, warm. Luxury-wellness feel. Patient-centered.
NEVER diagnose conditions, give medical advice, or make clinical recommendations.
Route all clinical questions to the clinical team.
Protect patient privacy — health information is sensitive.`
  }

  if (brand === 'sc') {
    return `${sharedRules}

Brand: Simple Connect — B2B contractor operations and automation platform.
Tone: Direct, professional, helpful. B2B — value-forward, not salesy.
Do not fabricate data about leads, jobs, or pipeline status.
Confirm before making any booking or commitment.`
  }

  return sharedRules
}

function buildAgentPrompt(
  contactName: string | null,
  channel: string,
  history: Array<{ role: string; body: string }>,
): string {
  const name = contactName || 'a web visitor'
  const channelLabel =
    channel === 'webchat'
      ? 'web chat'
      : channel === 'sms'
        ? 'SMS'
        : channel === 'whatsapp'
          ? 'WhatsApp'
          : channel

  const historyText = history
    .slice(-10) // last 10 messages for context
    .map((m) => `${m.role === 'contact' ? name : 'Agent'}: ${m.body}`)
    .join('\n')

  return `You are drafting a reply to a ${channelLabel} conversation with ${name}.

Conversation history:
${historyText}

Write a helpful, brand-appropriate reply to the latest message from ${name}. Reply only with the message text.`
}

export const Route = createFileRoute('/api/webchat/agent-draft')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (typeof body.conversation_id !== 'string') {
            return jsonResponse({ error: 'conversation_id is required' }, 400)
          }
          const conv = getConversation(body.conversation_id)
          if (!conv)
            return jsonResponse({ error: 'Conversation not found' }, 404)

          const visibleMessages = conv.messages.filter(
            (m) => !m.draft && m.role !== 'system',
          )
          if (visibleMessages.length === 0) {
            return jsonResponse(
              { error: 'No messages to reply to' },
              400,
            )
          }

          const agentPrompt = buildAgentPrompt(
            conv.contact_name,
            conv.channel,
            visibleMessages.map((m) => ({ role: m.role, body: m.body })),
          )
          const systemPrompt = brandSystemPrompt()

          // Create an ephemeral agent session and ask for a draft reply.
          let draftBody: string
          let sessionId: string | null = null
          try {
            const session = await createSession({
              title: `webchat-draft-${conv.id.slice(0, 8)}`,
            })
            sessionId = session.id

            const result = await sendChat(sessionId, {
              message: agentPrompt,
              model: undefined, // use the profile's configured default
            })

            // sendChat returns { response, session, ... } from hermes
            const response =
              typeof result.response === 'string'
                ? result.response.trim()
                : typeof result.message === 'string'
                  ? result.message.trim()
                  : ''

            draftBody = response || '[Agent did not return a reply — try again]'
          } catch (agentErr) {
            // If the live agent is unreachable, fall back to the brand template
            // so the inbox still gets something reviewable rather than an error.
            console.warn('[webchat-agent-draft] agent unreachable, using template:', agentErr)
            const brandId = (process.env.BRAND ?? '').toLowerCase()
            const greeting =
              conv.contact_name && conv.contact_name !== 'Web visitor'
                ? `Hi ${conv.contact_name},`
                : 'Hi there,'
            if (brandId === 'hfm') {
              draftBody = `${greeting}\n\nThank you for reaching out to Holistic Functional Care. A member of our care team will follow up personally to support you. In the meantime, is there anything specific you'd like us to know ahead of that conversation?`
            } else if (brandId === 'sc') {
              draftBody = `${greeting}\n\nThanks for getting in touch with Simple Connect. Someone from our team will follow up shortly. Could you share a bit more about what you're looking for and your timeline?`
            } else {
              draftBody = `${greeting}\n\nThanks for reaching out! We've received your message and someone will follow up shortly.`
            }
          } finally {
            // Always clean up the ephemeral session.
            if (sessionId) {
              deleteSession(sessionId).catch(() => {
                // Non-fatal — orphaned sessions expire on their own.
              })
            }
          }

          const updated = addMessage(conv.id, {
            role: 'agent',
            body: draftBody,
            author: 'agent',
            draft: true,
          })
          if (!updated)
            return jsonResponse({ error: 'Failed to save draft' }, 500)

          return jsonResponse({ conversation: updated }, 201)
        } catch {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
