/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true"/"1" shows the inventory panel stub. */
  readonly VITE_FEATURE_INVENTORY?: string;
  /** "true"/"1" shows the passive-tree panel stub. */
  readonly VITE_FEATURE_PASSIVES?: string;
}
