"""Tests for Thanos Sort. The universe is random; our tests are not."""

import pytest
from thanos_sort import thanos_sort, thanos_sort_single_snap


def test_empty_array():
    assert thanos_sort([]) == []
    assert thanos_sort_single_snap([]) == []


def test_single_element():
    assert thanos_sort([42]) == [42]
    assert thanos_sort_single_snap([42]) == [42]


def test_thanos_sort_reduces_to_one_or_zero():
    for _ in range(20):  # Run multiple times due to randomness
        data = list(range(10))
        result = thanos_sort(data)
        assert len(result) <= 1


def test_single_snap_removes_roughly_half():
    data = list(range(10))
    result = thanos_sort_single_snap(data)
    assert len(result) == 5  # max(1, 10//2) = 5
    assert all(x in data for x in result)


def test_single_snap_small_array():
    result = thanos_sort_single_snap([1, 2])
    assert len(result) == 1
    assert result[0] in [1, 2]
