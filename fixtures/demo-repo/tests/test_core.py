import unittest

from src.core import calculate


class CoreTest(unittest.TestCase):
    def test_calculate(self):
        self.assertEqual(calculate(2), 2)
