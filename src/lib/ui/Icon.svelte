<script lang="ts" module>
  /** Stroke icons on a 24 px grid, the launcher's set plus the few the admin needs (no icon font, no dependency). */
  const paths = {
    dashboard: ['M4 5.5A1.5 1.5 0 015.5 4h4A1.5 1.5 0 0111 5.5v4A1.5 1.5 0 019.5 11h-4A1.5 1.5 0 014 9.5v-4z', 'M13 5.5A1.5 1.5 0 0114.5 4h4A1.5 1.5 0 0120 5.5v2A1.5 1.5 0 0118.5 9h-4A1.5 1.5 0 0113 7.5v-2z', 'M13 12.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-6z', 'M4 14.5A1.5 1.5 0 015.5 13h4a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 019.5 20h-4A1.5 1.5 0 014 18.5v-4z'],
    logs: ['M4 6.5l4 3.5-4 3.5', 'M11 15.5h9', 'M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z'],
    players: ['M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M2.5 20c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5', 'M16 4.3a3.5 3.5 0 010 6.4', 'M18.5 14.8c1.9.6 3 2.2 3 4.7'],
    instances: ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z', 'M4 7.5l8 4.5 8-4.5M12 12v9'],
    accounts: ['M14.5 9.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z', 'M13 13l7 7M17 17l2-2M15 19l2-2'],
    characters: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6'],
    inventory: ['M6 8h12l1 12H5L6 8z', 'M9 8V6.5a3 3 0 016 0V8'],
    passives: ['M12 4.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z', 'M5.5 15.4a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z', 'M18.5 15.4a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6z', 'M11.2 7.9L6.4 15.6M12.8 7.9l4.8 7.7M7.3 17.2h9.4'],
    announce: ['M4 10v4a1 1 0 001 1h2.5l6.5 4V5L7.5 9H5a1 1 0 00-1 1z', 'M17.5 9.5a4 4 0 010 5', 'M19.8 7.2a7.2 7.2 0 010 9.6'],
    power: ['M12 3v8', 'M6.6 6.6a8 8 0 1010.8 0'],
    restart: ['M20 11a8 8 0 10-2.4 5.7', 'M20 4v7h-7'],
    stop: ['M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z'],
    info: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 11v5M12 8h.01'],
    close: ['M6 6l12 12M18 6L6 18'],
    check: ['M5 12.5l4.5 4.5L19 7'],
    alert: ['M12 3.5l9.5 16.5h-19L12 3.5z', 'M12 10v4.5M12 17.5h.01'],
    shield: ['M12 3l8 3v6c0 4.8-3.3 8-8 9-4.7-1-8-4.2-8-9V6l8-3z', 'M9 12l2.2 2.2L15.5 10'],
    refresh: ['M20 11a8 8 0 10-2.4 5.7', 'M20 4v7h-7'],
    logout: ['M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3', 'M16 8l4 4-4 4M20 12H9'],
    trash: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12', 'M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2'],
    plus: ['M12 5v14M5 12h14'],
    search: ['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M20 20l-4-4'],
    sun: ['M12 16a4 4 0 100-8 4 4 0 000 8z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4'],
    moon: ['M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z'],
    clock: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 7v5l3 2'],
    pause: ['M8 5v14M16 5v14'],
    play: ['M8 5.5v13l11-6.5-11-6.5z'],
    mute: ['M4 10v4a1 1 0 001 1h2.5l4.5 3.5v-13L7.5 9H5a1 1 0 00-1 1z', 'M16 9.5l5 5M21 9.5l-5 5'],
    transfer: ['M4 8h13', 'M13.5 4.5L17 8l-3.5 3.5', 'M20 16H7', 'M10.5 12.5L7 16l3.5 3.5'],
    kick: ['M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3', 'M16 8l4 4-4 4M20 12H9'],
    wifi: ['M5 12.5a10 10 0 0114 0', 'M8 15.5a6 6 0 018 0', 'M12 19h.01'],
    server: ['M5 4h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', 'M5 13h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z', 'M7 7.5h.01M7 16.5h.01'],
  } as const;
  export type IconName = keyof typeof paths;
</script>

<script lang="ts">
  let { name, size = 18, class: cls = '' }: { name: IconName; size?: number; class?: string } = $props();
</script>

<svg
  class="icon {cls}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#each paths[name] as d (d)}<path {d} />{/each}
</svg>

<style>
  .icon { flex: none; display: block; }
</style>
