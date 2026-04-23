/**
 * Plant category icons — sourced from Sierra Design System v1.7.
 * Each SVG uses currentColor-compatible stroke values mapped to brand tokens.
 * Size default: 32px (viewBox 48×48, scaled).
 */
import type { ReactElement } from 'react'

type Props = { size?: number; className?: string }

export function IconLawn({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--fern-500)" strokeWidth="2" fill="none">
        <path d="M6 36 L42 36" />
        <path d="M12 36 L12 26" />
        <path d="M10 30 L12 27" />
        <path d="M14 30 L12 27" />
        <path d="M22 36 L22 22" />
        <path d="M19 27 L22 23" />
        <path d="M25 27 L22 23" />
        <path d="M32 36 L32 25" />
        <path d="M30 29 L32 26" />
        <path d="M34 29 L32 26" />
        <path d="M40 36 L40 30" />
        <path d="M38 33 L40 31" />
        <path d="M42 33 L40 31" />
      </g>
      <ellipse cx="24" cy="38" rx="18" ry="1.2" fill="var(--fern-500)" opacity="0.15" />
    </svg>
  )
}

export function IconVegetables({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--fern-500)" strokeWidth="2" fill="none">
        <path d="M8 26 C 10 16, 18 10, 24 10 C 30 10, 38 16, 40 26" />
        <path d="M8 26 C 12 38, 36 38, 40 26" />
        <path d="M24 10 L 24 36" />
        <path d="M24 14 C 20 16, 17 20, 16 26" />
        <path d="M24 14 C 28 16, 31 20, 32 26" />
        <path d="M24 22 C 21 24, 19 28, 18 32" />
        <path d="M24 22 C 27 24, 29 28, 30 32" />
      </g>
    </svg>
  )
}

export function IconHerbs({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--fern-500)" strokeWidth="2" fill="none">
        <path d="M24 42 C 22 34, 26 26, 24 18 C 22 12, 26 8, 26 6" />
        <path d="M23 36 C 19 35, 16 33, 15 30" />
        <path d="M23 36 C 27 35, 30 33, 31 30" />
        <path d="M25 28 C 21 27, 18 25, 17 22" />
        <path d="M25 28 C 29 27, 32 25, 33 22" />
        <path d="M24 18 C 21 17, 19 15, 19 12" />
        <path d="M24 18 C 27 17, 29 15, 29 12" />
        <path d="M26 8 C 28 6, 30 6, 31 4" />
      </g>
    </svg>
  )
}

export function IconFruitBerry({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--clay-500)" strokeWidth="2" fill="none">
        <circle cx="24" cy="28" r="12" />
        <path d="M18 24 C 20 22, 22 21, 24 21" opacity="0.5" />
        <path d="M24 16 L 24 10" />
        <path d="M24 16 L 20 12" />
        <path d="M24 16 L 28 12" />
        <path d="M24 16 L 24 14" />
        <g stroke="var(--fern-500)">
          <path d="M24 10 C 30 8, 34 10, 34 14" />
          <path d="M24 10 L 32 11.5" />
        </g>
      </g>
    </svg>
  )
}

export function IconFlowers({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--fern-400)" strokeWidth="2" fill="none">
        <path d="M24 42 L 24 24" />
        <path d="M24 32 C 28 32, 31 30, 32 26" />
        <path d="M24 32 C 20 32, 17 30, 16 26" />
      </g>
      <g stroke="#A87B94" strokeWidth="2" fill="none">
        <ellipse cx="24" cy="14" rx="4" ry="6" transform="rotate(0 24 14)" />
        <ellipse cx="24" cy="14" rx="4" ry="6" transform="rotate(72 24 18)" />
        <ellipse cx="24" cy="14" rx="4" ry="6" transform="rotate(144 24 18)" />
        <ellipse cx="24" cy="14" rx="4" ry="6" transform="rotate(216 24 18)" />
        <ellipse cx="24" cy="14" rx="4" ry="6" transform="rotate(288 24 18)" />
        <circle cx="24" cy="18" r="2.5" fill="var(--amber-300)" stroke="none" />
      </g>
    </svg>
  )
}

export function IconTreesShrubs({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--moss-700)" strokeWidth="2" fill="none">
        <path d="M24 42 L 24 30" />
        <path d="M18 42 L 30 42" opacity="0.4" />
        <path d="M14 26 C 10 26, 8 22, 10 18 C 8 14, 12 10, 16 12 C 18 8, 24 6, 28 10 C 32 8, 38 10, 38 16 C 40 20, 38 26, 34 26 C 32 30, 20 30, 18 28 C 16 28, 14 28, 14 26 Z" />
        <path d="M18 18 C 20 16, 22 16, 24 18" opacity="0.5" />
        <path d="M26 20 C 28 18, 30 18, 32 20" opacity="0.5" />
      </g>
    </svg>
  )
}

export function IconSucculents({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--fern-400)" strokeWidth="2" fill="none">
        <path d="M18 42 L 18 18 C 18 14, 22 12, 24 12 C 26 12, 30 14, 30 18 L 30 42" />
        <path d="M30 26 L 34 26 C 36 26, 37 28, 37 30 L 37 34" />
        <path d="M24 14 L 24 40" opacity="0.5" />
        <path d="M21 16 L 21 40" opacity="0.4" />
        <path d="M27 16 L 27 40" opacity="0.4" />
        <path d="M23 11 L 23 9" strokeWidth="1.5" />
        <path d="M25 11 L 25 9" strokeWidth="1.5" />
        <path d="M14 42 L 42 42" stroke="var(--amber-500)" />
      </g>
      <path d="M14 42 L 16 46 L 40 46 L 42 42 Z" fill="var(--amber-100)" stroke="var(--amber-500)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTropical({ size = 32 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--moss-700)" strokeWidth="2" fill="none">
        <path d="M24 38 L 24 24" />
        <path d="M24 32 C 22 28, 18 26, 16 22" />
        <path d="M24 24 C 24 18, 28 12, 36 10 C 38 14, 38 20, 34 24 C 32 26, 28 26, 24 24 Z" />
        <path d="M28 18 L 32 20" opacity="0.6" />
        <path d="M27 22 L 31 23" opacity="0.6" />
        <path d="M16 22 C 12 22, 10 18, 12 14 C 16 12, 20 16, 20 20" opacity="0.9" />
      </g>
      <path d="M16 38 L 14 46 L 34 46 L 32 38 Z" fill="var(--stone-100)" stroke="var(--stone-400)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 38 L 32 38" stroke="var(--stone-400)" strokeWidth="2" />
    </svg>
  )
}

// ── Category icon map ────────────────────────────────────────────────────────

export type PlantCategory =
  | 'Lawn & Ground Cover'
  | 'Vegetables'
  | 'Herbs'
  | 'Fruit & Berry'
  | 'Flowers & Ornamentals'
  | 'Trees & Shrubs'
  | 'Succulents & Cacti'
  | 'Tropical & Indoor'
  | string

const ICON_MAP: Record<string, (props: Props) => ReactElement> = {
  'Lawn & Ground Cover':   IconLawn,
  'Vegetables':            IconVegetables,
  'Herbs':                 IconHerbs,
  'Fruit & Berry':         IconFruitBerry,
  'Flowers & Ornamentals': IconFlowers,
  'Trees & Shrubs':        IconTreesShrubs,
  'Succulents & Cacti':    IconSucculents,
  'Tropical & Indoor':     IconTropical,
}

export function PlantCategoryIcon({ category, size = 32 }: { category: PlantCategory; size?: number }) {
  const Cmp = ICON_MAP[category] ?? IconVegetables
  return <Cmp size={size} />
}
