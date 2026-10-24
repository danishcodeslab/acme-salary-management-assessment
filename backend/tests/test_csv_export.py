import csv
import io

import pytest

from app.services.csv_export import sanitize_cell


def parse(response) -> list[dict]:
    return list(csv.DictReader(io.StringIO(response.text)))


def test_exports_all_matching_rows_with_header(client, create_employee):
    create_employee(email="a@acme.example", country="US", salary=100_000)
    create_employee(email="b@acme.example", country="IN", salary=8_350_000)

    response = client.get("/api/employees/export.csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    rows = parse(response)
    assert len(rows) == 2
    assert rows[1]["Currency"] == "INR"
    assert rows[1]["Salary (USD)"] == "100000"


def test_export_applies_filters_and_ignores_paging(client, create_employee):
    for i in range(30):
        create_employee(email=f"us{i}@acme.example", country="US")
    create_employee(email="gb@acme.example", country="GB")

    rows = parse(client.get("/api/employees/export.csv", params={"country": "US"}))

    assert len(rows) == 30  # more than one default page
    assert {r["Country"] for r in rows} == {"US"}


def test_export_neutralizes_formula_injection(client, create_employee):
    create_employee(full_name='=HYPERLINK("http://evil")')

    [row] = parse(client.get("/api/employees/export.csv"))

    assert row["Full Name"].startswith("'=")


@pytest.mark.parametrize(
    ("value", "expected"),
    [("=1+1", "'=1+1"), ("+44", "'+44"), ("-3", "'-3"), ("@SUM", "'@SUM"), ("Ada", "Ada"), (5, 5)],
)
def test_sanitize_cell(value, expected):
    assert sanitize_cell(value) == expected
