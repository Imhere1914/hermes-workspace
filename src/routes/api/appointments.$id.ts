import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteAppointment,
  getAppointment,
  isAppointmentStatus,
  updateAppointment,
} from '../../server/appointments-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/appointments/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const appointment = getAppointment(params.id)
        if (!appointment) return json({ error: 'Appointment not found' }, 404)
        return json({ appointment })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          const appointment = updateAppointment(params.id, {
            title: typeof body.title === 'string' ? body.title : undefined,
            starts_at:
              typeof body.starts_at === 'string' ? body.starts_at : undefined,
            ends_at:
              body.ends_at === null || typeof body.ends_at === 'string'
                ? body.ends_at
                : undefined,
            contact_id:
              body.contact_id === null || typeof body.contact_id === 'string'
                ? body.contact_id
                : undefined,
            contact_name:
              body.contact_name === null || typeof body.contact_name === 'string'
                ? body.contact_name
                : undefined,
            status: isAppointmentStatus(body.status) ? body.status : undefined,
            location: typeof body.location === 'string' ? body.location : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
          })
          if (!appointment) return json({ error: 'Appointment not found' }, 404)
          return json({ appointment })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deleteAppointment(params.id)
        if (!ok) return json({ error: 'Appointment not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
