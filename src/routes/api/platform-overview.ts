import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { listContacts } from '../../server/contacts-store'
import { listConversations } from '../../server/conversations-store'
import { listPosts } from '../../server/social-store'
import { listCampaigns } from '../../server/campaigns-store'
import { listProjects } from '../../server/projects-store'
import { listPages } from '../../server/pages-store'
import { listAppointments } from '../../server/appointments-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Platform overview aggregator — counts + headline metrics across all
 * Phase 4 modules, for the unified Dashboard. Scoped by ?brand when set.
 */
export const Route = createFileRoute('/api/platform-overview')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const brand = url.searchParams.get('brand') || undefined

        const contacts = listContacts({})
        const conversations = listConversations({})
        const posts = listPosts(brand ? { brand } : {})
        const campaigns = listCampaigns(brand ? { brand } : {})
        const projects = listProjects(brand ? { brand } : {})
        const pages = listPages(brand ? { brand } : {})
        const upcomingAppts = listAppointments({
          brand: brand ?? null,
          when: 'upcoming',
        })

        const overview = {
          contacts: {
            total: contacts.length,
            unverified: contacts.filter((c) => c.unverified).length,
            customers: contacts.filter((c) => c.stage === 'customer').length,
            leads: contacts.filter((c) => c.stage === 'lead').length,
          },
          conversations: {
            total: conversations.length,
            open: conversations.filter((c) => c.status === 'open').length,
            unread: conversations.filter((c) => c.unread).length,
          },
          social: {
            total: posts.length,
            scheduled: posts.filter((p) => p.status === 'scheduled').length,
            published: posts.filter((p) => p.status === 'published').length,
          },
          campaigns: {
            total: campaigns.length,
            sent: campaigns.filter((c) => c.status === 'sent').length,
            draft: campaigns.filter((c) => c.status === 'draft').length,
          },
          projects: {
            total: projects.length,
            active: projects.filter((p) => p.status === 'active').length,
          },
          pages: {
            total: pages.length,
            published: pages.filter((p) => p.status === 'published').length,
          },
          appointments: {
            upcoming: upcomingAppts.length,
            confirmed: upcomingAppts.filter((a) => a.status === 'confirmed').length,
          },
        }

        return json({ overview })
      },
    },
  },
})
