/** "1", "true", "on", "yes" (any case) switch a feature flag on; anything else is off. */
export function parseFlag(value: string | undefined): boolean {
  return ['1', 'true', 'on', 'yes'].includes((value ?? '').trim().toLowerCase());
}

/** Panels that wait for server work that is not done yet. Off unless the build turns them on. */
export const features = {
  inventory: parseFlag(import.meta.env.VITE_FEATURE_INVENTORY),
  passives: parseFlag(import.meta.env.VITE_FEATURE_PASSIVES),
};
