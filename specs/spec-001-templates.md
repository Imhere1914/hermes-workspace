# Spec-001 — Templates module (Templates library)

**Status:** done (built locally by Opus, not the Minimax executor)
**Executor model:** minimax (cheap) — follow this spec LITERALLY. Do not improvise.
**Repo:** hermes-workspace · **Base branch:** phase4-platform · **Work branch:** `auto/spec-001`
**Architect:** Opus (this spec is complete; create the files exactly as written)

---

## Rules for the executor (READ FIRST)

1. Work ONLY in this repo. Create a new branch `auto/spec-001` off `phase4-platform`.
2. Create the files below with the EXACT contents shown. Do not rename, do not "improve", do not add extra files.
3. After creating files, run the VERIFICATION step. If it fails, fix ONLY the specific compile error reported, then re-run. Make at most 5 fix attempts.
4. When verification passes, COMMIT to `auto/spec-001` with the commit message at the bottom. Do NOT merge to main. Do NOT push. Do NOT deploy. Do NOT touch any other branch.
5. If you get stuck (verification still failing after 5 attempts), set this file's `Status:` to `blocked`, write a `## BLOCKED NOTES` section describing exactly what failed, commit that, and stop.
6. When done successfully, set this file's `Status:` to `done`.

This is the same `store → API → client → screen → route → nav` pattern already used by
`src/server/projects-store.ts`, `src/routes/api/projects.ts`, `src/lib/projects-api.ts`,
`src/screens/projects/projects-screen.tsx`, `src/routes/projects.tsx`. Reference those if confused.

---

## FILE 1 — create `src/server/templates-store.ts`

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Templates store — reusable message/email/social/content templates.
 * File-backed JSON, same conventions as the other platform stores.
 */

export type TemplateCategory = 'email' | 'sms' | 'social' | 'reply' | 'note'

export type TemplateRecord = {
  id: string
  brand: string
  name: string
  category: TemplateCategory
  /** Optional subject line (used for email category) */
  subject: string
  body: string
  tags: string[]
  created_at: string
  updated_at: string
}

type TemplateFile = { templates: TemplateRecord[] }

type CreateTemplateInput = Partial<TemplateRecord> & { name: string }
type UpdateTemplateInput = Partial<Omit<TemplateRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.HERMES_HOME ??
  process.env.CLAUDE_HOME ??
  path.join(os.homedir(), '.hermes')
const TEMPLATES_FILE = path.join(CLAUDE_HOME, 'templates.json')

const CATEGORIES: TemplateCategory[] = ['email', 'sms', 'social', 'reply', 'note']

export function isTemplateCategory(v: unknown): v is TemplateCategory {
  return typeof v === 'string' && CATEGORIES.includes(v as TemplateCategory)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(
      TEMPLATES_FILE,
      JSON.stringify({ templates: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): TemplateFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8').trim()
    if (!raw) return { templates: [] }
    const parsed = JSON.parse(raw) as Partial<TemplateFile>
    return { templates: Array.isArray(parsed.templates) ? parsed.templates : [] }
  } catch {
    return { templates: [] }
  }
}

function writeFile(data: TemplateFile): void {
  ensureFile()
  const tmp = `${TEMPLATES_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, TEMPLATES_FILE)
}

function normalize(
  t: Partial<TemplateRecord> &
    Pick<TemplateRecord, 'id' | 'name' | 'created_at' | 'updated_at'>,
): TemplateRecord {
  return {
    id: t.id,
    brand: typeof t.brand === 'string' ? t.brand : process.env.BRAND ?? 'default',
    name: t.name,
    category: isTemplateCategory(t.category) ? t.category : 'reply',
    subject: typeof t.subject === 'string' ? t.subject : '',
    body: typeof t.body === 'string' ? t.body : '',
    tags: Array.isArray(t.tags)
      ? t.tags.filter((x): x is string => typeof x === 'string')
      : [],
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

export function listTemplates(filters?: {
  category?: string | null
  brand?: string | null
}): TemplateRecord[] {
  let templates = readFile().templates.map(normalize)
  if (filters?.category)
    templates = templates.filter((t) => t.category === filters.category)
  if (filters?.brand) templates = templates.filter((t) => t.brand === filters.brand)
  return templates.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getTemplate(id: string): TemplateRecord | null {
  return readFile().templates.map(normalize).find((t) => t.id === id) ?? null
}

export function createTemplate(input: CreateTemplateInput): TemplateRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const template = normalize({
    id: randomUUID(),
    brand: typeof input.brand === 'string' ? input.brand : undefined,
    name: input.name,
    category: input.category,
    subject: input.subject,
    body: input.body,
    tags: input.tags,
    created_at: now,
    updated_at: now,
  })
  file.templates.push(template)
  writeFile({ templates: file.templates.map(normalize) })
  return template
}

export function updateTemplate(
  id: string,
  updates: UpdateTemplateInput,
): TemplateRecord | null {
  const file = readFile()
  const index = file.templates.findIndex((t) => t.id === id)
  if (index === -1) return null
  const current = normalize(file.templates[index] as TemplateRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  file.templates[index] = next
  writeFile({ templates: file.templates.map(normalize) })
  return next
}

export function deleteTemplate(id: string): boolean {
  const file = readFile()
  const next = file.templates.filter((t) => t.id !== id)
  if (next.length === file.templates.length) return false
  writeFile({ templates: next.map((t) => normalize(t as TemplateRecord)) })
  return true
}

export const TEMPLATE_CATEGORIES = CATEGORIES
```

---

## FILE 2 — create `src/routes/api/templates.ts`

```ts
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  createTemplate,
  isTemplateCategory,
  listTemplates,
} from '../../server/templates-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/templates')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const url = new URL(request.url)
        const templates = listTemplates({
          category: url.searchParams.get('category'),
          brand: url.searchParams.get('brand'),
        })
        return json({ templates })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          if (!body.name || typeof body.name !== 'string') {
            return json({ error: 'name is required' }, 400)
          }
          const template = createTemplate({
            name: body.name,
            category: isTemplateCategory(body.category) ? body.category : undefined,
            subject: typeof body.subject === 'string' ? body.subject : '',
            body: typeof body.body === 'string' ? body.body : '',
            tags: Array.isArray(body.tags)
              ? body.tags.filter((t): t is string => typeof t === 'string')
              : [],
            brand: typeof body.brand === 'string' ? body.brand : undefined,
          })
          return json({ template }, 201)
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },
    },
  },
})
```

---

## FILE 3 — create `src/routes/api/templates.$id.ts`

```ts
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  deleteTemplate,
  getTemplate,
  isTemplateCategory,
  updateTemplate,
} from '../../server/templates-store'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/templates/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const template = getTemplate(params.id)
        if (!template) return json({ error: 'Template not found' }, 404)
        return json({ template })
      },

      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        try {
          const body = (await request.json()) as Record<string, unknown>
          const template = updateTemplate(params.id, {
            name: typeof body.name === 'string' ? body.name : undefined,
            category: isTemplateCategory(body.category) ? body.category : undefined,
            subject: typeof body.subject === 'string' ? body.subject : undefined,
            body: typeof body.body === 'string' ? body.body : undefined,
            tags: Array.isArray(body.tags)
              ? body.tags.filter((t): t is string => typeof t === 'string')
              : undefined,
          })
          if (!template) return json({ error: 'Template not found' }, 404)
          return json({ template })
        } catch {
          return json({ error: 'Invalid request body' }, 400)
        }
      },

      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, 401)
        const ok = deleteTemplate(params.id)
        if (!ok) return json({ error: 'Template not found' }, 404)
        return json({ ok: true })
      },
    },
  },
})
```

---

## FILE 4 — create `src/lib/templates-api.ts`

```ts
/** Templates API client — /api/templates routes. */

const API = '/api/templates'

export type TemplateCategory = 'email' | 'sms' | 'social' | 'reply' | 'note'

export type Template = {
  id: string
  brand: string
  name: string
  category: TemplateCategory
  subject: string
  body: string
  tags: string[]
  created_at: string
  updated_at: string
}

export type CreateTemplateInput = {
  name: string
  category?: TemplateCategory
  subject?: string
  body?: string
  tags?: string[]
  brand?: string
}

export type UpdateTemplateInput = Partial<Omit<CreateTemplateInput, 'brand'>>

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'email',
  'sms',
  'social',
  'reply',
  'note',
]

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  email: 'Email',
  sms: 'SMS',
  social: 'Social',
  reply: 'Reply',
  note: 'Note',
}

export async function fetchTemplates(params?: {
  category?: string
  brand?: string
}): Promise<Template[]> {
  const qs = new URLSearchParams()
  if (params?.category) qs.set('category', params.category)
  if (params?.brand) qs.set('brand', params.brand)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load templates (${res.status})`)
  const data = (await res.json()) as { templates?: Template[] }
  return Array.isArray(data.templates) ? data.templates : []
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<Template> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create template (${res.status})`)
  }
  const data = (await res.json()) as { template: Template }
  return data.template
}

export async function updateTemplate(
  id: string,
  updates: UpdateTemplateInput,
): Promise<Template> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update template (${res.status})`)
  }
  const data = (await res.json()) as { template: Template }
  return data.template
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete template (${res.status})`)
}
```

---

## FILE 5 — create `src/screens/templates/templates-screen.tsx`

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Copy01Icon,
  Delete01Icon,
  PencilEdit02Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import {
  CATEGORY_LABELS,
  TEMPLATE_CATEGORIES,
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  updateTemplate,
} from '@/lib/templates-api'
import type {
  CreateTemplateInput,
  Template,
  TemplateCategory,
} from '@/lib/templates-api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useBrand } from '@/contexts/BrandContext'

const QUERY_KEY = ['platform', 'templates'] as const

type FormState = {
  name: string
  category: TemplateCategory
  subject: string
  body: string
  tags: string
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'reply',
  subject: '',
  body: '',
  tags: '',
}

function TemplateDialog({
  open,
  initial,
  title,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  initial: FormState
  title: string
  onClose: () => void
  onSubmit: (form: FormState) => void
  isSubmitting: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)

  useMemo(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--theme-text)]">
          {title}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Template name
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as TemplateCategory)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)]"
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          {form.category === 'email' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
                Subject
              </label>
              <input
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Body (use {'{{name}}'} for placeholders)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              rows={6}
              className="w-full resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">
              Tags (comma-separated)
            </label>
            <input
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-xs text-[var(--theme-text)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.name.trim() || isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TemplatesScreen() {
  const queryClient = useQueryClient()
  const brand = useBrand()

  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>(
    'all',
  )
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  const templatesQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      fetchTemplates({ brand: brand.id !== 'hermes' ? brand.id : undefined }),
    refetchInterval: 60_000,
  })

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (input: CreateTemplateInput) => createTemplate(input),
    onSuccess: () => {
      invalidate()
      toast('Template saved')
      setShowCreate(false)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to save', { type: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: (p: { id: string; updates: Partial<CreateTemplateInput> }) =>
      updateTemplate(p.id, p.updates),
    onSuccess: () => {
      invalidate()
      toast('Template updated')
      setEditing(null)
    },
    onError: (e) =>
      toast(e instanceof Error ? e.message : 'Failed to update', { type: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      invalidate()
      toast('Template deleted')
    },
  })

  const filtered = useMemo(() => {
    const templates = templatesQuery.data ?? []
    if (categoryFilter === 'all') return templates
    return templates.filter((t) => t.category === categoryFilter)
  }, [templatesQuery.data, categoryFilter])

  const toForm = (t: Template): FormState => ({
    name: t.name,
    category: t.category,
    subject: t.subject,
    body: t.body,
    tags: t.tags.join(', '),
  })

  const fromForm = (f: FormState): CreateTemplateInput => ({
    name: f.name.trim(),
    category: f.category,
    subject: f.subject,
    body: f.body,
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    brand: brand.id !== 'hermes' ? brand.id : undefined,
  })

  const copyBody = (body: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(body)
      toast('Copied to clipboard')
    }
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Copy01Icon}
                size={18}
                className="text-[var(--theme-accent)]"
              />
              <h1 className="text-base font-semibold text-[var(--theme-text)]">
                Templates
              </h1>
              {templatesQuery.data && (
                <span className="ml-1 text-xs text-[var(--theme-muted)]">
                  ({templatesQuery.data.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={invalidate}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                title="Refresh"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  className="text-[var(--theme-muted)]"
                />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-accent)' }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                New Template
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['all', ...TEMPLATE_CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  categoryFilter === c
                    ? 'border-transparent text-white'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-[var(--theme-hover)]',
                )}
                style={
                  categoryFilter === c
                    ? { background: 'var(--theme-accent)' }
                    : undefined
                }
              >
                {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-2">
          {templatesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
              Loading templates…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-muted)]">
              <HugeiconsIcon icon={Copy01Icon} size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No templates yet</p>
              <p className="mt-1 text-xs">
                Create reusable message, email, and content templates.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'var(--theme-bg)',
                            color: 'var(--theme-accent)',
                          }}
                        >
                          {CATEGORY_LABELS[t.category]}
                        </span>
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                          {t.name}
                        </h3>
                      </div>
                      {t.subject && (
                        <p className="text-[11px] text-[var(--theme-muted)]">
                          Subject: {t.subject}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--theme-muted)]">
                        {t.body}
                      </p>
                      {t.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md border border-[var(--theme-border)] px-1.5 py-0.5 text-[9px] text-[var(--theme-muted)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => copyBody(t.body)}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Copy body"
                      >
                        <HugeiconsIcon
                          icon={Copy01Icon}
                          size={14}
                          className="text-[var(--theme-accent)]"
                        />
                      </button>
                      <button
                        onClick={() => setEditing(t)}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Edit"
                      >
                        <HugeiconsIcon
                          icon={PencilEdit02Icon}
                          size={14}
                          className="text-[var(--theme-muted)]"
                        />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`))
                            deleteMutation.mutate(t.id)
                        }}
                        className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
                        title="Delete"
                      >
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          size={14}
                          style={{ color: 'var(--theme-danger)' }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <TemplateDialog
        open={showCreate}
        initial={EMPTY_FORM}
        title="New Template"
        onClose={() => setShowCreate(false)}
        onSubmit={(f) => createMutation.mutate(fromForm(f))}
        isSubmitting={createMutation.isPending}
      />
      <TemplateDialog
        open={editing !== null}
        initial={editing ? toForm(editing) : EMPTY_FORM}
        title="Edit Template"
        onClose={() => setEditing(null)}
        onSubmit={(f) => {
          if (editing)
            updateMutation.mutate({ id: editing.id, updates: fromForm(f) })
        }}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  )
}
```

---

## FILE 6 — create `src/routes/templates.tsx`

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { TemplatesScreen } from '@/screens/templates/templates-screen'

export const Route = createFileRoute('/templates')({
  ssr: false,
  component: function TemplatesRoute() {
    usePageTitle('Templates')
    return <TemplatesScreen />
  },
})
```

---

## EDIT 1 — `src/screens/chat/components/chat-sidebar.tsx`

In the icon import block (the `from '@hugeicons/core-free-icons'` list near the top), the
icon `Copy01Icon` must be present. If it is NOT already imported there, add `Copy01Icon,`
to that import list (alphabetical order is fine, not required).

Then find the `platformNavItems` array. It ends with the `/pages` entry like:

```tsx
    {
      kind: 'link',
      to: '/pages',
      icon: Layout01Icon,
      label: 'Pages',
      active: pathname.startsWith('/pages'),
    },
  ]
```

Insert a new entry immediately BEFORE the closing `]` so it becomes:

```tsx
    {
      kind: 'link',
      to: '/pages',
      icon: Layout01Icon,
      label: 'Pages',
      active: pathname.startsWith('/pages'),
    },
    {
      kind: 'link',
      to: '/templates',
      icon: Copy01Icon,
      label: 'Templates',
      active: pathname.startsWith('/templates'),
    },
  ]
```

---

## EDIT 2 — `src/components/mobile-hamburger-menu.tsx`

1. In the icon import block, ensure `Copy01Icon` is imported from `@hugeicons/core-free-icons`.
   If absent, add `Copy01Icon,` to that list.

2. Find the `MOBILE_HAMBURGER_NAV_ITEMS` array, the `/pages` entry:

```tsx
  {
    id: 'pages',
    label: 'Pages',
    icon: Layout01Icon,
    to: '/pages',
    match: (p: string) => p.startsWith('/pages'),
  },
```

Insert immediately AFTER it:

```tsx
  {
    id: 'templates',
    label: 'Templates',
    icon: Copy01Icon,
    to: '/templates',
    match: (p: string) => p.startsWith('/templates'),
  },
```

3. Find these two lines and add `'templates'` after `'pages'` in BOTH:

```tsx
const SC_HAMBURGER_IDS  = ['chat', 'conversations', 'contacts', 'social', 'campaigns', 'projects', 'pages', 'dashboard', 'terminal', 'jobs', 'memory', 'skills', 'mcp', 'profiles']
const HFM_HAMBURGER_IDS = ['chat', 'conversations', 'contacts', 'social', 'campaigns', 'projects', 'pages', 'dashboard', 'terminal', 'memory', 'skills', 'mcp', 'profiles']
```

become:

```tsx
const SC_HAMBURGER_IDS  = ['chat', 'conversations', 'contacts', 'social', 'campaigns', 'projects', 'pages', 'templates', 'dashboard', 'terminal', 'jobs', 'memory', 'skills', 'mcp', 'profiles']
const HFM_HAMBURGER_IDS = ['chat', 'conversations', 'contacts', 'social', 'campaigns', 'projects', 'pages', 'templates', 'dashboard', 'terminal', 'memory', 'skills', 'mcp', 'profiles']
```

---

## VERIFICATION (required before commit)

Run from the repo root:

```
NODE_OPTIONS="--max-old-space-size=4096" node_modules/.bin/vite build
```

This regenerates the route tree AND compiles everything. It MUST exit 0 and finish with
`✓ built`. If it errors, read the error, fix ONLY that specific file/line, and re-run
(max 5 attempts). Do not change any files other than the 6 created + 2 edited above.

Acceptance criteria:
- `node_modules/.bin/vite build` exits 0.
- `src/routeTree.gen.ts` contains `/templates` and `/api/templates` after the build.
- No files other than those listed in this spec were modified.

---

## COMMIT (only after verification passes)

```
git add -A
git commit -m "feat(spec-001): Templates module (executor build)

Reusable message/email/social/content templates following the established
store→API→client→screen→route→nav pattern. Built by Minimax executor from
specs/spec-001-templates.md.

Co-Authored-By: Minimax (Hermes executor) <noreply@hermes>"
```

Leave the branch `auto/spec-001` as-is (do NOT push, do NOT merge). Then set this file's
`Status:` to `done` and commit that one-line change too.
