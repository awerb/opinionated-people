"""SQLite helper utilities for the backend service."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Tuple

DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(Path.cwd(), "opinionated.db"))


def get_connection(database_path: str | None = None) -> sqlite3.Connection:
    path = database_path or DATABASE_PATH
    connection = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def connection_scope(connection: sqlite3.Connection | None = None) -> Iterator[Tuple[sqlite3.Connection, bool]]:
    """Yield a connection and indicate whether this scope manages the transaction."""

    if connection is not None:
        yield connection, False
        return

    conn = get_connection()
    try:
        yield conn, True
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
