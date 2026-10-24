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


def employee_payload(**overrides) -> dict:
    """A valid create payload; override any field per test."""
    payload = {
        "full_name": "Ada Lovelace",
        "email": "ada@acme.example",
        "job_title": "Software Engineer",
        "department": "Engineering",
        "country": "GB",
        "salary": 80_000,
        "employment_type": "full_time",
        "hire_date": "2020-05-01",
    }
    return payload | overrides


@pytest.fixture
def create_employee(client):
    def _create(**overrides) -> dict:
        response = client.post("/api/employees", json=employee_payload(**overrides))
        assert response.status_code == 201, response.text
        return response.json()

    return _create
