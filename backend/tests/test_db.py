from app.db import _sqlalchemy_url


def test_postgresql_urls_use_the_installed_psycopg_driver():
    assert _sqlalchemy_url("postgres://user:pass@db.example/app") == (
        "postgresql+psycopg://user:pass@db.example/app"
    )
    assert _sqlalchemy_url("postgresql://user:pass@db.example/app") == (
        "postgresql+psycopg://user:pass@db.example/app"
    )
    assert _sqlalchemy_url("postgresql+psycopg://user:pass@db.example/app") == (
        "postgresql+psycopg://user:pass@db.example/app"
    )
