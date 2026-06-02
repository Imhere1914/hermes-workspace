import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteTemplate,
  getTemplate,
  isTemplateCategory,
  updateTemplate,
} from '../../server/templates-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/templates/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const template = getTemplate(params.id)
        if (!template) return json({ error: 'Template not found' }, 404)
        return json({ template })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          const template = updateTemplate(params.id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            category: isTemplateCategory(body.category) ? body.category : undefined,
            subject: typeof body.subject === 'string' ? body.subject : undefined,
            body: typeof body.body === 'string' ? body.body : undefined,
            tags: Array.isArray(body.tags)
              ? body.tags.filter((t): t is string => typeof t === 'string')
              : undefined,
          })
          if (!template) return json({ error: 'Template not found' }, 404)
          return json({ template })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deleteTemplate(params.id)
        if (!ok) return json({ error: 'Template not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
