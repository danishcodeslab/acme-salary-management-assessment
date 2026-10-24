import csv
import io
from collections.abc import Iterable, Iterator

from app.models import Employee
from app.services.currency import to_usd

COLUMNS = [
    ("Employee Code", lambda e: e.employee_code),
    ("Full Name", lambda e: e.full_name),
    ("Email", lambda e: e.email),
    ("Job Title", lambda e: e.job_title),
    ("Department", lambda e: e.department),
    ("Country", lambda e: e.country),
    ("Currency", lambda e: e.currency),
    ("Salary", lambda e: e.salary),
    ("Salary (USD)", lambda e: to_usd(e.salary, e.currency)),
    ("Employment Type", lambda e: e.employment_type),
    ("Hire Date", lambda e: e.hire_date.isoformat()),
]

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_cell(value: object) -> object:
    """Neutralize spreadsheet formula injection (the file is opened in Excel)."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def employees_csv(employees: Iterable[Employee], chunk_size: int = 500) -> Iterator[str]:
    """Yield CSV text in chunks so large exports stream instead of buffering."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([name for name, _ in COLUMNS])
    for i, employee in enumerate(employees, start=1):
        writer.writerow([sanitize_cell(get(employee)) for _, get in COLUMNS])
        if i % chunk_size == 0:
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate()
    yield buffer.getvalue()
