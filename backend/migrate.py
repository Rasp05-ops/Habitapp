"""Apply the checked-in idempotent SQL migrations before a production start."""
from pathlib import Path

from sqlalchemy import text

from app.db import engine


def statements(sql: str) -> list[str]:
    cleaned = "\n".join(line for line in sql.splitlines() if not line.strip().startswith("--"))
    return [part.strip() for part in cleaned.split(";") if part.strip()]


def main() -> None:
    migration_dir = Path(__file__).resolve().parent / "migrations"
    files = sorted(migration_dir.glob("*.sql"))
    if not files:
        raise RuntimeError("No database migrations found.")
    with engine.begin() as connection:
        for migration in files:
            for statement in statements(migration.read_text(encoding="utf-8")):
                connection.execute(text(statement))
    print(f"Applied {len(files)} migration file(s).")


if __name__ == "__main__":
    main()
