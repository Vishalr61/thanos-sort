"""
Thanos Sort - The only sorting algorithm balanced, as all things should be.

When you snap your fingers, half of the elements cease to exist.
What remains is... "sorted" (the universe does not care about your definition of order).
"""

import random


def thanos_sort(arr: list) -> list:
    """
    Perfectly balanced. As all things should be.
    
    Randomly eliminates half of the elements. The remaining half is "sorted"
    because we said so. The universe is grateful for your contribution.
    
    Time complexity: O(n) - one snap
    Space complexity: O(n/2) - half the universe
    Stability: Irrelevant. Nothing is stable in the face of the snap.
    """
    if not arr:
        return []
    
    if len(arr) == 1:
        return arr  # This one was spared. Lucky.
    
    # The snap: randomly choose half to survive
    survivors = random.sample(arr, (len(arr) + 1) // 2)
    
    # Recursively snap until only one (or zero) remains - the ultimate "sorted" state
    if len(survivors) > 1:
        return thanos_sort(survivors)
    
    return survivors


def thanos_sort_single_snap(arr: list) -> list:
    """
    One snap only. Half are gone. No recursion.
    Sometimes one snap is all you need.
    """
    if not arr:
        return []
    return random.sample(arr, max(1, len(arr) // 2))


if __name__ == "__main__":
    # Demo: watch the universe balance itself
    data = [5, 2, 8, 1, 9, 3, 7, 4, 6]
    print("Before the snap:", data)
    result = thanos_sort(data.copy())
    print("After the snap (sorted):", result)
    print("\nThe universe is balanced. You're welcome.")
