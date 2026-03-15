# Thanos Sort

**The only sorting algorithm balanced, as all things should be.**

When you snap your fingers, half of the elements cease to exist. What remains is "sorted"—because we said so.

## How it works

1. Look at your array.
2. **Snap.** Randomly delete half the elements.
3. Repeat until at most one element remains.
4. That (or nothing) is your "sorted" result.

**Time complexity:** O(n) per snap  
**Space complexity:** O(n/2) — half the universe  
**Stability:** Irrelevant. Nothing is stable in the face of the snap.

## Installation

No dependencies. Just Python 3.

```bash
git clone https://github.com/Vishalr61/thanos-sort.git
cd thanos-sort
```

## Usage

```python
from thanos_sort import thanos_sort, thanos_sort_single_snap

# Full Thanos experience: keep snapping until "sorted"
data = [5, 2, 8, 1, 9, 3, 7, 4, 6]
result = thanos_sort(data)  # [7]  (or whatever the universe decides)

# One snap only
survivors = thanos_sort_single_snap(data)  # 4-5 elements remain
```

Run the demo:

```bash
python thanos_sort.py
```

### Visual animation

Open `index.html` in your browser for a visual Thanos Sort: click **SNAP** to watch half the elements disintegrate until the universe is balanced. (Dark theme, purple/gold, optional starfield.)

## Why?

Because it's funny. And because the universe demanded balance.

*"I am inevitable."* — Thanos Sort

## License

MIT. The snap does not care about copyright.
