"""Explicit operator-run migrations; retains the existing additive migration code."""
from .db import database


def main():
    factory = database(initialize=True)
    factory.kw['bind'].dispose()
    print('Database migrations completed; no catalog data imported')


if __name__ == '__main__':
    main()
