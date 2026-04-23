export const WIZARD_STEPS = [1, 2, 3, 4] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export type WizardSnapshot = {
  zone_name?: string
  profile_id?: string
  location_label?: string
  location_lat?: number
  location_lon?: number
}
