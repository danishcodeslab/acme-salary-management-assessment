from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from app.models import EmploymentType
from app.services.currency import COUNTRIES

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
# Upper bound guards against typos (an extra zero or two); fits every supported currency.
Salary = Annotated[int, Field(gt=0, le=1_000_000_000)]

EARLIEST_HIRE_DATE = date(1950, 1, 1)


def _validate_country(value: str) -> str:
    code = value.strip().upper()
    if code not in COUNTRIES:
        raise ValueError(
            f"Unsupported country '{value}'. Supported: {', '.join(sorted(COUNTRIES))}"
        )
    return code


def _validate_hire_date(value: date) -> date:
    if value < EARLIEST_HIRE_DATE:
        raise ValueError("Hire date is implausibly early")
    return value


class EmployeeCreate(BaseModel):
    full_name: Name
    email: EmailStr
    job_title: Label
    department: Label
    country: str
    salary: Salary
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    hire_date: date

    _country = field_validator("country")(_validate_country)
    _hire_date = field_validator("hire_date")(_validate_hire_date)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.lower()


class EmployeeUpdate(BaseModel):
    """Partial update: only fields that are sent are changed."""

    full_name: Name | None = None
    email: EmailStr | None = None
    job_title: Label | None = None
    department: Label | None = None
    country: str | None = None
    salary: Salary | None = None
    employment_type: EmploymentType | None = None
    hire_date: date | None = None

    _country = field_validator("country")(_validate_country)
    _hire_date = field_validator("hire_date")(_validate_hire_date)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return value.lower()


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str
    full_name: str
    email: str
    job_title: str
    department: str
    country: str
    currency: str
    salary: int
    salary_usd: int
    employment_type: EmploymentType
    hire_date: date
    created_at: datetime
    updated_at: datetime


SortField = Literal[
    "employee_code",
    "full_name",
    "email",
    "job_title",
    "department",
    "country",
    "salary",
    "salary_usd",
    "hire_date",
]
SortOrder = Literal["asc", "desc"]


class EmployeeFilters(BaseModel):
    q: str | None = None
    country: str | None = None
    department: str | None = None
    job_title: str | None = None
    employment_type: EmploymentType | None = None


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    size: int


class CountryOption(BaseModel):
    code: str
    name: str
    currency: str


class FilterOptions(BaseModel):
    countries: list[CountryOption]
    departments: list[str]
    job_titles: list[str]
    employment_types: list[EmploymentType]
