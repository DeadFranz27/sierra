import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { PlantProfile } from '../lib/api'
import { Icon } from '../components/Icon'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ProfileForm } from '../components/ProfileForm'
import { toast } from '../components/Toast'
import { PlantCategoryIcon } from '../components/PlantCategoryIcon'

type FormMode = { type: 'create' } | { type: 'fork'; from: PlantProfile } | { type: 'edit'; profile: PlantProfile }

const CATEGORY_ORDER: Record<string, number> = {
  'Lawn & Ground Cover':   0,
  'Vegetables':            1,
  'Herbs':                 2,
  'Fruit & Berry':         3,
  'Flowers & Ornamentals': 4,
  'Trees & Shrubs':        5,
  'Succulents & Cacti':    6,
  'Tropical & Indoor':     7,
}

function sunLabel(pref: string) {
  if (pref === 'full') return 'Full sun'
  if (pref === 'partial') return 'Partial shade'
  return 'Shade'
}

function ProfileCard({ profile, onDelete, onFork, onEdit }: {
  profile: PlantProfile
  onDelete: (id: string) => void
  onFork: (p: PlantProfile) => void
  onEdit: (p: PlantProfile) => void
}) {
  return (
    <div style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--fg)' }}>{profile.name}</div>
            {profile.is_preset && <Badge label="Preset" tone="good" dot={false} />}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{profile.description}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {!profile.is_preset && (
            <button onClick={() => onEdit(profile)} title="Edit" style={iconBtnStyle}>
              <Icon name="edit" size={13} />
            </button>
          )}
          <button onClick={() => onFork(profile)} title="Customise (fork)" style={iconBtnStyle}>
            <Icon name="plus" size={13} />
          </button>
          {!profile.is_preset && (
            <button onClick={() => onDelete(profile.id)} title="Delete" style={{ ...iconBtnStyle, color: 'var(--state-bad)' }}>
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {([['Dry', profile.moisture_dry], ['Target', profile.moisture_target], ['Wet', profile.moisture_wet]] as [string, number][]).map(([label, value]) => (
          <div key={label} style={{ padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--fg-brand)' }}>{value}%</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', flexWrap: 'wrap' }}>
        <span><b style={{ fontWeight: 600 }}>Run:</b> {profile.default_run_min} min</span>
        <span><b style={{ fontWeight: 600 }}>Max:</b> {profile.max_run_min} min</span>
        <span><b style={{ fontWeight: 600 }}>Interval:</b> {profile.min_interval_hours} h</span>
        <span><b style={{ fontWeight: 600 }}>Sun:</b> {sunLabel(profile.sun_preference)}</span>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
  background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export function ProfilesScreen() {
  const [profiles, setProfiles] = useState<PlantProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  async function loadProfiles() {
    const p = await api.profiles.list()
    setProfiles(p)
  }

  useEffect(() => {
    loadProfiles().finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    const p = profiles.find(x => x.id === id)
    if (!confirm(`Delete profile "${p?.name}"?`)) return
    try {
      await api.profiles.delete(id)
      setProfiles(prev => prev.filter(x => x.id !== id))
      toast('Profile deleted', 'good')
    } catch { toast('Could not delete profile', 'bad') }
  }

  async function handleSubmitForm(values: Partial<PlantProfile>) {
    try {
      if (formMode?.type === 'edit') {
        await api.profiles.update(formMode.profile.id, values)
        toast('Profile updated', 'good')
      } else {
        await api.profiles.create({ ...values, is_preset: false })
        toast(formMode?.type === 'fork' ? 'Custom profile created' : 'Profile created', 'good')
      }
      setFormMode(null)
      await loadProfiles()
    } catch (e) {
      toast('Could not save profile: ' + (e as Error).message, 'bad')
      throw e
    }
  }

  function formInitial() {
    if (!formMode) return {}
    if (formMode.type === 'fork') return { ...formMode.from, name: `${formMode.from.name} (custom)`, is_preset: false }
    if (formMode.type === 'edit') return formMode.profile
    return {}
  }

  function formTitle() {
    if (!formMode) return ''
    if (formMode.type === 'fork') return `Customise: ${formMode.from.name}`
    if (formMode.type === 'edit') return `Edit: ${formMode.profile.name}`
    return 'New custom profile'
  }

  const presets = profiles.filter(p => p.is_preset)
  const custom  = profiles.filter(p => !p.is_preset)

  // Derive ordered category list from actual preset data
  const categories = [...new Set(presets.map(p => p.category ?? 'Other'))]
    .sort((a, b) => ((CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)))

  const visiblePresets = activeCategory
    ? presets.filter(p => (p.category ?? 'Other') === activeCategory)
    : presets

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      {formMode && (
        <Modal title={formTitle()} onClose={() => setFormMode(null)} width={580}>
          <ProfileForm
            initial={formInitial()}
            onSubmit={handleSubmitForm}
            onCancel={() => setFormMode(null)}
            submitLabel={formMode.type === 'edit' ? 'Save changes' : 'Create profile'}
          />
        </Modal>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
            {profiles.length} profiles available
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--fg-brand)', margin: 0, letterSpacing: '-0.02em' }}>Plant library</h1>
        </div>
        <button
          onClick={() => setFormMode({ type: 'create' })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--fg-brand)', color: '#fff', border: 'none', borderRadius: 10, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="plus" size={15} /> New profile
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>Loading…</div>}

      {/* Category filter pills */}
      {!loading && categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <button onClick={() => setActiveCategory(null)} style={pillStyle(activeCategory === null)}>
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              style={pillStyle(activeCategory === cat)}
            >
              <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}>
                <PlantCategoryIcon category={cat} size={16} />
              </span>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Preset profiles — grouped by category */}
      {!loading && visiblePresets.length > 0 && (
        activeCategory
          ? (
            <>
              <CategoryHeading category={activeCategory} />
              <div style={grid}>
                {visiblePresets.map(p => (
                  <ProfileCard key={p.id} profile={p} onDelete={handleDelete} onFork={p => setFormMode({ type: 'fork', from: p })} onEdit={p => setFormMode({ type: 'edit', profile: p })} />
                ))}
              </div>
            </>
          )
          : categories.map(cat => {
              const group = visiblePresets.filter(p => (p.category ?? 'Other') === cat)
              if (group.length === 0) return null
              return (
                <div key={cat} style={{ marginBottom: 36 }}>
                  <CategoryHeading category={cat} />
                  <div style={grid}>
                    {group.map(p => (
                      <ProfileCard key={p.id} profile={p} onDelete={handleDelete} onFork={p => setFormMode({ type: 'fork', from: p })} onEdit={p => setFormMode({ type: 'edit', profile: p })} />
                    ))}
                  </div>
                </div>
              )
            })
      )}

      {/* Custom profiles */}
      {!loading && custom.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={sectionLabel}>Your custom profiles</div>
          <div style={grid}>
            {custom.map(p => (
              <ProfileCard key={p.id} profile={p} onDelete={handleDelete} onFork={p => setFormMode({ type: 'fork', from: p })} onEdit={p => setFormMode({ type: 'edit', profile: p })} />
            ))}
          </div>
        </div>
      )}

      {!loading && custom.length === 0 && (
        <div style={{ padding: '8px 0 24px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)' }}>
          No custom profiles yet. Click <b>+</b> on any preset to customise it, or <b>New profile</b> to start from scratch.
        </div>
      )}
    </div>
  )
}

function CategoryHeading({ category }: { category: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--rad-md)',
        background: 'var(--mist-300)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PlantCategoryIcon category={category} size={22} />
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
        letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase',
        color: 'var(--fg-muted)',
      }}>
        {category}
      </span>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
  letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase',
  color: 'var(--fg-muted)', marginBottom: 12,
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 14,
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 'var(--rad-pill)',
    border: `1px solid ${active ? 'var(--moss-700)' : 'var(--border)'}`,
    background: active ? 'var(--moss-700)' : 'transparent',
    color: active ? '#fff' : 'var(--fg-muted)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)',
  }
}
