"""Read-only aggregate queries answering "how does the org pay people?".

All aggregation happens in SQL (GROUP BY + window functions) so the work scales with the
database rather than with Python memory; medians use ROW_NUMBER/COUNT windows, which is
portable across SQLite and Postgres.
"""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import ColumnElement, Integer, Select, case, cast, func, literal, select
from sqlalchemy.orm import Session

from app.models import Employee
from app.repositories.employee_repository import salary_usd_expr
from app.schemas import (
    CountryInsight,
    DepartmentInsight,
    DistributionBucket,
    InsightFilters,
    JobTitleInsight,
    Overview,
)
from app.services.currency import COUNTRIES

BUCKET_SIZE_USD = 20_000
BUCKET_COUNT = 13  # 0-20k ... 220-240k, then 240k+


def _round(value: float | Decimal | None) -> int:
    if value is None:
        return 0
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class InsightsService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # -- public API ---------------------------------------------------------

    def overview(self, filters: InsightFilters) -> Overview:
        usd = salary_usd_expr()
        row = self.session.execute(
            self._where(
                select(
                    func.count(),
                    func.count(Employee.country.distinct()),
                    func.count(Employee.department.distinct()),
                    func.sum(usd),
                    func.avg(usd),
                ),
                filters,
            )
        ).one()
        medians = self._medians(usd, group_by=None, filters=filters)
        return Overview(
            headcount=row[0],
            countries=row[1],
            departments=row[2],
            total_payroll_usd=_round(row[3]),
            avg_salary_usd=_round(row[4]),
            median_salary_usd=_round(medians.get(None)),
        )

    def by_country(self, filters: InsightFilters) -> list[CountryInsight]:
        usd = salary_usd_expr()
        rows = self.session.execute(
            self._where(
                select(
                    Employee.country,
                    func.min(Employee.currency),
                    func.count(),
                    func.min(Employee.salary),
                    func.max(Employee.salary),
                    func.avg(Employee.salary),
                    func.avg(usd),
                ),
                filters,
            )
            .group_by(Employee.country)
            .order_by(func.count().desc(), Employee.country)
        ).all()
        local_medians = self._medians(Employee.salary, Employee.country, filters)
        usd_medians = self._medians(usd, Employee.country, filters)
        return [
            CountryInsight(
                country=code,
                country_name=COUNTRIES[code].name if code in COUNTRIES else code,
                currency=currency,
                headcount=count,
                min_salary=lo,
                max_salary=hi,
                avg_salary=_round(avg),
                median_salary=_round(local_medians[code]),
                avg_salary_usd=_round(avg_usd),
                median_salary_usd=_round(usd_medians[code]),
            )
            for code, currency, count, lo, hi, avg, avg_usd in rows
        ]

    def job_titles_in_country(self, country: str, filters: InsightFilters) -> list[JobTitleInsight]:
        country = country.upper()
        scope = Employee.country == country
        rows = self.session.execute(
            self._where(
                select(
                    Employee.job_title,
                    func.min(Employee.currency),
                    func.count(),
                    func.min(Employee.salary),
                    func.max(Employee.salary),
                    func.avg(Employee.salary),
                ),
                filters,
                scope,
            )
            .group_by(Employee.job_title)
            .order_by(func.avg(Employee.salary).desc())
        ).all()
        medians = self._medians(Employee.salary, Employee.job_title, filters, scope)
        return [
            JobTitleInsight(
                job_title=title,
                currency=currency,
                headcount=count,
                min_salary=lo,
                max_salary=hi,
                avg_salary=_round(avg),
                median_salary=_round(medians[title]),
            )
            for title, currency, count, lo, hi, avg in rows
        ]

    def by_department(self, filters: InsightFilters) -> list[DepartmentInsight]:
        usd = salary_usd_expr()
        rows = self.session.execute(
            self._where(
                select(Employee.department, func.count(), func.sum(usd), func.avg(usd)), filters
            )
            .group_by(Employee.department)
            .order_by(func.sum(usd).desc())
        ).all()
        medians = self._medians(usd, Employee.department, filters)
        return [
            DepartmentInsight(
                department=dept,
                headcount=count,
                total_payroll_usd=_round(total),
                avg_salary_usd=_round(avg),
                median_salary_usd=_round(medians[dept]),
            )
            for dept, count, total, avg in rows
        ]

    def distribution(self, filters: InsightFilters) -> list[DistributionBucket]:
        """Headcount per USD salary band; the last band is open-ended."""
        raw_bucket = cast(salary_usd_expr() / BUCKET_SIZE_USD, Integer)  # truncates toward 0
        bucket = case((raw_bucket >= BUCKET_COUNT - 1, BUCKET_COUNT - 1), else_=raw_bucket).label(
            "bucket"
        )
        counts = dict(
            self.session.execute(
                self._where(select(bucket, func.count()), filters).group_by(bucket)
            ).all()
        )
        return [
            DistributionBucket(
                min_usd=i * BUCKET_SIZE_USD,
                max_usd=None if i == BUCKET_COUNT - 1 else (i + 1) * BUCKET_SIZE_USD,
                count=counts.get(i, 0),
            )
            for i in range(BUCKET_COUNT)
        ]

    # -- helpers ------------------------------------------------------------

    @staticmethod
    def _where(query: Select, filters: InsightFilters, *extra: ColumnElement[bool]) -> Select:
        query = query.select_from(Employee)
        if filters.employment_type:
            query = query.where(Employee.employment_type == filters.employment_type)
        for condition in extra:
            query = query.where(condition)
        return query

    def _medians(
        self,
        value: ColumnElement,
        group_by: ColumnElement | None,
        filters: InsightFilters,
        *extra: ColumnElement[bool],
    ) -> dict:
        """Median of `value` per group (key None when ungrouped).

        Rank rows within each group, then average the middle one (odd count) or two (even).
        For n rows the middle ranks are (n+1)//2 and (n+2)//2. Note `//`: SQLAlchemy 2 compiles
        `/` as true division, which would yield 2.5 for n=4 and silently drop a middle row.
        """
        group = group_by if group_by is not None else literal(None)
        partition = {"partition_by": group_by} if group_by is not None else {}
        ranked = self._where(
            select(
                group.label("grp"),
                value.label("v"),
                func.row_number().over(order_by=value, **partition).label("rn"),
                func.count().over(**partition).label("n"),
            ),
            filters,
            *extra,
        ).subquery()
        n = ranked.c.n
        rows = self.session.execute(
            select(ranked.c.grp, func.avg(ranked.c.v))
            .where(ranked.c.rn.in_([(n + 1) // 2, (n + 2) // 2]))
            .group_by(ranked.c.grp)
        ).all()
        return dict(rows)
