from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import EmploymentType
from app.schemas import (
    EmployeeCreate,
    EmployeeFilters,
    EmployeeOut,
    EmployeeUpdate,
    Page,
    SalaryChangeOut,
    SortField,
    SortOrder,
)
from app.services.csv_export import employees_csv
from app.services.employee_service import EmployeeService, to_out

router = APIRouter(prefix="/employees", tags=["employees"])

MAX_PAGE_SIZE = 100


def get_service(db: Session = Depends(get_db)) -> EmployeeService:
    return EmployeeService(db)


def get_filters(
    q: str | None = Query(None, description="Search name, email or employee code"),
    country: str | None = Query(None, description="ISO-3166 alpha-2 country code"),
    department: str | None = None,
    job_title: str | None = None,
    employment_type: EmploymentType | None = None,
) -> EmployeeFilters:
    return EmployeeFilters(
        q=q,
        country=country,
        department=department,
        job_title=job_title,
        employment_type=employment_type,
    )


@router.get("", response_model=Page[EmployeeOut])
def list_employees(
    filters: EmployeeFilters = Depends(get_filters),
    sort: SortField = "employee_code",
    order: SortOrder = "asc",
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
    service: EmployeeService = Depends(get_service),
) -> Page[EmployeeOut]:
    return service.list(filters, sort, order, page, size)


# Declared before "/{employee_id}" so the literal path wins.
@router.get("/export.csv", response_class=StreamingResponse)
def export_employees(
    filters: EmployeeFilters = Depends(get_filters),
    sort: SortField = "employee_code",
    order: SortOrder = "asc",
    service: EmployeeService = Depends(get_service),
) -> StreamingResponse:
    """Download every employee matching the filters (not just one page) as CSV."""
    filename = f"employees-{date.today().isoformat()}.csv"
    return StreamingResponse(
        employees_csv(service.export(filters, sort, order)),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    data: EmployeeCreate, service: EmployeeService = Depends(get_service)
) -> EmployeeOut:
    return to_out(service.create(data))


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, service: EmployeeService = Depends(get_service)) -> EmployeeOut:
    return to_out(service.get(employee_id))


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int, data: EmployeeUpdate, service: EmployeeService = Depends(get_service)
) -> EmployeeOut:
    return to_out(service.update(employee_id, data))


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, service: EmployeeService = Depends(get_service)) -> Response:
    service.delete(employee_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{employee_id}/salary-history", response_model=list[SalaryChangeOut])
def salary_history(
    employee_id: int, service: EmployeeService = Depends(get_service)
) -> list[SalaryChangeOut]:
    """Salary changes for one employee, newest first."""
    return [SalaryChangeOut.model_validate(c) for c in service.salary_history(employee_id)]
