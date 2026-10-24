from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import EmploymentType
from app.schemas import (
    CountryInsight,
    DepartmentInsight,
    DistributionBucket,
    InsightFilters,
    JobTitleInsight,
    Overview,
)
from app.services.insights_service import InsightsService

router = APIRouter(prefix="/insights", tags=["insights"])


def get_service(db: Session = Depends(get_db)) -> InsightsService:
    return InsightsService(db)


def get_filters(employment_type: EmploymentType | None = None) -> InsightFilters:
    return InsightFilters(employment_type=employment_type)


@router.get("/overview", response_model=Overview)
def overview(
    filters: InsightFilters = Depends(get_filters),
    service: InsightsService = Depends(get_service),
) -> Overview:
    return service.overview(filters)


@router.get("/by-country", response_model=list[CountryInsight])
def by_country(
    filters: InsightFilters = Depends(get_filters),
    service: InsightsService = Depends(get_service),
) -> list[CountryInsight]:
    return service.by_country(filters)


@router.get("/by-country/{country}/job-titles", response_model=list[JobTitleInsight])
def job_titles_in_country(
    country: str,
    filters: InsightFilters = Depends(get_filters),
    service: InsightsService = Depends(get_service),
) -> list[JobTitleInsight]:
    return service.job_titles_in_country(country, filters)


@router.get("/by-department", response_model=list[DepartmentInsight])
def by_department(
    filters: InsightFilters = Depends(get_filters),
    service: InsightsService = Depends(get_service),
) -> list[DepartmentInsight]:
    return service.by_department(filters)


@router.get("/distribution", response_model=list[DistributionBucket])
def distribution(
    filters: InsightFilters = Depends(get_filters),
    service: InsightsService = Depends(get_service),
) -> list[DistributionBucket]:
    return service.distribution(filters)
