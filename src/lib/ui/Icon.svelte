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
    settings: ['M4 7h9M17 7h3', 'M15 5a2 2 0 100 4 2 2 0 000-4z', 'M4 12h3M11 12h9', 'M9 10a2 2 0 100 4 2 2 0 000-4z', 'M4 17h11M19 17h1', 'M17 15a2 2 0 100 4 2 2 0 000-4z'],
    calendar: ['M6 5h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z', 'M4 10h16', 'M8 3v4M16 3v4'],
    ban: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M5.6 5.6l12.8 12.8'],
    edit: ['M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z', 'M14 7l3 3'],
    history: ['M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
    activity: ['M3 12h4l3-8 4 16 3-8h4'],
    mods: ['M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z', 'M9 10.5l3 1.7 3-1.7M12 12.2V16'],
    undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 010 12h-3'],
    save: ['M5 4h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z', 'M8 4v5h7V4', 'M8 20v-6h8v6'],
    server: ['M5 4h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z', 'M5 13h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z', 'M7 7.5h.01M7 16.5h.01'],
    chevron: ['M6 9l6 6 6-6'],
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
