import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deletePage,
  getPage,
  publishPage,
  unpublishPage,
  updatePage,
} from '../../server/pages-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/pages/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const page = getPage(params.id)
        if (!page) return json({ error: 'Page not found' }, 404)
        return json({ page })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const action = url.searchParams.get('action')

        if (action === 'publish') {
          const page = publishPage(params.id)
          if (!page) return json({ error: 'Page not found' }, 404)
          return json({ page })
        }
        if (action === 'unpublish') {
          const page = unpublishPage(params.id)
          if (!page) return json({ error: 'Page not found' }, 404)
          return json({ page })
        }

        try {
          const body = (await request.json()) as Record<string, unknown>
          const page = updatePage(params.id, {
            title: typeof body.title === 'string' ? body.title : undefined,
            slug: typeof body.slug === 'string' ? body.slug : undefined,
            fields:
              body.fields && typeof body.fields === 'object'
                ? (body.fields as Record<string, string>)
                : undefined,
            accent_color:
              typeof body.accent_color === 'string'
                ? body.accent_color
                : undefined,
          })
          if (!page) return json({ error: 'Page not found' }, 404)
          return json({ page })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deletePage(params.id)
        if (!ok) return json({ error: 'Page not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
