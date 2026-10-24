import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Base
from app.main import create_app


@pytest.fixture
def app(tmp_path):
    settings = Settings(database_url="sqlite:///:memory:", static_dir=tmp_path / "no-frontend")
    application = create_app(settings)
    Base.metadata.create_all(application.state.engine)
    yield application
    application.state.engine.dispose()


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db(app):
    session = app.state.session_factory()
    yield session
    session.close()
