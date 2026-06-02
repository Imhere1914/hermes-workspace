import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createPage,
  isPageTemplate,
  listPages,
} from '../../server/pages-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/pages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const pages = listPages({
          status: url.searchParams.get('status'),
          brand: url.searchParams.get('brand'),
        })
        return json({ pages })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.title || typeof body.title !== 'string') {
            return json({ error: 'title is required' }, 400)
          }
          const page = createPage({
            title: body.title,
            slug: typeof body.slug === 'string' ? body.slug : undefined,
            template: isPageTemplate(body.template) ? body.template : undefined,
            fields:
              body.fields && typeof body.fields === 'object'
                ? (body.fields as Record<string, string>)
                : {},
            accent_color:
              typeof body.accent_color === 'string'
                ? body.accent_color
                : undefined,
            brand: typeof body.brand === 'string' ? body.brand : undefined,
          })
          return json({ page }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
