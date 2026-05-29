import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { addMessage, getConversation } from '../../server/conversations-store'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Generate an agent draft reply for a conversation.
 *
 * The draft is saved with `draft: true` so it appears in the inbox flagged
 * for human review and is NEVER auto-sent to the visitor (mirrors the
 * Gmail "draft, don't send" guardrail).
 *
 * NOTE: this currently produces a brand-aware first-response draft locally.
 * The next wiring step is to call the live hermes agent (SOUL.md + guardrails)
 * for a context-aware reply — interface marked with TODO below. The end-to-end
 * UX (draft → human approve → send) is fully functional already.
 */

function brandTone(): 'hfm' | 'sc' | 'default' {
  const b = (process.env.BRAND ?? '').toLowerCase()
  if (b === 'hfm') return 'hfm'
  if (b === 'sc') return 'sc'
  return 'default'
}

function buildDraft(lastContactMessage: string, contactName: string): string {
  const name = contactName && contactName !== 'Web visitor' ? contactName : ''
  const greeting = name ? `Hi ${name},` : 'Hi there,'
  switch (brandTone()) {
    case 'hfm':
      return `${greeting}

Thank you so much for reaching out to Holistic Functional Care — we're glad you connected with us. I want to make sure you get the support you're looking for.

A member of our care team will follow up personally to learn more and find the best next step for you. (Please note we can't provide medical or treatment advice over chat — your wellbeing matters too much for that.)

In the meantime, is there anything specific you'd like us to know ahead of that conversation?`
    case 'sc':
      return `${greeting}

Thanks for getting in touch with Simple Connect — appreciate you reaching out. I'd love to point you in the right direction.

Someone from our team will follow up shortly. To help us move fast, could you share a bit more about what you're looking for and your timeline?`
    default:
      return `${greeting}

Thanks for reaching out! We've received your message and someone will follow up shortly. Anything else you'd like us to know in the meantime?`
  }
  // TODO(phase4): replace the above with a call to the hermes agent API
  //   (HERMES_AGENT_URL + API_SERVER_KEY), passing the conversation history +
  //   SOUL.md guardrails, and use its reply as the draft body.
  void lastContactMessage
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

          const lastContact = [...conv.messages]
            .reverse()
            .find((m) => m.role === 'contact')
          const draftBody = buildDraft(
            lastContact?.body ?? '',
            conv.contact_name ?? '',
          )

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
