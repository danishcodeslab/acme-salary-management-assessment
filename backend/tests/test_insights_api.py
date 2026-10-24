import pytest


@pytest.fixture
def org(create_employee):
    create_employee(email="a@acme.example", country="US", salary=100_000, department="Sales")
    create_employee(
        email="b@acme.example", country="US", salary=60_000, employment_type="part_time"
    )
    create_employee(email="c@acme.example", country="IN", salary=4_175_000)  # = 50,000 USD


@pytest.mark.parametrize(
    "path",
    ["overview", "by-country", "by-department", "distribution", "by-country/US/job-titles"],
)
def test_insight_endpoints_respond(client, org, path):
    assert client.get(f"/api/insights/{path}").status_code == 200


def test_overview_reflects_org(client, org):
    body = client.get("/api/insights/overview").json()

    assert body["headcount"] == 3
    assert body["countries"] == 2
    assert body["total_payroll_usd"] == 210_000
    assert body["median_salary_usd"] == 60_000


def test_employment_type_query_param_filters(client, org):
    body = client.get("/api/insights/overview", params={"employment_type": "full_time"}).json()

    assert body["headcount"] == 2


def test_invalid_employment_type_is_rejected(client):
    response = client.get("/api/insights/overview", params={"employment_type": "intern"})

    assert response.status_code == 422
