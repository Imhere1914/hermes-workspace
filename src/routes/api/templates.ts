import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createTemplate,
  isTemplateCategory,
  listTemplates,
} from '../../server/templates-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/templates')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const templates = listTemplates({
          category: url.searchParams.get('category'),
          brand: url.searchParams.get('brand'),
        })
        return json({ templates })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.name || typeof body.name !== 'string') {
            return json({ error: 'name is required' }, 400)
          }
          const template = createTemplate({
            name: body.name,
            category: isTemplateCategory(body.category) ? body.category : undefined,
            subject: typeof body.subject === 'string' ? body.subject : '',
            body: typeof body.body === 'string' ? body.body : '',
            tags: Array.isArray(body.tags)
              ? body.tags.filter((t): t is string => typeof t === 'string')
              : [],
            brand: typeof body.brand === 'string' ? body.brand : undefined,
          })
          return json({ template }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
