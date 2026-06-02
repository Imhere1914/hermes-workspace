import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deletePost,
  getPost,
  isSocialPlatform,
  isSocialPostStatus,
  markFailed,
  markPublished,
  updatePost,
} from '../../server/social-store'
import { publishPost } from '../../server/social-publisher'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/social/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const post = getPost(params.id)
        if (!post) return json({ error: 'Post not found' }, 404)
        return json({ post })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>

          // ?action=publish — trigger immediate publish through social API
          const url = new URL(request.url)
          if (url.searchParams.get('action') === 'publish') {
            const existing = getPost(params.id)
            if (!existing) return json({ error: 'Post not found' }, 404)
            if (existing.status === 'published') {
              return json({ error: 'Already published' }, 409)
            }

            const result = await publishPost({
              platforms: existing.platforms,
              content: existing.content,
              mediaUrls: existing.media_urls,
              scheduledAt: null, // publish now
            })

            if (!result.ok) {
              markFailed(params.id, result.error)
              return json({ error: result.error, post: getPost(params.id) }, 502)
            }

            const updated = markPublished(params.id, result.external_ids)
            return json({ post: updated })
          }

          // Regular update
          const post = updatePost(params.id, {
            content: typeof body.content === 'string' ? body.content : undefined,
            platforms: Array.isArray(body.platforms)
              ? body.platforms.filter(isSocialPlatform)
              : undefined,
            media_urls: Array.isArray(body.media_urls)
              ? body.media_urls.filter((u): u is string => typeof u === 'string')
              : undefined,
            scheduled_at:
              body.scheduled_at === null ||
              typeof body.scheduled_at === 'string'
                ? body.scheduled_at
                : undefined,
            status: isSocialPostStatus(body.status) ? body.status : undefined,
            notes: typeof body.notes === 'string' ? body.notes : undefined,
          })
          if (!post) return json({ error: 'Post not found' }, 404)
          return json({ post })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deletePost(params.id)
        if (!ok) return json({ error: 'Post not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
