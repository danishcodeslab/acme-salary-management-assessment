from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Employee, EmploymentType
from app.repositories.employee_repository import EmployeeRepository
from app.schemas import CountryOption, FilterOptions
from app.services.currency import COUNTRIES

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/filters", response_model=FilterOptions)
def filter_options(db: Session = Depends(get_db)) -> FilterOptions:
    """Values for filter dropdowns and form selects."""
    repo = EmployeeRepository(db)
    return FilterOptions(
        countries=[
            CountryOption(code=c.code, name=c.name, currency=c.currency)
            for c in sorted(COUNTRIES.values(), key=lambda c: c.name)
        ],
        departments=repo.distinct_values(Employee.department),
        job_titles=repo.distinct_values(Employee.job_title),
        employment_types=list(EmploymentType),
    )
