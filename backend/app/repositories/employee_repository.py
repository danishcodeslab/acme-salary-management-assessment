from sqlalchemy import ColumnElement, Select, case, func, or_, select
from sqlalchemy.orm import Session

from app.models import Employee
from app.schemas import EmployeeFilters, SortField, SortOrder
from app.services.currency import USD_RATES


def salary_usd_expr() -> ColumnElement[float]:
    """SQL expression converting `employees.salary` to USD with the static rate table."""
    rate = case(
        {currency: float(r) for currency, r in USD_RATES.items()},
        value=Employee.currency,
        else_=None,
    )
    return Employee.salary / rate


class EmployeeRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, employee_id: int) -> Employee | None:
        return self.session.get(Employee, employee_id)

    def get_by_email(self, email: str) -> Employee | None:
        return self.session.scalar(select(Employee).where(Employee.email == email))

    def add(self, employee: Employee) -> Employee:
        self.session.add(employee)
        self.session.flush()
        return employee

    def delete(self, employee: Employee) -> None:
        self.session.delete(employee)

    def list(
        self,
        filters: EmployeeFilters,
        sort: SortField = "employee_code",
        order: SortOrder = "asc",
        offset: int = 0,
        limit: int | None = 25,
    ) -> tuple[list[Employee], int]:
        query = self._filtered(filters)
        total = self.session.scalar(select(func.count()).select_from(query.subquery())) or 0

        sort_column = salary_usd_expr() if sort == "salary_usd" else getattr(Employee, sort)
        direction = sort_column.desc() if order == "desc" else sort_column.asc()
        # Secondary sort on id keeps pagination stable when sort values tie.
        query = query.order_by(direction, Employee.id.asc()).offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return list(self.session.scalars(query)), total

    def distinct_values(self, column) -> list[str]:
        return list(self.session.scalars(select(column).distinct().order_by(column)))

    @staticmethod
    def _filtered(filters: EmployeeFilters) -> Select[tuple[Employee]]:
        query = select(Employee)
        if filters.q and (term := filters.q.strip()):
            pattern = f"%{term}%"
            query = query.where(
                or_(
                    Employee.full_name.ilike(pattern),
                    Employee.email.ilike(pattern),
                    Employee.employee_code.ilike(pattern),
                )
            )
        if filters.country:
            query = query.where(Employee.country == filters.country.upper())
        if filters.department:
            query = query.where(Employee.department == filters.department)
        if filters.job_title:
            query = query.where(Employee.job_title == filters.job_title)
        if filters.employment_type:
            query = query.where(Employee.employment_type == filters.employment_type)
        return query
