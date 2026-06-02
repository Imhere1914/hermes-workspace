import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteAvatar,
  getAvatar,
  isAvatarSurface,
  updateAvatar,
} from '../../server/avatars-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/avatars/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const avatar = getAvatar(params.id)
        if (!avatar) return json({ error: 'Avatar not found' }, 404)
        return json({ avatar })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          const avatar = updateAvatar(params.id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
            image_url:
              typeof body.image_url === 'string' ? body.image_url : undefined,
            voice_name:
              typeof body.voice_name === 'string' ? body.voice_name : undefined,
            voice_rate:
              typeof body.voice_rate === 'number' ? body.voice_rate : undefined,
            greeting: typeof body.greeting === 'string' ? body.greeting : undefined,
            accent_color:
              typeof body.accent_color === 'string' ? body.accent_color : undefined,
            surface: isAvatarSurface(body.surface) ? body.surface : undefined,
            is_default:
              typeof body.is_default === 'boolean' ? body.is_default : undefined,
          })
          if (!avatar) return json({ error: 'Avatar not found' }, 404)
          return json({ avatar })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deleteAvatar(params.id)
        if (!ok) return json({ error: 'Avatar not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
