import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createPost,
  isSocialPlatform,
  isSocialPostStatus,
  listPosts,
} from '../../server/social-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/social')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const posts = listPosts({
          status: url.searchParams.get('status'),
          platform: url.searchParams.get('platform'),
          brand: url.searchParams.get('brand'),
        })
        return json({ posts })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.content || typeof body.content !== 'string') {
            return json({ error: 'content is required' }, 400)
          }
          const platforms = Array.isArray(body.platforms)
            ? body.platforms.filter(isSocialPlatform)
            : []
          const post = createPost({
            content: body.content,
            platforms,
            media_urls: Array.isArray(body.media_urls)
              ? body.media_urls.filter((u): u is string => typeof u === 'string')
              : [],
            scheduled_at:
              typeof body.scheduled_at === 'string' ? body.scheduled_at : null,
            notes: typeof body.notes === 'string' ? body.notes : '',
            brand: typeof body.brand === 'string' ? body.brand : undefined,
            status: isSocialPostStatus(body.status) ? body.status : undefined,
          })
          return json({ post }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
