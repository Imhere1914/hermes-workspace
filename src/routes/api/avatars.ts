import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createAvatar,
  isAvatarSurface,
  listAvatars,
} from '../../server/avatars-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/avatars')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const avatars = listAvatars({ brand: url.searchParams.get('brand') })
        return json({ avatars })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.name || typeof body.name !== 'string') {
            return json({ error: 'name is required' }, 400)
          }
          const avatar = createAvatar({
            name: body.name,
            emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
            image_url: typeof body.image_url === 'string' ? body.image_url : '',
            voice_name: typeof body.voice_name === 'string' ? body.voice_name : '',
            voice_rate:
              typeof body.voice_rate === 'number' ? body.voice_rate : undefined,
            greeting: typeof body.greeting === 'string' ? body.greeting : undefined,
            accent_color:
              typeof body.accent_color === 'string' ? body.accent_color : undefined,
            surface: isAvatarSurface(body.surface) ? body.surface : undefined,
            is_default: body.is_default === true,
            brand: typeof body.brand === 'string' ? body.brand : undefined,
          })
          return json({ avatar }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
