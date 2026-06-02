import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createProject,
  isProjectPriority,
  isProjectStatus,
  listProjects,
} from '../../server/projects-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const projects = listProjects({
          status: url.searchParams.get('status'),
          brand: url.searchParams.get('brand'),
          contact_id: url.searchParams.get('contact_id'),
        })
        return json({ projects })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.name || typeof body.name !== 'string') {
            return json({ error: 'name is required' }, 400)
          }
          const project = createProject({
            name: body.name,
            description:
              typeof body.description === 'string' ? body.description : '',
            contact_id:
              typeof body.contact_id === 'string' ? body.contact_id : null,
            contact_name:
              typeof body.contact_name === 'string' ? body.contact_name : null,
            status: isProjectStatus(body.status) ? body.status : undefined,
            priority: isProjectPriority(body.priority) ? body.priority : undefined,
            progress: typeof body.progress === 'number' ? body.progress : 0,
            due_date: typeof body.due_date === 'string' ? body.due_date : null,
            notes: typeof body.notes === 'string' ? body.notes : '',
            brand: typeof body.brand === 'string' ? body.brand : undefined,
          })
          return json({ project }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
