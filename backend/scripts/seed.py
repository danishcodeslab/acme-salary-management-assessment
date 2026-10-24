"""Seed the database with realistic, deterministic employee data.

Usage:
    python -m scripts.seed                 # insert 10,000 employees (fails if data exists)
    python -m scripts.seed --reset         # wipe and re-seed
    python -m scripts.seed --if-empty      # no-op when employees already exist (container start)
"""

import argparse
import random
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import Engine, delete, func, insert, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import make_engine
from app.models import Employee, EmploymentType, SalaryChange
from app.services.currency import COUNTRIES, USD_RATES

DATA_DIR = Path(__file__).parent / "data"
DEFAULT_COUNT = 10_000
DEFAULT_SEED = 42
BATCH_SIZE = 1_000


@dataclass(frozen=True)
class Role:
    department: str
    title: str
    base_usd: int  # typical US annual salary for the role


ROLES: list[Role] = [
    Role("Engineering", "Software Engineer", 115_000),
    Role("Engineering", "Senior Software Engineer", 155_000),
    Role("Engineering", "Engineering Manager", 185_000),
    Role("Engineering", "QA Engineer", 85_000),
    Role("Engineering", "DevOps Engineer", 125_000),
    Role("Product", "Product Manager", 140_000),
    Role("Product", "Product Designer", 110_000),
    Role("Data", "Data Analyst", 85_000),
    Role("Data", "Data Scientist", 135_000),
    Role("Sales", "Sales Development Representative", 60_000),
    Role("Sales", "Account Executive", 95_000),
    Role("Sales", "Sales Manager", 135_000),
    Role("Marketing", "Marketing Specialist", 70_000),
    Role("Marketing", "Marketing Manager", 115_000),
    Role("Finance", "Accountant", 72_000),
    Role("Finance", "Financial Analyst", 88_000),
    Role("Finance", "Finance Manager", 128_000),
    Role("Human Resources", "HR Generalist", 65_000),
    Role("Human Resources", "Recruiter", 72_000),
    Role("Human Resources", "HR Manager", 110_000),
    Role("Customer Support", "Support Specialist", 50_000),
    Role("Customer Support", "Support Team Lead", 70_000),
    Role("Operations", "Operations Analyst", 70_000),
    Role("Operations", "Office Manager", 60_000),
]
# Individual contributors are far more common than managers.
ROLE_WEIGHTS = [3 if "Manager" not in r.title and "Lead" not in r.title else 1 for r in ROLES]

# (share of headcount, pay level relative to the US)
COUNTRY_PROFILE: dict[str, tuple[int, float]] = {
    "US": (28, 1.00),
    "IN": (20, 0.28),
    "GB": (10, 0.75),
    "DE": (8, 0.80),
    "CA": (6, 0.80),
    "FR": (5, 0.70),
    "NL": (4, 0.78),
    "AU": (4, 0.82),
    "SG": (4, 0.80),
    "BR": (4, 0.35),
    "JP": (4, 0.65),
    "AE": (3, 0.75),
}

EMPLOYMENT_TYPES = [EmploymentType.FULL_TIME, EmploymentType.PART_TIME, EmploymentType.CONTRACTOR]
EMPLOYMENT_WEIGHTS = [90, 6, 4]
PART_TIME_FACTOR = 0.6

HIRE_START = date(2012, 1, 1)
HIRE_END = date(2026, 6, 30)


def load_names(filename: str) -> list[str]:
    lines = (DATA_DIR / filename).read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip()]


def round_salary(amount: float, currency: str) -> int:
    """Round to a 'human' figure: nearest 10,000 for high-denomination currencies, else 1,000."""
    step = 10_000 if USD_RATES[currency] >= 50 else 1_000
    return max(step, int(round(amount / step)) * step)


def _email_local_part(first: str, last: str) -> str:
    return f"{first}.{last}".lower().replace(" ", "")


def generate_employees(count: int = DEFAULT_COUNT, seed: int = DEFAULT_SEED) -> list[dict]:
    """Pure function: same (count, seed) always yields the same rows."""
    rng = random.Random(seed)
    first_names = load_names("first_names.txt")
    last_names = load_names("last_names.txt")
    countries = list(COUNTRY_PROFILE)
    country_weights = [COUNTRY_PROFILE[c][0] for c in countries]
    hire_span_days = (HIRE_END - HIRE_START).days
    now = datetime(2026, 7, 1, tzinfo=UTC)  # fixed so output is fully deterministic

    email_counts: dict[str, int] = {}
    rows: list[dict] = []
    for i in range(1, count + 1):
        first, last = rng.choice(first_names), rng.choice(last_names)
        role = rng.choices(ROLES, weights=ROLE_WEIGHTS)[0]
        country = rng.choices(countries, weights=country_weights)[0]
        currency = COUNTRIES[country].currency
        employment_type = rng.choices(EMPLOYMENT_TYPES, weights=EMPLOYMENT_WEIGHTS)[0]

        usd = role.base_usd * COUNTRY_PROFILE[country][1] * rng.uniform(0.82, 1.22)
        if employment_type == EmploymentType.PART_TIME:
            usd *= PART_TIME_FACTOR
        salary = round_salary(usd * float(USD_RATES[currency]), currency)

        local = _email_local_part(first, last)
        email_counts[local] = email_counts.get(local, 0) + 1
        suffix = "" if email_counts[local] == 1 else str(email_counts[local])

        rows.append(
            {
                "employee_code": f"EMP{i:05d}",
                "full_name": f"{first} {last}",
                "email": f"{local}{suffix}@acme.example",
                "job_title": role.title,
                "department": role.department,
                "country": country,
                "currency": currency,
                "salary": salary,
                "employment_type": employment_type.value,
                "hire_date": HIRE_START + timedelta(days=rng.randrange(hire_span_days)),
                "created_at": now,
                "updated_at": now,
            }
        )
    return rows


def seed(
    engine: Engine,
    count: int = DEFAULT_COUNT,
    seed_value: int = DEFAULT_SEED,
    reset: bool = False,
    if_empty: bool = False,
) -> int:
    """Insert generated employees; returns the number of rows inserted."""
    with Session(engine) as session:
        existing = session.scalar(select(func.count()).select_from(Employee)) or 0
        if existing and if_empty:
            return 0
        if existing and not reset:
            raise SystemExit(
                f"Refusing to seed: {existing} employees already exist (use --reset or --if-empty)."
            )
        if reset:
            session.execute(delete(SalaryChange))
            session.execute(delete(Employee))

        rows = generate_employees(count, seed_value)
        for start in range(0, len(rows), BATCH_SIZE):
            session.execute(insert(Employee), rows[start : start + BATCH_SIZE])
        session.commit()
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--reset", action="store_true", help="delete existing data first")
    mode.add_argument("--if-empty", action="store_true", help="skip if data already exists")
    args = parser.parse_args()

    engine = make_engine(get_settings().database_url)
    started = time.perf_counter()
    inserted = seed(engine, args.count, args.seed, reset=args.reset, if_empty=args.if_empty)
    elapsed = time.perf_counter() - started
    if inserted:
        print(f"Seeded {inserted} employees in {elapsed:.2f}s")
    else:
        print("Employees already present; skipping seed.")


if __name__ == "__main__":
    main()
