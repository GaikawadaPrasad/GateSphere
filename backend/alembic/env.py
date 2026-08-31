"""Alembic environment — online migrations only, URL and metadata from the app."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base  # noqa: F401  (imports every model)

config = context.config
config.set_main_option("sqlalchemy.url", settings.sqlalchemy_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _compare_server_default(
    _ctx, _inspected_col, metadata_col, _inspected_default, _metadata_default, _rendered
) -> bool | None:
    """Ignore the pre-existing python-`default=` vs DB-`server_default` mismatch.

    Most columns declare a Python-side `default=` (applied by the ORM on INSERT); the early
    migrations *also* wrote an equivalent `server_default` into the DB. Neither is wrong and
    both are useful, but `--autogenerate` would otherwise emit ~140 no-op
    `alter_column(server_default=None)` lines. When the model column declares no
    `server_default`, treat the DB's as intentional and not a diff. A column that *does*
    declare `server_default` is still compared normally.
    """
    if metadata_col.server_default is None:
        return False
    return None  # fall back to Alembic's default comparison


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=_compare_server_default,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise SystemExit("Offline migrations are not supported for GateSphere.")
run_migrations_online()
