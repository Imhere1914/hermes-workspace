import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createAppointment,
  isAppointmentStatus,
  listAppointments,
} from '../../server/appointments-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/appointments')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const appointments = listAppointments({
          status: url.searchParams.get('status'),
          brand: url.searchParams.get('brand'),
          contact_id: url.searchParams.get('contact_id'),
          when: url.searchParams.get('when'),
        })
        return json({ appointments })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.title || typeof body.title !== 'string') {
            return json({ error: 'title is required' }, 400)
          }
          if (!body.starts_at || typeof body.starts_at !== 'string') {
            return json({ error: 'starts_at is required' }, 400)
          }
          const appointment = createAppointment({
            title: body.title,
            starts_at: body.starts_at,
            ends_at: typeof body.ends_at === 'string' ? body.ends_at : null,
            contact_id:
              typeof body.contact_id === 'string' ? body.contact_id : null,
            contact_name:
              typeof body.contact_name === 'string' ? body.contact_name : null,
            status: isAppointmentStatus(body.status) ? body.status : undefined,
            location: typeof body.location === 'string' ? body.location : '',
            notes: typeof body.notes === 'string' ? body.notes : '',
            brand: typeof body.brand === 'string' ? body.brand : undefined,
          })
          return json({ appointment }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
