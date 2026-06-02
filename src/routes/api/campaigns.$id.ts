import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteCampaign,
  getCampaign,
  isCampaignStatus,
  updateCampaign,
} from '../../server/campaigns-store'
import { listContacts } from '../../server/contacts-store'
import type { ContactRecord } from '../../server/contacts-store'
import {
  isEmailConfigured,
  renderCampaignHtml,
  sendEmail,
} from '../../server/email-sender'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Resolve the recipient list for a campaign audience from the contacts store. */
function resolveRecipients(audience: {
  stages: string[]
  tags: string[]
  include_unverified: boolean
}): ContactRecord[] {
  return listContacts({}).filter((c) => {
    if (!c.email) return false // need an email to send
    if (c.stage === 'lost') return false // never email lost contacts
    if (!audience.include_unverified && c.unverified) return false
    if (audience.stages.length > 0 && !audience.stages.includes(c.stage))
      return false
    if (
      audience.tags.length > 0 &&
      !audience.tags.some((t) => c.tags.includes(t))
    )
      return false
    return true
  })
}

export const Route = createFileRoute('/api/campaigns/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const campaign = getCampaign(params.id)
        if (!campaign) return json({ error: 'Campaign not found' }, 404)
        // Include a live recipient-count preview
        const recipients = resolveRecipients(campaign.audience)
        return json({ campaign, recipient_preview: recipients.length })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const url = new URL(request.url)

          // ?action=send — resolve audience, send emails, update stats
          if (url.searchParams.get('action') === 'send') {
            const campaign = getCampaign(params.id)
            if (!campaign) return json({ error: 'Campaign not found' }, 404)
            if (campaign.status === 'sent') {
              return json({ error: 'Campaign already sent' }, 409)
            }
            if (!isEmailConfigured()) {
              updateCampaign(params.id, {
                status: 'failed',
              })
              return json(
                {
                  error:
                    'Email not configured. Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL.',
                  campaign: getCampaign(params.id),
                },
                502,
              )
            }

            const recipients = resolveRecipients(campaign.audience)
            updateCampaign(params.id, {
              status: 'sending',
              stats: { recipients: recipients.length, sent: 0, failed: 0 },
            })

            const brandName =
              campaign.brand === 'hfm'
                ? 'Holistic Functional Care'
                : campaign.brand === 'sc'
                  ? 'Simple Connect'
                  : 'Hermes'

            let sent = 0
            let failed = 0
            // Sequential send keeps it simple + within ESP rate limits.
            for (const contact of recipients) {
              if (!contact.email) continue
              const html = renderCampaignHtml(campaign.body, { brandName })
              const result = await sendEmail({
                to: contact.email,
                subject: campaign.subject,
                html,
              })
              if (result.ok) sent++
              else failed++
            }

            const updated = updateCampaign(params.id, {
              status: failed === recipients.length && recipients.length > 0 ? 'failed' : 'sent',
              sent_at: new Date().toISOString(),
              stats: { recipients: recipients.length, sent, failed },
            })
            return json({ campaign: updated })
          }

          // Regular update
          const body = (await request.json()) as Record<string, unknown>
          const audienceRaw = body.audience as
            | Record<string, unknown>
            | undefined
          const campaign = updateCampaign(params.id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            subject: typeof body.subject === 'string' ? body.subject : undefined,
            body: typeof body.body === 'string' ? body.body : undefined,
            scheduled_at:
              body.scheduled_at === null || typeof body.scheduled_at === 'string'
                ? body.scheduled_at
                : undefined,
            status: isCampaignStatus(body.status) ? body.status : undefined,
            audience: audienceRaw
              ? {
                  stages: Array.isArray(audienceRaw.stages)
                    ? (audienceRaw.stages as unknown[]).filter(
                        (s): s is string => typeof s === 'string',
                      )
                    : [],
                  tags: Array.isArray(audienceRaw.tags)
                    ? (audienceRaw.tags as unknown[]).filter(
                        (t): t is string => typeof t === 'string',
                      )
                    : [],
                  include_unverified: audienceRaw.include_unverified === true,
                }
              : undefined,
          })
          if (!campaign) return json({ error: 'Campaign not found' }, 404)
          return json({ campaign })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deleteCampaign(params.id)
        if (!ok) return json({ error: 'Campaign not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
