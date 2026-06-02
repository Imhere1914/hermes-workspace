import { createFileRoute } from '@tanstack/react-router'
import { getPublishedPageBySlug } from '../../server/pages-store'

/**
 * PUBLIC landing-page lookup — returns a PUBLISHED page by slug.
 * No auth: this powers the public /p/<slug> render route. Only published
 * pages are exposed; drafts return 404.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

export const Route = createFileRoute('/api/pages/public/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const page = getPublishedPageBySlug(params.slug)
        if (!page) {
          return new Response(JSON.stringify({ error: 'Page not found' }), {
            status: 404,
            headers: CORS,
          })
        }
        return new Response(JSON.stringify({ page }), {
          status: 200,
          headers: CORS,
        })
      },
    },
  },
})
