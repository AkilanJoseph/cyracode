#!/usr/bin/env python3
"""CI helper for the CyraCode GitHub Actions pipeline.

Non-destructive database verification and optional *fresh-database* bootstrap.

Modes:
  python ci_verify_db.py --mode connect     # connect + SELECT 1 (pre-deploy check)
  python ci_verify_db.py --mode check       # connect + assert all expected tables exist
  python ci_verify_db.py --provision FILE   # apply FILE to a NEW/EMPTY database only

This script NEVER runs DROP/TRUNCATE/DELETE. Provisioning refuses to run when
the target database already contains any of the expected tables, so it cannot
wipe or recreate production data.

Configuration:
  DATABASE_URL  psycopg2-style URL, e.g.
                postgresql+psycopg2://user:pass@host:5432/cyracode?sslmode=require
                (alternatively use standard PG* env vars: PGHOST, PGPORT,
                PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE)

Only the host/database/user are printed - credentials are never logged.
"""

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

# All tables the ORM (backend/app/models/models.py) manages. After the API has
# started once, `create_all` + the additive startup migrations guarantee these.
EXPECTED_TABLES = [
    "Users",
    "CyraCodes",
    "OTPRecords",
    "IdempotencyKeys",
    "AuditLogs",
    "DeliveryRecords",
    "LogisticsAccessLogs",
    "ApiClients",
    "Plans",
    "ClientSubscriptions",
    "Transactions",
    "ClientApiPermissions",
    "ClientAccessLogs",
]


def load_conn_params() -> dict:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        scheme, _, rest = url.partition("://")
        # Normalise sqlalchemy-style URLs (postgresql+psycopg2://) for psycopg2.
        if "+" in scheme:
            url = f"{scheme.split('+', 1)[0]}://{rest}"
        parsed = urlparse(url)
        if not (parsed.hostname and parsed.username):
            raise SystemExit(
                "DATABASE_URL is missing a host and/or user. "
                "Example: postgresql+psycopg2://user:pass@host:5432/db?sslmode=require"
            )
        query = parse_qs(parsed.query)
        return {
            "host": parsed.hostname,
            "port": int(parsed.port or 5432),
            "dbname": unquote((parsed.path or "/").lstrip("/")),
            "user": unquote(parsed.username),
            "password": unquote(parsed.password or ""),
            "sslmode": query.get("sslmode", ["require"])[0],
        }
    # Fall back to libpq-style PG* environment variables.
    return {
        "host": os.environ.get("PGHOST"),
        "port": int(os.environ.get("PGPORT", "5432")),
        "dbname": os.environ.get("PGDATABASE", ""),
        "user": os.environ.get("PGUSER", ""),
        "password": os.environ.get("PGPASSWORD", ""),
        "sslmode": os.environ.get("PGSSLMODE", "require"),
    }


def connect(params: dict):
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 is not installed. Run: python -m pip install psycopg2-binary")
        sys.exit(2)
    try:
        return psycopg2.connect(**params)
    except Exception as exc:  # noqa: BLE001 - surface the driver error, not secrets
        print(
            f"Connection FAILED to {params['host']}@{params['dbname']} "
            f"as {params['user']}: {exc}"
        )
        sys.exit(1)


def existing_tables(conn) -> set:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
        return {row[0] for row in cur.fetchall()}


def check_tables(conn, expected: list) -> None:
    present = existing_tables(conn)
    missing = [t for t in expected if t not in present]
    if missing:
        print(f"FAILURE: missing tables: {', '.join(missing)}")
        sys.exit(1)
    print(f"OK: all {len(expected)} expected tables are present.")


def provision(conn, schema_path: str) -> None:
    present = existing_tables(conn)
    already = [t for t in EXPECTED_TABLES if t in present]
    if already:
        print(
            "REFUSING to provision: the target database already contains "
            f"CyraCode tables: {', '.join(already)}. "
            "Provisioning is only safe against a NEW/EMPTY database."
        )
        sys.exit(1)

    text = Path(schema_path).read_text(encoding="utf-8")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)  # strip block comments
    statements = [s.strip() for s in text.split(";") if s.strip()]

    try:
        with conn.cursor() as cur:
            for stmt in statements:
                cur.execute(stmt)
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print(f"Provision FAILED (transaction rolled back): {exc}")
        sys.exit(1)
    print(
        f"OK: applied {len(statements)} statement(s) from {schema_path} "
        "to an empty database. (The API creates any remaining tables on first start.)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode", choices=["connect", "check"], default="connect",
        help="connect = SELECT 1 only; check = also assert all tables exist",
    )
    parser.add_argument(
        "--provision", metavar="SCHEMA_FILE", default="",
        help="apply a schema file to a NEW/EMPTY database (refuses on existing data)",
    )
    args = parser.parse_args()

    params = load_conn_params()
    conn = connect(params)
    try:
        if args.provision:
            provision(conn, args.provision)
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        print(
            f"Connection OK: {params['host']}:{params['port']}/"
            f"{params['dbname']} (user {params['user']}, sslmode={params['sslmode']})"
        )
        if args.mode == "check":
            check_tables(conn, EXPECTED_TABLES)
    finally:
        conn.close()


if __name__ == "__main__":
    main()