# Thanos Sort

> **Perfectly balanced. As all things should be.**

Snap your fingers. Half the universe disintegrates. The remaining elements are "sorted" — because we said so.

**Live:** [https://vishalr61.github.io/thanos-sort/](https://vishalr61.github.io/thanos-sort/)

A 3D Earth populated by 50 named souls. Click the gauntlet, half disintegrate. Repeat until balanced. Underneath the joke is a real algorithmic-visualization toy that grew its own depth — six Infinity Stones, four real sorting algorithms, seeded URLs, an achievement system, a career dashboard, and a procedural ambient soundscape.

---

## How "Thanos Sort" works

1. Look at your array.
2. **Snap.** Randomly delete half the elements.
3. Repeat until at most one element remains.
4. That (or nothing) is your sorted result.

| Complexity | Value |
|------------|-------|
| Time       | O(log n) snaps, O(n) casualties |
| Space      | O(n/2) — half the universe |
| Stability  | Irrelevant. Nothing is stable in the face of the snap. |

---

## Features

### The snap
- 3D globe rendered with Three.js, dots scattered across real continents
- Disintegrate animation with dust particles, synchronized chip strike + fade in the panel
- Procedural ambient crowd murmur that thins out as the population drops
- Mobile haptic triple-pulse on snap (Android)

### Six Infinity Stones

Each stone changes how the snap works:

| Stone     | Color  | Effect |
|-----------|--------|--------|
| Space     | Blue   | Default — half disappear at random |
| Time      | Green  | Undo the last snap |
| Soul      | Orange | Sacrifice one to make another immortal |
| Mind      | Yellow | Manually mark survivors; gauntlet removes the rest |
| Power     | Purple | Total annihilation |
| Reality   | Red    | Half disappear; fresh identities replace them |

### Real algorithms (for comparison)
- **Bubble Sort** — O(n²)
- **Quick Sort** — O(n log n) avg
- **Merge Sort** — O(n log n)
- **Bogosort** — O((n+1)!), runs only on 5 elements because the math is brutal
- **Race mode** — runs Bubble → Quick → Merge in sequence with a stats card showing the winner. Thanos Sort wins anyway.

### Quality of life
- **Seeded URLs** (`?seed=abc123`) so two people can compare the same starting universe
- **15 achievements** unlockable through play (First Snap, Infinity Saga, Hecatomb, Speed Demon…)
- **Career stats** persisted in `localStorage` — total snaps, total eliminated, fastest sort, mode usage breakdown
- **Custom name import** — paste a list, upload a `.txt`/`.csv`, or randomize from the stock pool
- **Population sparkline** in the panel showing remaining souls per snap
- **Cancellable mid-sort** — click the gauntlet during a sort or hit `Esc`

### Accessibility & UX
- Keyboard shortcuts (`Space`, `R`, `1`–`6`, `I`, `P`, `A`, `K`, `Esc`)
- Focus trap in modals; return-focus on close
- `aria-live` announcements for snap results
- Keyboard-tabbable chips that mirror dot clicks for Mind/Soul selection
- `prefers-reduced-motion` honored throughout
- Mobile bottom-sheet panel with grab handle
- Settings popover: animation speed, sound, motion-reduce, sparkline visibility

### Visual polish
- Procedural starfield (2400 points across two depth layers, parented to the camera so it stays fixed during auto-rotate)
- Animated nebula behind the globe — aurora-like color drift
- Fresnel rim-glow atmosphere shader on the globe silhouette
- Per-stone gauntlet pose + mode-tinted radial glow
- Chip particle explosion on snap
- Animated dot spawn on Reset (easeOutBack stagger)
- End-game cinematic — camera dollies to the survivor, soft chord swells, nebula brightens
- First-visit hero intro + onboarding tour
- OG meta tags for social-share previews

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Snap (or cancel a running sort) |
| `R` | Reset universe (new seed) |
| `1`–`6` | Select stone |
| `A` | Focus algorithm dropdown |
| `I` | Open import names modal |
| `P` | Toggle side panel |
| `K` | Toggle shortcuts cheat-sheet |
| `Esc` | Dismiss overlays / cancel sort |
| `?` (FAB) | Show shortcuts cheat-sheet |

---

## Run locally

### Option A — Vite (recommended for development)

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000` with hot module reload.

```bash
npm run build   # produces /dist
npm test        # runs the Vitest suite
```

### Option B — static server (no build step)

The app is ES modules + importmap, so any static file server works:

```bash
npx serve .
```

The `gh-pages` deploy workflow uses this static approach — see `.github/workflows/deploy-pages.yml`.

---

## Architecture

```
js/
├── app.js          ─ main orchestrator: state, UI wiring, event handlers
├── globe.js        ─ Three.js scene, atmosphere shader, dots, halos, stars
├── data.js         ─ name pool, land coordinates, continent polygons
├── modes.js        ─ six stone modes — pure plan() functions
├── sorts.js        ─ real algorithms as generators
├── chips.js        ─ panel pill rendering + animations
├── bars.js         ─ canvas bar visualizer for sorts
├── sound.js        ─ Web Audio: procedural snap, ambient murmur, tactile cues
├── achievements.js ─ 15 achievement definitions + toast component
├── settings.js     ─ user preferences (localStorage)
├── stats.js        ─ career stats (localStorage)
├── history.js      ─ undo stack for Time Stone
├── rng.js          ─ mulberry32 seedable PRNG
├── counter.js      ─ animated number ticker + SVG sparkline
└── state.js        ─ central state proxy (scaffolded for future migration)
```

## Tech stack

- **Three.js** for the 3D globe and post-processing
- **Vanilla JS** (ES modules) — no framework
- **Vite** for development / optional build
- **Vitest** for testing
- **Web Audio API** for all audio (no external sound files)
- **localStorage** for persistence (achievements, stats, settings, onboarding state)

## Tests

```bash
npm test
```

23 unit tests covering:
- `rng.js` — determinism, range, shuffle
- `sorts.js` — every algorithm produces sorted output, stats correctness
- `modes.js` — every `plan()` returns the right shape for valid and invalid inputs

---

## Why?

Because Thanos is inevitable.

## License

MIT. The snap does not care about copyright.

---

*Built with care. Snap responsibly.*
