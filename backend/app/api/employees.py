from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import EmploymentType
from app.schemas import (
    EmployeeCreate,
    EmployeeFilters,
    EmployeeOut,
    EmployeeUpdate,
    Page,
    SortField,
    SortOrder,
)
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
