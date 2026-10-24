from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ConflictError, DomainError, NotFoundError
from app.models import Employee, SalaryChange
from app.repositories.employee_repository import EmployeeRepository
from app.schemas import (
    EmployeeCreate,
    EmployeeFilters,
    EmployeeOut,
    EmployeeUpdate,
    Page,
    SortField,
    SortOrder,
)
from app.services.currency import currency_for, to_usd


def to_out(employee: Employee) -> EmployeeOut:
    return EmployeeOut.model_validate(
        {
            **{c: getattr(employee, c) for c in EmployeeOut.model_fields if c != "salary_usd"},
            "salary_usd": to_usd(employee.salary, employee.currency),
        }
    )


class InvalidChangeError(DomainError):
    status_code = 422


class EmployeeService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = EmployeeRepository(session)

    def list(
        self,
        filters: EmployeeFilters,
        sort: SortField,
        order: SortOrder,
        page: int,
        size: int,
    ) -> Page[EmployeeOut]:
        items, total = self.repo.list(filters, sort, order, offset=(page - 1) * size, limit=size)
        return Page[EmployeeOut](
            items=[to_out(e) for e in items], total=total, page=page, size=size
        )

    def get(self, employee_id: int) -> Employee:
        employee = self.repo.get(employee_id)
        if employee is None:
            raise NotFoundError(f"Employee {employee_id} not found")
        return employee

    def create(self, data: EmployeeCreate) -> Employee:
        self._ensure_email_available(data.email)
        employee = Employee(
            **data.model_dump(),
            currency=currency_for(data.country),
            employee_code="PENDING",  # replaced once the id is known
        )
        self.repo.add(employee)
        employee.employee_code = f"EMP{employee.id:05d}"
        self._commit()
        return employee

    def update(self, employee_id: int, data: EmployeeUpdate) -> Employee:
        employee = self.get(employee_id)
        changes = data.model_dump(
            exclude_unset=True,
            exclude_none=True,
            exclude={"salary_change_reason", "salary_effective_date"},
        )

        if "email" in changes and changes["email"] != employee.email:
            self._ensure_email_available(changes["email"])
        if "country" in changes:
            changes["currency"] = currency_for(changes["country"])
            if changes["currency"] != employee.currency and "salary" not in changes:
                # Otherwise "80,000 GBP" would silently become "80,000 INR".
                raise InvalidChangeError(
                    "Changing country changes the salary currency; provide the new salary too"
                )

        new_salary = changes.get("salary", employee.salary)
        new_currency = changes.get("currency", employee.currency)
        if (new_salary, new_currency) != (employee.salary, employee.currency):
            employee.salary_history.append(
                SalaryChange(
                    old_salary=employee.salary,
                    old_currency=employee.currency,
                    new_salary=new_salary,
                    currency=new_currency,
                    effective_date=data.salary_effective_date or date.today(),
                    reason=data.salary_change_reason or None,
                )
            )

        for field, value in changes.items():
            setattr(employee, field, value)
        self._commit()
        return employee

    def salary_history(self, employee_id: int) -> list[SalaryChange]:
        return list(self.get(employee_id).salary_history)

    def delete(self, employee_id: int) -> None:
        self.repo.delete(self.get(employee_id))
        self._commit()

    def _ensure_email_available(self, email: str) -> None:
        if self.repo.get_by_email(email) is not None:
            raise ConflictError(f"An employee with email {email} already exists")

    def _commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:  # race between the check and the write
            self.session.rollback()
            raise ConflictError("Employee conflicts with an existing record") from exc
