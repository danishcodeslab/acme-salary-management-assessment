from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """Timezone-aware UTC datetimes; SQLite drops tzinfo, so re-attach it on read."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(UTC)
        return value

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACTOR = "contractor"


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        CheckConstraint("salary > 0", name="ck_employees_salary_positive"),
        Index("ix_employees_country_job_title", "country", "job_title"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(16), unique=True)
    full_name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    job_title: Mapped[str] = mapped_column(String(80), index=True)
    department: Mapped[str] = mapped_column(String(80), index=True)
    country: Mapped[str] = mapped_column(String(2), index=True)
    # Currency is derived from country but stored, so history stays correct if mappings change.
    currency: Mapped[str] = mapped_column(String(3))
    # Annual gross salary in whole units of `currency` (integers avoid float rounding errors).
    salary: Mapped[int] = mapped_column(Integer, index=True)
    employment_type: Mapped[str] = mapped_column(String(16), default=EmploymentType.FULL_TIME)
    hire_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    salary_history: Mapped[list["SalaryChange"]] = relationship(
        back_populates="employee",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="desc(SalaryChange.id)",
    )


class SalaryChange(Base):
    __tablename__ = "salary_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    old_salary: Mapped[int] = mapped_column(Integer)
    new_salary: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    effective_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    employee: Mapped[Employee] = relationship(back_populates="salary_history")
