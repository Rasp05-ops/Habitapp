"""SQLAlchemy persistence. Production deployments should run migrations before startup."""
from sqlalchemy import Date, Integer, String, Text, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import DATABASE_URL, IS_DEV

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class UserRow(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, default="")
    data: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)

class HabitRow(Base):
    __tablename__ = "habits"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    data: Mapped[str] = mapped_column(Text)

class CheckinRow(Base):
    __tablename__ = "checkins"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    catalog_id: Mapped[str] = mapped_column(String(64))
    day: Mapped[Date] = mapped_column(Date)
    data: Mapped[str] = mapped_column(Text)

class LedgerRow(Base):
    __tablename__ = "points_ledger"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    data: Mapped[str] = mapped_column(Text)

class StateRow(Base):
    __tablename__ = "user_state"
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[str] = mapped_column(Text)

def init_db() -> None:
    # SQLite is explicitly the local/test database. PostgreSQL schema changes belong to Alembic.
    if IS_DEV or DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(engine)


def check_db() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
