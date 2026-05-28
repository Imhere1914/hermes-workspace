/**
 * BrandStatusBadge — persistent header chip showing brand name and backend
 * connection state. Polls /api/supervisor-health every 10 s. Falls back to
 * the existing /api/connection-status probe when the supervisor is absent.
 *
 * Visual states:
 *   ● green   Connected       — agent is up
 *   ● yellow  Reconnecting…   — agent was up but is now unreachable
 *   ● red     Down            — agent unreachable after grace period
 */
import { useEffect, useRef, useState } from 'react'
import { useBrand } from '@/contexts/BrandContext'

type AgentState = 'connected' | 'reconnecting' | 'down' | 'starting'

const POLL_MS = 10_000
const DOWN_AFTER_MS = 30_000

async function probeHealth(): Promise<boolean> {
  // Try supervisor proxy first, fall back to connection-status
  for (const url of ['/api/supervisor-health', '/api/connection-status']) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        // supervisor returns { agent: 'up'|'down'... }
        // connection-status returns { health: boolean, ... }
        if ('agent' in data) return data.agent === 'up'
        if ('health' in data) return Boolean(data.health)
        return true
      }
    } catch {
      // continue
    }
  }
  return false
}

export function BrandStatusBadge() {
  const brand = useBrand()
  const [state, setState] = useState<AgentState>('starting')
  const lastUpRef = useRef<number>(Date.now())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    let raf: number

    async function tick() {
      if (!mountedRef.current) return
      const healthy = await probeHealth()
      if (!mountedRef.current) return

      if (healthy) {
        lastUpRef.current = Date.now()
        setState('connected')
      } else {
        const elapsed = Date.now() - lastUpRef.current
        setState(elapsed > DOWN_AFTER_MS ? 'down' : 'reconnecting')
      }

      // Schedule next poll
      raf = window.setTimeout(tick, POLL_MS)
    }

    tick()
    return () => window.clearTimeout(raf)
  }, [])

  const dot: Record<AgentState, string> = {
    connected:    'bg-green-400',
    reconnecting: 'bg-yellow-400 animate-pulse',
    down:         'bg-red-500',
    starting:     'bg-zinc-400',
  }

  const label: Record<AgentState, string> = {
    connected:    'Connected',
    reconnecting: 'Reconnecting…',
    down:         'Down',
    starting:     '',
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300 select-none shrink-0">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[state]}`} />
      <span className="font-medium text-white/80">{brand.shortName}</span>
      {state !== 'starting' && (
        <span className="text-zinc-400">{label[state]}</span>
      )}
    </div>
  )
}
