import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Contacts store — the CRM backbone for the Hermes OS platform (Phase 4).
 *
 * File-backed JSON store, mirroring the conventions in `tasks-store.ts`.
 * This is intentionally a thin, swappable persistence layer: when the
 * dedicated platform host + Postgres come online, only the read/write
 * helpers in this file change — the exported API stays identical.
 */

export type ContactStage =
  | 'lead'
  | 'contacted'
  | 'qualified'
  | 'customer'
  | 'lost'

export type ContactSource =
  | 'webchat'
  | 'manual'
  | 'import'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'social'
  | 'phone'

export type ContactRecord = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  stage: ContactStage
  source: ContactSource
  tags: string[]
  notes: string
  owner: string | null
  /** Free-form per-brand custom fields. */
  fields: Record<string, string>
  last_contacted_at: string | null
  created_at: string
  updated_at: string
}

type ContactFile = { contacts: ContactRecord[] }

type ContactFilters = {
  stage?: string | null
  source?: string | null
  owner?: string | null
  search?: string | null
}

type CreateContactInput = Partial<ContactRecord> & { name: string }
type UpdateContactInput = Partial<Omit<ContactRecord, 'id' | 'created_at'>>

const CLAUDE_HOME =
  process.env.HERMES_HOME ??
  process.env.CLAUDE_HOME ??
  path.join(os.homedir(), '.hermes')
const CONTACTS_FILE = path.join(CLAUDE_HOME, 'contacts.json')

const STAGES: ContactStage[] = [
  'lead',
  'contacted',
  'qualified',
  'customer',
  'lost',
]
const SOURCES: ContactSource[] = [
  'webchat',
  'manual',
  'import',
  'email',
  'sms',
  'whatsapp',
  'social',
  'phone',
]

export function isContactStage(value: unknown): value is ContactStage {
  return typeof value === 'string' && STAGES.includes(value as ContactStage)
}

export function isContactSource(value: unknown): value is ContactSource {
  return typeof value === 'string' && SOURCES.includes(value as ContactSource)
}

function ensureFile(): void {
  fs.mkdirSync(CLAUDE_HOME, { recursive: true })
  if (!fs.existsSync(CONTACTS_FILE)) {
    fs.writeFileSync(
      CONTACTS_FILE,
      JSON.stringify({ contacts: [] }, null, 2) + '\n',
      'utf-8',
    )
  }
}

function readFile(): ContactFile {
  ensureFile()
  try {
    const raw = fs.readFileSync(CONTACTS_FILE, 'utf-8').trim()
    if (!raw) return { contacts: [] }
    const parsed = JSON.parse(raw) as Partial<ContactFile>
    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    }
  } catch {
    return { contacts: [] }
  }
}

function writeFile(data: ContactFile): void {
  ensureFile()
  fs.writeFileSync(
    CONTACTS_FILE,
    JSON.stringify(data, null, 2) + '\n',
    'utf-8',
  )
}

function normalize(
  c: Partial<ContactRecord> &
    Pick<ContactRecord, 'id' | 'name' | 'created_at' | 'updated_at'>,
): ContactRecord {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
    stage: isContactStage(c.stage) ? c.stage : 'lead',
    source: isContactSource(c.source) ? c.source : 'manual',
    tags: Array.isArray(c.tags)
      ? c.tags.filter((t): t is string => typeof t === 'string')
      : [],
    notes: typeof c.notes === 'string' ? c.notes : '',
    owner: c.owner ?? null,
    fields:
      c.fields && typeof c.fields === 'object'
        ? Object.fromEntries(
            Object.entries(c.fields).filter(
              ([, v]) => typeof v === 'string',
            ) as Array<[string, string]>,
          )
        : {},
    last_contacted_at: c.last_contacted_at ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

export function listContacts(filters: ContactFilters = {}): ContactRecord[] {
  let contacts = readFile().contacts.map(normalize)
  if (filters.stage) {
    contacts = contacts.filter((c) => c.stage === filters.stage)
  }
  if (filters.source) {
    contacts = contacts.filter((c) => c.source === filters.source)
  }
  if (filters.owner) {
    contacts = contacts.filter((c) => c.owner === filters.owner)
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    contacts = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  return contacts.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getContact(id: string): ContactRecord | null {
  return readFile().contacts.map(normalize).find((c) => c.id === id) ?? null
}

/** Find an existing contact by email or phone (used by channel ingest to dedupe). */
export function findContactByHandle(
  handle: { email?: string | null; phone?: string | null },
): ContactRecord | null {
  const all = readFile().contacts.map(normalize)
  const email = handle.email?.toLowerCase().trim()
  const phone = handle.phone?.replace(/[^\d+]/g, '')
  return (
    all.find((c) => {
      if (email && c.email && c.email.toLowerCase() === email) return true
      if (phone && c.phone && c.phone.replace(/[^\d+]/g, '') === phone)
        return true
      return false
    }) ?? null
  )
}

export function createContact(input: CreateContactInput): ContactRecord {
  const file = readFile()
  const now = new Date().toISOString()
  const contact = normalize({
    id: typeof input.id === 'string' && input.id ? input.id : randomUUID(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    stage: input.stage,
    source: input.source,
    tags: input.tags,
    notes: input.notes,
    owner: input.owner,
    fields: input.fields,
    last_contacted_at: input.last_contacted_at ?? null,
    created_at: now,
    updated_at: now,
  })
  file.contacts.push(contact)
  writeFile({ contacts: file.contacts.map(normalize) })
  return contact
}

export function updateContact(
  id: string,
  updates: UpdateContactInput,
): ContactRecord | null {
  const file = readFile()
  const index = file.contacts.findIndex((c) => c.id === id)
  if (index === -1) return null
  const current = normalize(file.contacts[index] as ContactRecord)
  const next = normalize({
    ...current,
    ...updates,
    id: current.id,
    created_at: current.created_at,
    updated_at: new Date().toISOString(),
    name: typeof updates.name === 'string' ? updates.name : current.name,
  })
  file.contacts[index] = next
  writeFile({ contacts: file.contacts.map(normalize) })
  return next
}

export function deleteContact(id: string): boolean {
  const file = readFile()
  const next = file.contacts.filter((c) => c.id !== id)
  if (next.length === file.contacts.length) return false
  writeFile({ contacts: next.map((c) => normalize(c as ContactRecord)) })
  return true
}

/**
 * Upsert a contact by email/phone handle — used by inbound channel adapters
 * (web chat, SMS, etc.) so every inbound message is tied to exactly one contact.
 */
export function upsertContactByHandle(
  input: CreateContactInput,
): ContactRecord {
  const existing = findContactByHandle({
    email: input.email ?? null,
    phone: input.phone ?? null,
  })
  if (existing) {
    return (
      updateContact(existing.id, {
        // only fill gaps; never clobber a known name/company with blanks
        name: existing.name || input.name,
        email: existing.email ?? input.email ?? null,
        phone: existing.phone ?? input.phone ?? null,
        company: existing.company ?? input.company ?? null,
        last_contacted_at: new Date().toISOString(),
      }) ?? existing
    )
  }
  return createContact({ ...input, last_contacted_at: new Date().toISOString() })
}

export const CONTACT_STAGES = STAGES
export const CONTACT_SOURCES = SOURCES
