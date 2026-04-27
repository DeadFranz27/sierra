/**
 * Plant preset icons — sourced from Sierra Design System v1.85.
 * Renders the per-preset illustrative SVG from /public/plants/.
 * Multi-color (moss/fern/clay/amber/stone) — does NOT recolor via currentColor.
 */

const PRESET_TO_FILE: Record<string, string> = {
  turfgrass:            'plant-turfgrass',
  fescue_lawn:          'plant-fescue',
  clover_groundcover:   'plant-clover',
  leafy_vegetables:     'plant-leafy-vegetables',
  fruiting_vegetables:  'plant-fruiting-vegetables',
  root_vegetables:      'plant-root-vegetables',
  brassicas:            'plant-brassicas',
  cucumbers_squash:     'plant-cucumbers-squash',
  herbs_moderate:       'plant-herbs-moderate',
  herbs_dry:            'plant-herbs-dry',
  herbs_potted:         'plant-herbs-potted',
  potted_citrus:        'plant-potted-citrus',
  strawberries:         'plant-strawberries',
  blueberries:          'plant-blueberries',
  grapevines:           'plant-grapevines',
  flowering_perennials: 'plant-flowering-perennials',
  annuals_bedding:      'plant-annuals',
  bulbs:                'plant-bulbs',
  roses:                'plant-roses',
  mediterranean_shrubs: 'plant-mediterranean-shrubs',
  young_trees:          'plant-young-trees',
  established_trees:    'plant-established-trees',
  hedges_formal:        'plant-formal-hedges',
  succulents_cacti:     'plant-succulents-cacti',
  aloe_agave:           'plant-aloe',
  tropical_potted:      'plant-tropical-potted',
  ferns_shade:          'plant-ferns-shade',
}

type Props = {
  presetKey?: string | null
  size?: number
  alt?: string
}

export function PlantPresetIcon({ presetKey, size = 48, alt = '' }: Props) {
  const file = presetKey ? PRESET_TO_FILE[presetKey] : undefined
  if (!file) return null
  return (
    <img
      src={`/plants/${file}.svg`}
      alt={alt}
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
      draggable={false}
    />
  )
}

export function hasPresetIcon(presetKey?: string | null): boolean {
  return !!presetKey && presetKey in PRESET_TO_FILE
}
