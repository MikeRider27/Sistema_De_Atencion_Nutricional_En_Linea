"""Acceso a PostgreSQL con psycopg 3. Cada helper corre en su propia transacción
(commit al salir, rollback si hay excepción); `transaction()` agrupa varias sentencias."""
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.adapt import Loader
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings


class _NumericAFloat(Loader):
    """numeric -> float, para que las respuestas JSON lleven números y no cadenas."""

    def load(self, data):
        return float(bytes(data))


psycopg.adapters.register_loader("numeric", _NumericAFloat)

_pool: ConnectionPool | None = None


def init_pool() -> None:
    global _pool
    _pool = ConnectionPool(
        get_settings().database_url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row},
        open=False,
    )
    _pool.open(wait=True, timeout=30)


def close_pool() -> None:
    if _pool:
        _pool.close()


def _p() -> ConnectionPool:
    assert _pool is not None, "pool no inicializado"
    return _pool


def fetch_all(sql: str, params: Any = None) -> list[dict]:
    with _p().connection() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(sql: str, params: Any = None) -> dict | None:
    with _p().connection() as conn:
        return conn.execute(sql, params).fetchone()


def execute(sql: str, params: Any = None) -> int:
    with _p().connection() as conn:
        return conn.execute(sql, params).rowcount


@contextmanager
def transaction() -> Iterator[psycopg.Connection]:
    with _p().connection() as conn:
        yield conn


def update_dynamic(table: str, row_id: Any, data: dict, allowed: set[str],
                   extra_where: str = "", returning: str = "*") -> dict | None:
    """UPDATE parcial. Los nombres de columna se validan contra `allowed` (nunca vienen del cliente)."""
    cols = [k for k in data if k in allowed]
    if not cols:
        return fetch_one(f"SELECT {returning} FROM {table} WHERE id = %s", (row_id,))
    sets = ", ".join(f"{c} = %s" for c in cols)
    return fetch_one(
        f"UPDATE {table} SET {sets} WHERE id = %s {extra_where} RETURNING {returning}",
        [data[c] for c in cols] + [row_id],
    )
