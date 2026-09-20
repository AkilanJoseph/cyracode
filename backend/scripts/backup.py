"""
AC 6.11: Automated MSSQL database backup script.

Requirements:
  • Automated daily backups (schedule via cron / Windows Task Scheduler)
  • Recovery Time Objective (RTO) < 1 hour
  • Multi-region replication note: configure SQL Server Always On AG or
    Azure SQL Geo-Replication at the infrastructure level; this script
    handles the local/primary backup half of the strategy.

Usage:
  python backup.py                 # full backup to default path
  python backup.py --verify        # backup + RESTORE VERIFYONLY
  python backup.py --dest /mnt/backups --retention-days 30

Schedule (Linux/Mac):
  0 2 * * * /usr/bin/python3 /app/scripts/backup.py >> /var/log/cyracode_backup.log 2>&1

Schedule (Windows Task Scheduler):
  Action: python.exe  Arguments: "C:\\...\\scripts\\backup.py"
  Trigger: Daily at 02:00
"""

import argparse
import logging
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Load application settings (DATABASE_URL etc.) from the backend config/.env
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from app.config import settings as app_settings
except Exception:  # pragma: no cover - config is required in normal runs
    app_settings = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("cyracode.backup")

DEFAULT_DEST = Path(os.getenv("BACKUP_DEST", "/var/backups/cyracode"))
DEFAULT_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
# Pull the connection string from the app config (or BACKUP/DATABASE env), never
# hardcode credentials.
DATABASE_URL = os.getenv("DATABASE_URL") or (
    getattr(app_settings, "DATABASE_URL", "") if app_settings else ""
)
if not DATABASE_URL:
    raise SystemExit(
        "DATABASE_URL is not set. Configure backend/.env or export DATABASE_URL "
        "before running the backup script."
    )
if DATABASE_URL.startswith(("sqlite", "sqlite3")):
    raise SystemExit(
        "The backup script only supports SQL Server. Set DATABASE_URL to an "
        "mssql+pyodbc:// connection string in backend/.env."
    )


def _parse_connection(url: str) -> dict:
    """Extract server, database, user, password from a SQLAlchemy MSSQL URL."""
    pattern = r"mssql\+pyodbc://([^:]+):([^@]+)@([^/]+)/([^?]+)"
    m = re.match(pattern, url)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL for MSSQL backup: {url!r}")
    user, password, server, database = m.groups()
    return {"server": server, "database": database, "user": user, "password": password}


def run_backup(dest: Path, verify: bool, retention_days: int) -> None:
    try:
        import pyodbc  # noqa: PLC0415
    except ImportError:
        log.error("pyodbc is not installed. Run: pip install pyodbc")
        sys.exit(1)

    conn_info = _parse_connection(DATABASE_URL)
    dest.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    bak_file = dest / f"cyracode_{timestamp}.bak"

    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={conn_info['server']};"
        f"DATABASE=master;"
        f"UID={conn_info['user']};"
        f"PWD={conn_info['password']};"
    )

    log.info("Starting backup of '%s' → %s", conn_info["database"], bak_file)
    try:
        with pyodbc.connect(conn_str, autocommit=True, timeout=3600) as cn:
            backup_sql = (
                f"BACKUP DATABASE [{conn_info['database']}] "
                f"TO DISK = N'{bak_file}' "
                "WITH COMPRESSION, STATS = 10, CHECKSUM;"
            )
            cn.execute(backup_sql)
            log.info("Backup completed: %s", bak_file)

            if verify:
                verify_sql = (
                    f"RESTORE VERIFYONLY FROM DISK = N'{bak_file}' WITH CHECKSUM;"
                )
                cn.execute(verify_sql)
                log.info("Backup verification passed")

    except Exception as exc:
        log.error("Backup FAILED: %s", exc)
        sys.exit(1)

    _purge_old_backups(dest, retention_days)


def _purge_old_backups(dest: Path, retention_days: int) -> None:
    """Delete .bak files older than retention_days to manage storage."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    purged = 0
    for f in dest.glob("cyracode_*.bak"):
        mtime = datetime.utcfromtimestamp(f.stat().st_mtime)
        if mtime < cutoff:
            f.unlink()
            log.info("Purged old backup: %s", f.name)
            purged += 1
    if purged:
        log.info("Purged %d backup(s) older than %d days", purged, retention_days)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CyraCode MSSQL backup (AC 6.11)")
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    parser.add_argument("--verify", action="store_true", help="Run RESTORE VERIFYONLY after backup")
    parser.add_argument(
        "--retention-days",
        type=int,
        default=DEFAULT_RETENTION_DAYS,
        help="Delete backups older than N days (default 30)",
    )
    args = parser.parse_args()
    run_backup(dest=args.dest, verify=args.verify, retention_days=args.retention_days)
