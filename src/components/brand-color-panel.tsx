/**
 * BrandColorPanel — slide-in color scheme picker for SC and HFM branded instances.
 *
 * Shows preset scheme cards (4 per brand) with color swatches + labels,
 * and a custom color picker section for fine-tuning primary/secondary/background.
 *
 * Usage:
 *   <BrandColorPanel open={open} onClose={() => setOpen(false)} />
 */
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, PaintBoardIcon } from '@hugeicons/core-free-icons'
import { useBrand } from '@/contexts/BrandContext'
import { setTheme, getTheme } from '@/lib/theme'
import type { ThemeId } from '@/lib/theme'

// ── Scheme definitions ─────────────────────────────────────────────────────

type SchemeOption = {
  id: ThemeId
  label: string
  sub: string
  swatches: [string, string, string] // [bg, primary, secondary]
}

const SC_SCHEMES: SchemeOption[] = [
  {
    id: 'sc',
    label: 'Charcoal Forest',
    sub: 'Default',
    swatches: ['#131816', '#5A9B72', '#88C4A4'],
  },
  {
    id: 'sc-deep-canopy',
    label: 'Deep Canopy',
    sub: 'Deeper green',
    swatches: ['#0C1310', '#3F7A56', '#6BB095'],
  },
  {
    id: 'sc-sage-medium',
    label: 'Sage Medium',
    sub: 'Lighter accent',
    swatches: ['#1C2420', '#6DBF8E', '#9ED4B8'],
  },
  {
    id: 'sc-slate-moss',
    label: 'Slate Moss',
    sub: 'Muted balance',
    swatches: ['#161C19', '#4E8B6A', '#7FC4A2'],
  },
]

const HFM_SCHEMES: SchemeOption[] = [
  {
    id: 'hfm',
    label: 'Warm Harvest',
    sub: 'Default',
    swatches: ['#F2EBE0', '#7C8A3F', '#9B6B42'],
  },
  {
    id: 'hfm-forest-grove',
    label: 'Forest Grove',
    sub: 'Deep olive',
    swatches: ['#E8E4D8', '#5E6B2F', '#7A4F2E'],
  },
  {
    id: 'hfm-desert-sand',
    label: 'Desert Sand',
    sub: 'Sandy neutral',
    swatches: ['#F0E8D5', '#9B8A5A', '#8B5E35'],
  },
  {
    id: 'hfm-terracotta',
    label: 'Terracotta',
    sub: 'Fired clay',
    swatches: ['#EDE6DB', '#6B7A3A', '#B8644A'],
  },
]

// ── Custom variable config ─────────────────────────────────────────────────

const CUSTOM_VARS: Array<{ label: string; cssVar: string; fallback: string }> = [
  { label: 'Primary', cssVar: '--theme-accent', fallback: '#5A9B72' },
  { label: 'Secondary', cssVar: '--theme-accent-secondary', fallback: '#88C4A4' },
  { label: 'Background', cssVar: '--theme-bg', fallback: '#131816' },
]

function clearCustomOverrides(): void {
  const root = document.documentElement
  for (const { cssVar } of CUSTOM_VARS) {
    root.style.removeProperty(cssVar)
  }
}

function getComputedHex(cssVar: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim()
  return val.startsWith('#') ? val : fallback
}

function readCurrentPickers(fallbacks?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { cssVar, fallback } of CUSTOM_VARS) {
    out[cssVar] = getComputedHex(cssVar, fallbacks?.[cssVar] ?? fallback)
  }
  return out
}

// ── Component ──────────────────────────────────────────────────────────────

type BrandColorPanelProps = {
  open: boolean
  onClose: () => void
}

export function BrandColorPanel({ open, onClose }: BrandColorPanelProps) {
  const brand = useBrand()
  const isHFM = brand.id === 'hfm'
  const schemes = isHFM ? HFM_SCHEMES : SC_SCHEMES
  const brandLabel = isHFM ? 'HFM Intelligence' : 'SC Intelligence'

  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => getTheme())
  const [customColors, setCustomColors] = useState<Record<string, string>>({})

  // Sync state when panel opens
  useEffect(() => {
    if (!open) return
    const current = getTheme()
    setActiveTheme(current)
    // Build fallback map from current scheme swatches
    const currentScheme = schemes.find((s) => s.id === current) ?? schemes[0]
    const fallbacks: Record<string, string> = {
      '--theme-accent': currentScheme.swatches[1],
      '--theme-accent-secondary': currentScheme.swatches[2],
      '--theme-bg': currentScheme.swatches[0],
    }
    setCustomColors(readCurrentPickers(fallbacks))
  }, [open, schemes])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handlePreset = useCallback(
    (scheme: SchemeOption) => {
      clearCustomOverrides()
      setTheme(scheme.id)
      setActiveTheme(scheme.id)
      // Re-read computed values after theme switch
      const fallbacks: Record<string, string> = {
        '--theme-accent': scheme.swatches[1],
        '--theme-accent-secondary': scheme.swatches[2],
        '--theme-bg': scheme.swatches[0],
      }
      // Small defer so the browser resolves the new CSS variables
      requestAnimationFrame(() => {
        setCustomColors(readCurrentPickers(fallbacks))
      })
    },
    [],
  )

  const handleCustomColor = useCallback((cssVar: string, hex: string) => {
    document.documentElement.style.setProperty(cssVar, hex)
    setCustomColors((prev) => ({ ...prev, [cssVar]: hex }))
  }, [])

  const handleReset = useCallback(() => {
    const current = schemes.find((s) => s.id === activeTheme) ?? schemes[0]
    handlePreset(current)
  }, [schemes, activeTheme, handlePreset])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            key="brand-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.32)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* ── Panel ────────────────────────────────────────────────── */}
          <motion.div
            key="brand-panel"
            role="dialog"
            aria-label="Brand color scheme"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-[296px] shadow-2xl"
            style={{
              background: 'var(--theme-sidebar)',
              borderLeft: '1px solid var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ color: 'var(--theme-accent)' }}>
                  <HugeiconsIcon icon={PaintBoardIcon} size={16} strokeWidth={1.5} />
                </span>
                <div>
                  <div
                    className="text-sm font-semibold leading-tight"
                    style={{ color: 'var(--theme-text)' }}
                  >
                    Color Scheme
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--theme-muted)' }}>
                    {brandLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 transition-opacity hover:opacity-60"
                style={{ color: 'var(--theme-muted)' }}
                aria-label="Close color panel"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.5} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {/* ── Presets ────────────────────────────────────────── */}
              <p
                className="text-[10px] uppercase tracking-widest font-medium px-1 mb-2"
                style={{ color: 'var(--theme-muted)' }}
              >
                Presets
              </p>

              <div className="space-y-1.5">
                {schemes.map((scheme) => {
                  const isActive = activeTheme === scheme.id
                  return (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => handlePreset(scheme)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition-all border"
                      style={{
                        background: isActive
                          ? 'var(--theme-accent-subtle)'
                          : 'var(--theme-card)',
                        borderColor: isActive
                          ? 'var(--theme-accent-border)'
                          : 'var(--theme-border)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className="text-sm font-medium leading-tight truncate"
                            style={{ color: 'var(--theme-text)' }}
                          >
                            {scheme.label}
                          </div>
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: 'var(--theme-muted)' }}
                          >
                            {scheme.sub}
                          </div>
                        </div>
                        {/* Swatches */}
                        <div className="flex items-center gap-1 shrink-0">
                          {scheme.swatches.map((color, i) => (
                            <span
                              key={`${scheme.id}-swatch-${i}`}
                              className="inline-block w-4 h-4 rounded-full"
                              style={{
                                background: color,
                                boxShadow: isHFM
                                  ? 'inset 0 0 0 1px rgba(0,0,0,0.12)'
                                  : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* ── Custom colors ───────────────────────────────────── */}
              <div className="mt-5">
                <p
                  className="text-[10px] uppercase tracking-widest font-medium px-1 mb-2"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  Custom
                </p>

                <div className="space-y-1.5">
                  {CUSTOM_VARS.map(({ label, cssVar }) => {
                    const currentHex = customColors[cssVar] ?? '#888888'
                    return (
                      <div
                        key={cssVar}
                        className="flex items-center justify-between rounded-lg px-3 py-2 border"
                        style={{
                          background: 'var(--theme-card)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <span
                          className="text-sm"
                          style={{ color: 'var(--theme-text)' }}
                        >
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[11px] font-mono tabular-nums"
                            style={{ color: 'var(--theme-muted)' }}
                          >
                            {currentHex}
                          </span>
                          {/* Color swatch + hidden native picker */}
                          <label className="relative cursor-pointer">
                            <span
                              className="inline-block w-7 h-7 rounded-lg"
                              style={{
                                background: currentHex,
                                boxShadow: isHFM
                                  ? 'inset 0 0 0 1.5px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)'
                                  : 'inset 0 0 0 1.5px rgba(255,255,255,0.15), 0 1px 3px rgba(0,0,0,0.25)',
                              }}
                            />
                            <input
                              type="color"
                              value={currentHex}
                              onChange={(e) =>
                                handleCustomColor(cssVar, e.target.value)
                              }
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              aria-label={`Pick ${label} color`}
                            />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-3 w-full text-center text-xs py-2 rounded-lg border transition-opacity hover:opacity-70"
                  style={{
                    color: 'var(--theme-muted)',
                    borderColor: 'var(--theme-border)',
                    background: 'transparent',
                  }}
                >
                  Reset to preset defaults
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
