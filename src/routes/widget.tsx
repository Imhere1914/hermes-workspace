import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

/**
 * Embeddable web-chat widget (Phase 4).
 *
 * Standalone, brand-themed chat page intended to be embedded on external
 * landing pages via an iframe, e.g.:
 *   <iframe src="https://app.example.com/widget?brand=hfm"
 *           style="border:0;width:380px;height:560px"></iframe>
 *
 * It talks ONLY to the public /api/webchat ingest endpoint, persists the
 * conversation id in localStorage so returning visitors keep their thread,
 * and uses inline styles so it renders correctly outside the app shell.
 *
 * NOTE: serve this route publicly (bypass workspace auth for /widget) when
 * deploying — see PHASE4 build notes.
 */

type WidgetMessage = { role: 'visitor' | 'agent'; body: string; created_at: string }

const BRAND_THEMES: Record<
  string,
  { name: string; accent: string; greeting: string }
> = {
  hfm: {
    name: 'Holistic Functional Care',
    accent: '#7c6f9b',
    greeting: 'Hi! How can we support your wellness journey today?',
  },
  sc: {
    name: 'Simple Connect',
    accent: '#2f6df6',
    greeting: 'Hi! How can we help your business today?',
  },
  default: {
    name: 'Chat',
    accent: '#4A9EA1',
    greeting: 'Hi! How can we help?',
  },
}

function WidgetApp() {
  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()
  const brandId = params.get('brand') ?? 'default'
  const theme = BRAND_THEMES[brandId] ?? BRAND_THEMES.default
  const storageKey = `webchat_conv_${brandId}`

  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [input, setInput] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [started, setStarted] = useState(false)
  const [sending, setSending] = useState(false)
  const convIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(storageKey)
    if (saved) {
      convIdRef.current = saved
      setStarted(true)
    }
  }, [storageKey])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function send(body: string) {
    setSending(true)
    setMessages((m) => [
      ...m,
      { role: 'visitor', body, created_at: new Date().toISOString() },
    ])
    try {
      const res = await fetch('/api/webchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: body,
          name: name || undefined,
          email: email || undefined,
          conversation_id: convIdRef.current ?? undefined,
        }),
      })
      const data = (await res.json()) as {
        conversation_id?: string
        messages?: WidgetMessage[]
        error?: string
      }
      if (data.conversation_id) {
        convIdRef.current = data.conversation_id
        if (typeof window !== 'undefined')
          window.localStorage.setItem(storageKey, data.conversation_id)
      }
      if (Array.isArray(data.messages)) setMessages(data.messages)
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'agent',
          body: 'Sorry — something went wrong sending that. Please try again.',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleSend() {
    const body = input.trim()
    if (!body) return
    setInput('')
    if (!started) setStarted(true)
    void send(body)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        background: '#fff',
        color: '#1a1a1a',
      }}
    >
      <div
        style={{
          background: theme.accent,
          color: '#fff',
          padding: '14px 16px',
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        {theme.name}
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: 16, fontSize: 14 }}
      >
        <div
          style={{
            background: '#f3f3f5',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 12,
            maxWidth: '85%',
          }}
        >
          {theme.greeting}
        </div>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'visitor' ? 'flex-end' : 'flex-start',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                background: m.role === 'visitor' ? theme.accent : '#f3f3f5',
                color: m.role === 'visitor' ? '#fff' : '#1a1a1a',
                borderRadius: 12,
                padding: '8px 12px',
                maxWidth: '85%',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.45,
              }}
            >
              {m.body}
            </div>
          </div>
        ))}
      </div>

      {!started && (
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid #eee',
        }}
      >
        <input
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            background: theme.accent,
            color: '#fff',
            border: 0,
            borderRadius: 10,
            padding: '0 16px',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  minWidth: 0,
  flex: 1,
}

export const Route = createFileRoute('/widget')({
  ssr: false,
  component: WidgetApp,
})
