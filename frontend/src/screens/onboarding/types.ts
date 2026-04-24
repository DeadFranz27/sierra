export const WIZARD_STEPS_WITH_ACCOUNT = [0, 1, 2, 3, 4] as const
export const WIZARD_STEPS_POST_LOGIN = [1, 2, 3, 4] as const
export type WizardStep = 0 | 1 | 2 | 3 | 4

export type WizardSnapshot = {
  zone_name?: string
  profile_id?: string
  location_label?: string
  location_lat?: number
  location_lon?: number
}
