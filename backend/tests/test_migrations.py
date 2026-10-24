from alembic.config import Config

from alembic import command
from app.config import BACKEND_DIR


def test_migrations_match_models(tmp_path):
    """Upgrading to head yields exactly the schema the ORM models describe."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{tmp_path / 'migrations.db'}")

    command.upgrade(config, "head")
    command.check(config)  # raises if autogenerate would detect any difference
