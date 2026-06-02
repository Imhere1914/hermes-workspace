import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fetchPublicPage } from '@/lib/pages-api'
import type { Page } from '@/lib/pages-api'
import { PageRenderer } from '@/components/page-renderer'

/**
 * Public landing-page route: /p/<slug>
 *
 * Renders a PUBLISHED page. Auth-bypassed in __root.tsx (standalone, like
 * /widget) so it can be shared publicly / embedded.
 */
function PublicPage() {
  const { slug } = Route.useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    let cancelled = false
    fetchPublicPage(slug)
      .then((p) => {
        if (cancelled) return
        if (p) {
          setPage(p)
          setState('ok')
          if (typeof document !== 'undefined') document.title = p.title
        } else {
          setState('notfound')
        }
      })
      .catch(() => {
        if (!cancelled) setState('notfound')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (state === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, sans-serif',
          color: '#888',
        }}
      >
        Loading…
      </div>
    )
  }

  if (state === 'notfound' || !page) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, sans-serif',
          color: '#888',
        }}
      >
        <h1 style={{ fontSize: 24, color: '#333' }}>Page not found</h1>
        <p>This page may be unpublished or the link is incorrect.</p>
      </div>
    )
  }

  return <PageRenderer page={page} />
}

export const Route = createFileRoute('/p/$slug')({
  ssr: false,
  component: PublicPage,
})
