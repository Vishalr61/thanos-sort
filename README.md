# Thanos Sort

**The only sorting algorithm balanced, as all things should be.**

When you snap your fingers, half of the elements cease to exist. What remains is "sorted" - because we said so.

**Browser app:** 3D globe, clickable dots (people), gauntlet snap button, random Thanos quotes, and a details panel with dataset/snap stats.

**Live:** [https://vishalr61.github.io/thanos-sort/](https://vishalr61.github.io/thanos-sort/) — open on any device.

## How it works

1. Look at your array.
2. **Snap.** Randomly delete half the elements.
3. Repeat until at most one element remains.
4. That (or nothing) is your "sorted" result.

**Time complexity:** O(log n) snaps, O(n) casualties  
**Space complexity:** O(n/2) — half the universe  
**Stability:** Irrelevant. Nothing is stable in the face of the snap.

## Run locally

The app uses ES modules and must be served (not opened as `file://`).

```bash
cd thanos-sort
npx serve .
```

Then open **http://localhost:3000** in your browser.

- **Drag** to rotate the globe.
- **Click a dot** to see a name.
- **Click the gauntlet** to snap — half the dots disintegrate; a random Thanos quote appears.
- **THANOS SORT ▼** toggles the side panel (dataset size, snap count, array state, complexity).
- **Reset** starts a new universe (new names, 50 dots again).

## Publish (one-time)

**Option A — Deploy from a branch (simplest)**  
1. GitHub → repo **Settings** → **Pages**.  
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.  
3. **Branch**: `main`, **Folder**: `/ (root)` → **Save**.  
4. Wait a minute; the site will be at **https://vishalr61.github.io/thanos-sort/**.

**Option B — GitHub Actions**  
1. Set **Source** to **GitHub Actions** in Settings → Pages.  
2. Each push to `main` will deploy via the workflow (artifact is built from `index.html`, `styles.css`, `js/`, `assets/` only).

## Why?

Because Thanos is inevitable.

## License

MIT. The snap does not care about copyright.
