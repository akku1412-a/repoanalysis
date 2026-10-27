"""A small, well documented module."""

from .utils import normalize


def calculate(value: int) -> int:
    """Normalize a value and return its bounded result."""
    return max(0, normalize(value))
