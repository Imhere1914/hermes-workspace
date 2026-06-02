'use client'

import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Briefcase01Icon,
  Chat01Icon,
  Layout01Icon,
  Mail01Icon,
  Share04Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'

/**
 * Unified platform overview (Phase 4) — a row of stat cards aggregating the
 * CRM/comms/marketing modules, shown atop the Dashboard for branded
 * instances. Each card links to its module.
 */

type Overview = {
  contacts: { total: number; unverified: number; customers: number; leads: number }
  conversations: { total: number; open: number; unread: number }
  social: { total: number; scheduled: number; published: number }
  campaigns: { total: number; sent: number; draft: number }
  projects: { total: number; active: number }
  pages: { total: number; published: number }
}

function StatCard({
  to,
  icon,
  label,
  value,
  sub,
}: {
  to: string
  icon: typeof Chat01Icon
  label: string
  value: number
  sub: string
}) {
  return (
    <Link
      to={to}
      className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 transition-colors hover:bg-[var(--theme-hover)]"
    >
      <div className="flex items-center gap-1.5 text-[var(--theme-muted)]">
        <HugeiconsIcon icon={icon} size={14} className="text-[var(--theme-accent)]" />
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold text-[var(--theme-text)]">{value}</span>
      <span className="text-[10px] text-[var(--theme-muted)]">{sub}</span>
    </Link>
  )
}

export function PlatformOverview() {
  const brand = useBrand()
  const isBranded = brand.id === 'sc' || brand.id === 'hfm'

  const query = useQuery({
    queryKey: ['platform', 'overview', brand.id],
    queryFn: async (): Promise<Overview | null> => {
      const res = await fetch(
        `/api/platform-overview${isBranded ? `?brand=${brand.id}` : ''}`,
      )
      if (!res.ok) return null
      const data = (await res.json()) as { overview?: Overview }
      return data.overview ?? null
    },
    enabled: isBranded,
    refetchInterval: 60_000,
  })

  if (!isBranded) return null
  const o = query.data
  if (!o) return null

  const contactsLabel = brand.id === 'hfm' ? 'Patients' : 'Contacts'
  const projectsLabel = brand.id === 'hfm' ? 'Programs' : 'Projects'

  return (
    <div className="mb-4">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)]">
        {brand.id === 'hfm' ? 'Practice' : 'Business'} overview
      </h2>
      <div className="flex flex-wrap gap-2">
        <StatCard
          to="/contacts"
          icon={UserGroupIcon}
          label={contactsLabel}
          value={o.contacts.total}
          sub={`${o.contacts.leads} leads · ${o.contacts.customers} customers`}
        />
        <StatCard
          to="/conversations"
          icon={Chat01Icon}
          label="Inbox"
          value={o.conversations.open}
          sub={`${o.conversations.unread} unread · ${o.conversations.total} total`}
        />
        <StatCard
          to="/social"
          icon={Share04Icon}
          label="Social"
          value={o.social.scheduled}
          sub={`scheduled · ${o.social.published} published`}
        />
        <StatCard
          to="/campaigns"
          icon={Mail01Icon}
          label="Campaigns"
          value={o.campaigns.total}
          sub={`${o.campaigns.sent} sent · ${o.campaigns.draft} draft`}
        />
        <StatCard
          to="/projects"
          icon={Briefcase01Icon}
          label={projectsLabel}
          value={o.projects.active}
          sub={`active · ${o.projects.total} total`}
        />
        <StatCard
          to="/pages"
          icon={Layout01Icon}
          label="Pages"
          value={o.pages.published}
          sub={`published · ${o.pages.total} total`}
        />
      </div>
    </div>
  )
}
