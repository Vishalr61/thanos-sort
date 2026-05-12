/**
 * Panel chips: a pill per person, animated on snap / sort.
 * The chips container shows the same `people` array the globe shows;
 * snap → mark struck + fade out, sort → swap positions in-place.
 */

let container = null;
let chipById = new Map();
let nextId = 0;
let onChipActivate = null;

export function init(el, opts = {}) {
  container = el;
  onChipActivate = opts.onActivate || null;
}

const VISIBLE_CAP = 60;
let collapsed = true;

export function render(people, opts = {}) {
  if (!container) return;
  container.innerHTML = '';
  chipById = new Map();
  const force = opts.expanded === true;
  const showAll = force || !collapsed;
  const overflow = !showAll && people.length > VISIBLE_CAP;
  const visible = overflow ? people.slice(0, VISIBLE_CAP) : people;

  visible.forEach((p, i) => {
    const id = nextId++;
    p._chipId = id;
    // Use <button> so keyboard users can Tab to chips and activate them
    // with Enter/Space — same semantics as clicking the dot on the globe.
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.chipId = String(id);
    chip.dataset.personIndex = String(i);
    chip.style.setProperty('--i', String(i));
    chip.textContent = p.name;
    chip.setAttribute('aria-label', `${p.name}, person ${i + 1} of ${people.length}`);
    chip.addEventListener('click', () => {
      if (typeof onChipActivate === 'function') onChipActivate(Number(chip.dataset.personIndex), p);
    });
    container.appendChild(chip);
    chipById.set(id, chip);
  });

  // Even the hidden tail still needs _chipId so chips.strike()/markImmortal()
  // can find them later. We just don't render their DOM.
  if (overflow) {
    people.slice(VISIBLE_CAP).forEach((p) => { p._chipId = nextId++; });
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'chip chip-more';
    more.textContent = `+${people.length - VISIBLE_CAP} more`;
    more.addEventListener('click', () => {
      collapsed = false;
      render(people);
    });
    container.appendChild(more);
  } else if (showAll && people.length > VISIBLE_CAP) {
    const less = document.createElement('button');
    less.type = 'button';
    less.className = 'chip chip-more';
    less.textContent = 'Show fewer';
    less.addEventListener('click', () => {
      collapsed = true;
      render(people);
    });
    container.appendChild(less);
  }
}

export function resetCollapse() { collapsed = true; }

export function chipFor(person) {
  return chipById.get(person._chipId);
}

export function strike(people) {
  people.forEach((p) => {
    const chip = chipFor(p);
    if (chip) {
      chip.classList.add('chip-struck');
    }
  });
}

export function removeStruck() {
  return new Promise((resolve) => {
    const struck = container ? container.querySelectorAll('.chip-struck') : [];
    if (!struck.length) return resolve();
    struck.forEach((c) => c.classList.add('chip-gone'));
    setTimeout(() => {
      struck.forEach((c) => c.remove());
      resolve();
    }, 600);
  });
}

export function highlight(indices, kind = 'cmp') {
  if (!container) return;
  const chips = [...container.querySelectorAll('.chip')];
  container.querySelectorAll('.chip-cmp, .chip-swap').forEach((c) => {
    c.classList.remove('chip-cmp', 'chip-swap');
  });
  indices.forEach((i) => {
    const c = chips[i];
    if (c) c.classList.add(kind === 'swap' ? 'chip-swap' : 'chip-cmp');
  });
}

export function clearHighlights() {
  if (!container) return;
  container.querySelectorAll('.chip-cmp, .chip-swap').forEach((c) => {
    c.classList.remove('chip-cmp', 'chip-swap');
  });
}

export function swapAt(i, j) {
  if (!container || i === j) return;
  const chips = [...container.querySelectorAll('.chip')];
  const a = chips[i], b = chips[j];
  if (!a || !b) return;
  // Move b before a, then a where b was. Using a placeholder so we don't
  // re-trigger reflow needlessly.
  const next = b.nextSibling === a ? a.nextSibling : b.nextSibling;
  a.parentNode.insertBefore(b, a);
  if (next) a.parentNode.insertBefore(a, next); else a.parentNode.appendChild(a);
}

export function setAt(i, person) {
  if (!container) return;
  const chips = [...container.querySelectorAll('.chip')];
  const target = chips[i];
  if (!target) return;
  target.textContent = person.name;
  target.dataset.chipId = String(person._chipId);
}

export function markSorted(i) {
  if (!container) return;
  const chips = [...container.querySelectorAll('.chip')];
  const c = chips[i];
  if (c) c.classList.add('chip-sorted');
}

export function reset() {
  if (!container) return;
  container.querySelectorAll('.chip').forEach((c) => {
    c.classList.remove('chip-cmp', 'chip-swap', 'chip-sorted', 'chip-struck', 'chip-gone', 'chip-selected', 'chip-sacrificed', 'chip-immortal');
  });
}

export function markSelected(person, on) {
  const chip = chipFor(person);
  if (chip) chip.classList.toggle('chip-selected', !!on);
}

export function markImmortal(person) {
  const chip = chipFor(person);
  if (chip) chip.classList.add('chip-immortal');
}

export function markSacrificed(person) {
  const chip = chipFor(person);
  if (chip) chip.classList.add('chip-sacrificed');
}
