import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteProject,
  getProject,
  isProjectPriority,
  isProjectStatus,
  updateProject,
} from '../../server/projects-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/projects/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const project = getProject(params.id)
        if (!project) return json({ error: 'Project not found' }, 404)
        return json({ project })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          const project = updateProject(params.id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            description:
              typeof body.description === 'string' ? body.description : undefined,
            contact_id:
              body.contact_id === null || typeof body.contact_id === 'string'
                ? body.contact_id
                : undefined,
            contact_name:
              body.contact_name === null || typeof body.contact_name === 'string'
                ? body.contact_name
                : undefined,
            status: isProjectStatus(body.status) ? body.status : undefined,
            priority: isProjectPriority(body.priority) ? body.priority : undefined,
            progress: typeof body.progress === 'number' ? body.progress : undefined,
            due_date:
              body.due_date === null || typeof body.due_date === 'string'
                ? body.due_date
                : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
          })
          if (!project) return json({ error: 'Project not found' }, 404)
          return json({ project })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deleteProject(params.id)
        if (!ok) return json({ error: 'Project not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
