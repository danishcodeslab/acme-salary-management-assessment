import pytest
from sqlalchemy import func, select

from app.models import Employee
from app.services.currency import COUNTRIES
from scripts.seed import generate_employees, round_salary, seed


@pytest.fixture(scope="module")
def employees():
    return generate_employees(count=10_000, seed=42)


def test_generates_requested_count(employees):
    assert len(employees) == 10_000


def test_generation_is_deterministic():
    assert generate_employees(count=200, seed=7) == generate_employees(count=200, seed=7)


def test_different_seeds_give_different_data():
    assert generate_employees(count=50, seed=1) != generate_employees(count=50, seed=2)


def test_codes_and_emails_are_unique(employees):
    assert len({e["employee_code"] for e in employees}) == len(employees)
    assert len({e["email"] for e in employees}) == len(employees)


def test_rows_are_valid(employees):
    for e in employees:
        assert e["salary"] > 0
        assert e["country"] in COUNTRIES
        assert e["currency"] == COUNTRIES[e["country"]].currency


def test_covers_every_supported_country(employees):
    assert {e["country"] for e in employees} == set(COUNTRIES)


@pytest.mark.parametrize(
    ("amount", "currency", "expected"),
    [(123_456, "USD", 123_000), (123_500, "USD", 124_000), (8_765_432, "INR", 8_770_000)],
)
def test_round_salary(amount, currency, expected):
    assert round_salary(amount, currency) == expected


def test_seed_inserts_rows_and_respects_if_empty(app):
    engine = app.state.engine

    assert seed(engine, count=300) == 300
    assert seed(engine, count=300, if_empty=True) == 0

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Employee)) == 300


def test_seed_refuses_to_duplicate_without_reset(app):
    seed(app.state.engine, count=10)

    with pytest.raises(SystemExit):
        seed(app.state.engine, count=10)


def test_seed_reset_replaces_existing_rows(app):
    seed(app.state.engine, count=10)

    assert seed(app.state.engine, count=25, reset=True) == 25
    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Employee)) == 25
