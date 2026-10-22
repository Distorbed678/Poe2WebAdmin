/** Dark or light. The choice is saved per browser; without one the system preference decides. */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'poe2admin.theme';

/** The saved choice if it is valid, else the system preference. */
export function resolveTheme(saved: string | null | undefined, prefersLight: boolean): Theme {
  if (saved === 'dark' || saved === 'light') return saved;
  return prefersLight ? 'light' : 'dark';
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function systemPrefersLight(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
  } catch {
    return false;
  }
}

class ThemeStore {
  current = $state<Theme>('dark');
  private chosen = false;

  /** Applies the saved or system theme to the page, and follows the system until the user chooses. */
  init(): void {
    const saved = readSaved();
    this.chosen = saved === 'dark' || saved === 'light';
    this.apply(resolveTheme(saved, systemPrefersLight()));
    try {
      matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!this.chosen) this.apply(e.matches ? 'light' : 'dark');
      });
    } catch {
      /* no matchMedia: the theme stays as it is */
    }
  }

  toggle(): void {
    this.chosen = true;
    const next: Theme = this.current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* the choice lasts until the page closes */
    }
    this.apply(next);
  }

  private apply(t: Theme): void {
    this.current = t;
    document.documentElement.dataset.theme = t;
  }
}

export const theme = new ThemeStore();
