/**
 * Contacts API client — talks to the workspace's native /api/contacts routes.
 * Auth is same-origin/cookie based (no explicit headers needed), matching the
 * other client libs (jobs-api, etc.).
 */

const API = '/api/contacts'

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

export type Contact = {
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
  fields: Record<string, string>
  last_contacted_at: string | null
  created_at: string
  updated_at: string
}

export type CreateContactInput = {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  stage?: ContactStage
  source?: ContactSource
  tags?: string[]
  notes?: string
  owner?: string | null
}

export type UpdateContactInput = Partial<CreateContactInput>

export const CONTACT_STAGES: ContactStage[] = [
  'lead',
  'contacted',
  'qualified',
  'customer',
  'lost',
]

export const STAGE_LABELS: Record<ContactStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  customer: 'Customer',
  lost: 'Lost',
}

export async function fetchContacts(params?: {
  stage?: string
  source?: string
  search?: string
}): Promise<Contact[]> {
  const qs = new URLSearchParams()
  if (params?.stage) qs.set('stage', params.stage)
  if (params?.source) qs.set('source', params.source)
  if (params?.search) qs.set('search', params.search)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await fetch(`${API}${suffix}`)
  if (!res.ok) throw new Error(`Failed to load contacts (${res.status})`)
  const data = (await res.json()) as { contacts?: Contact[] }
  return Array.isArray(data.contacts) ? data.contacts : []
}

export async function getContact(id: string): Promise<Contact> {
  const res = await fetch(`${API}/${id}`)
  if (!res.ok) throw new Error(`Failed to load contact (${res.status})`)
  const data = (await res.json()) as { contact: Contact }
  return data.contact
}

export async function createContact(
  input: CreateContactInput,
): Promise<Contact> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to create contact (${res.status})`)
  }
  const data = (await res.json()) as { contact: Contact }
  return data.contact
}

export async function updateContact(
  id: string,
  updates: UpdateContactInput,
): Promise<Contact> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || `Failed to update contact (${res.status})`)
  }
  const data = (await res.json()) as { contact: Contact }
  return data.contact
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete contact (${res.status})`)
}
