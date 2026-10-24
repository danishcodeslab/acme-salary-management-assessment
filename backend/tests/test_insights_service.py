import statistics
from collections import defaultdict
from datetime import date

import pytest
from sqlalchemy import insert

from app.models import Employee
from app.schemas import InsightFilters
from app.services.currency import COUNTRIES, to_usd
from app.services.insights_service import BUCKET_COUNT, InsightsService
from scripts.seed import generate_employees

ALL = InsightFilters()
_counter = iter(range(1, 1_000_000))


def add(db, *, salary, country="US", department="Engineering", job_title="Engineer",
        employment_type="full_time") -> None:  # fmt: skip
    n = next(_counter)
    db.add(
        Employee(
            employee_code=f"T{n:05d}",
            full_name=f"Person {n}",
            email=f"p{n}@acme.example",
            job_title=job_title,
            department=department,
            country=country,
            currency=COUNTRIES[country].currency,
            salary=salary,
            employment_type=employment_type,
            hire_date=date(2020, 1, 1),
        )
    )
    db.flush()


@pytest.fixture
def service(db):
    return InsightsService(db)


class TestEmptyOrg:
    def test_overview_is_all_zero(self, service):
        overview = service.overview(ALL)

        assert overview.headcount == 0
        assert overview.total_payroll_usd == 0
        assert overview.median_salary_usd == 0

    def test_group_queries_return_empty_lists(self, service):
        assert service.by_country(ALL) == []
        assert service.by_department(ALL) == []
        assert service.job_titles_in_country("US", ALL) == []

    def test_distribution_still_lists_every_band(self, service):
        buckets = service.distribution(ALL)

        assert len(buckets) == BUCKET_COUNT
        assert all(b.count == 0 for b in buckets)


class TestByCountry:
    def test_odd_count_median_is_middle_value(self, db, service):
        for salary in (50_000, 10_000, 30_000):
            add(db, salary=salary)

        [us] = service.by_country(ALL)

        assert (us.min_salary, us.max_salary, us.avg_salary, us.median_salary) == (
            10_000, 50_000, 30_000, 30_000,
        )  # fmt: skip

    def test_even_count_median_averages_middle_pair(self, db, service):
        for salary in (10_000, 20_000, 40_000, 100_000):
            add(db, salary=salary)

        [us] = service.by_country(ALL)

        assert us.median_salary == 30_000
        assert us.avg_salary == 42_500

    def test_stats_are_per_country_in_local_currency_with_usd_comparison(self, db, service):
        add(db, salary=100_000, country="US")
        add(db, salary=8_350_000, country="IN")
        add(db, salary=8_350_000, country="IN")

        result = {c.country: c for c in service.by_country(ALL)}

        assert result["IN"].currency == "INR"
        assert result["IN"].median_salary == 8_350_000
        assert result["IN"].median_salary_usd == 100_000
        assert result["IN"].country_name == "India"
        assert [c.country for c in service.by_country(ALL)] == ["IN", "US"]  # by headcount


class TestJobTitles:
    def test_scoped_to_country_and_sorted_by_average_pay(self, db, service):
        add(db, salary=200_000, job_title="Manager", country="US")
        add(db, salary=100_000, job_title="Engineer", country="US")
        add(db, salary=120_000, job_title="Engineer", country="US")
        add(db, salary=999_999, job_title="Engineer", country="GB")

        titles = service.job_titles_in_country("us", ALL)

        assert [t.job_title for t in titles] == ["Manager", "Engineer"]
        engineer = titles[1]
        assert (engineer.headcount, engineer.min_salary, engineer.max_salary) == (
            2,
            100_000,
            120_000,
        )
        assert engineer.median_salary == 110_000


class TestByDepartmentAndOverview:
    def test_department_totals_are_normalized_to_usd(self, db, service):
        add(db, salary=100_000, country="US", department="Sales")
        add(db, salary=92_000, country="DE", department="Sales")  # = 100,000 USD
        add(db, salary=50_000, country="US", department="Support")

        result = {d.department: d for d in service.by_department(ALL)}

        assert result["Sales"].total_payroll_usd == 200_000
        assert result["Sales"].avg_salary_usd == 100_000
        assert result["Support"].headcount == 1
        assert [d.department for d in service.by_department(ALL)] == ["Sales", "Support"]

    def test_overview_counts_and_usd_figures(self, db, service):
        add(db, salary=100_000, country="US", department="Sales")
        add(db, salary=79_000, country="GB", department="Eng")  # = 100,000 USD
        add(db, salary=40_000, country="US", department="Eng")

        overview = service.overview(ALL)

        assert (overview.headcount, overview.countries, overview.departments) == (3, 2, 2)
        assert overview.total_payroll_usd == 240_000
        assert overview.avg_salary_usd == 80_000
        assert overview.median_salary_usd == 100_000

    def test_employment_type_filter_applies_everywhere(self, db, service):
        add(db, salary=100_000, employment_type="full_time")
        add(db, salary=30_000, employment_type="part_time")

        full_time = InsightFilters(employment_type="full_time")

        assert service.overview(full_time).headcount == 1
        assert service.by_country(full_time)[0].min_salary == 100_000
        assert service.by_department(full_time)[0].headcount == 1
        assert sum(b.count for b in service.distribution(full_time)) == 1


class TestDistribution:
    def test_band_boundaries_and_open_top_band(self, db, service):
        add(db, salary=19_999)  # band 0
        add(db, salary=20_000)  # band 1 (lower bound inclusive)
        add(db, salary=5_000_000)  # top, open-ended band

        buckets = service.distribution(ALL)

        assert (buckets[0].count, buckets[1].count, buckets[-1].count) == (1, 1, 1)
        assert buckets[1].min_usd == 20_000 and buckets[1].max_usd == 40_000
        assert buckets[-1].max_usd is None


def test_sql_medians_match_python_on_generated_data(db, service):
    """Cross-check the window-function median against statistics.median."""
    rows = generate_employees(count=500, seed=3)
    db.execute(insert(Employee), rows)

    by_country = defaultdict(list)
    for row in rows:
        by_country[row["country"]].append(row["salary"])

    for insight in service.by_country(ALL):
        expected = statistics.median(by_country[insight.country])
        assert insight.median_salary == pytest.approx(expected, abs=0.5)

    expected_org = statistics.median(to_usd(r["salary"], r["currency"]) for r in rows)
    assert service.overview(ALL).median_salary_usd == pytest.approx(expected_org, abs=1)
