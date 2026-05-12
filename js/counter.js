/**
 * Animated number ticker. Replaces an element's textContent value over
 * 400ms via rAF easing. If the new value equals the current, no animation.
 * Re-entrant: calling tick(el, n) cancels any running animation on that el.
 */

const inFlight = new WeakMap();

export function tick(el, target, opts = {}) {
  if (!el) return;
  const duration = opts.duration ?? 420;
  const start = Number(el.dataset.counterValue ?? el.textContent.replace(/[^\d-]/g, '') ?? 0) || 0;
  const end = Math.round(target);
  if (start === end) {
    el.textContent = String(end);
    el.dataset.counterValue = String(end);
    return;
  }
  const t0 = performance.now();
  cancelAnimationFrame(inFlight.get(el));
  function step() {
    const t = Math.min(1, (performance.now() - t0) / duration);
    // easeOutCubic — fast then settles
    const eased = 1 - Math.pow(1 - t, 3);
    const cur = Math.round(start + (end - start) * eased);
    el.textContent = String(cur);
    if (t < 1) {
      inFlight.set(el, requestAnimationFrame(step));
    } else {
      el.dataset.counterValue = String(end);
      inFlight.delete(el);
    }
  }
  inFlight.set(el, requestAnimationFrame(step));
}

/**
 * Tiny SVG sparkline: pass a container + array of numbers. Renders a
 * single path that fits the container's clientWidth/height (or 240×40
 * if unset). Smooth curve via simple quadratic Bezier through points.
 */
export function sparkline(container, values, opts = {}) {
  if (!container) return;
  const w = opts.width ?? container.clientWidth ?? 240;
  const h = opts.height ?? 40;
  container.innerHTML = '';
  if (!values || values.length < 2) {
    container.innerHTML = '<svg viewBox="0 0 240 40" class="spark-empty"><text x="120" y="24" text-anchor="middle" fill="#5a5368" font-size="10" font-family="JetBrains Mono">no snaps yet</text></svg>';
    return;
  }
  const max = Math.max(...values, 1);
  const min = 0;
  const n = values.length;
  const stepX = w / Math.max(1, n - 1);
  const pad = 3;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const norm = (v - min) / (max - min || 1);
    const y = h - pad - norm * (h - pad * 2);
    return [x, y];
  });

  // Build the line path (linear segments)
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i][0]} ${points[i][1]}`;
  }

  // Filled area under the line
  const area = `${path} L ${points[n-1][0]} ${h} L ${points[0][0]} ${h} Z`;

  const svg = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#spark-fill)" />
      <path d="${path}" fill="none" stroke="#a78bfa" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${points[n-1][0]}" cy="${points[n-1][1]}" r="2.5" fill="#ec4899" />
    </svg>
  `;
  container.innerHTML = svg;
}
