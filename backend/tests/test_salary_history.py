from datetime import date


def history(client, employee_id: int) -> list[dict]:
    response = client.get(f"/api/employees/{employee_id}/salary-history")
    assert response.status_code == 200
    return response.json()


def test_new_employee_has_no_history(client, create_employee):
    assert history(client, create_employee()["id"]) == []


def test_salary_change_is_recorded_with_reason_and_date(client, create_employee):
    emp = create_employee(salary=80_000, country="GB")

    client.patch(
        f"/api/employees/{emp['id']}",
        json={
            "salary": 88_000,
            "salary_change_reason": "Annual review",
            "salary_effective_date": "2026-04-01",
        },
    )

    [change] = history(client, emp["id"])
    assert change["old_salary"] == 80_000
    assert change["new_salary"] == 88_000
    assert change["old_currency"] == change["currency"] == "GBP"
    assert change["reason"] == "Annual review"
    assert change["effective_date"] == "2026-04-01"


def test_effective_date_defaults_to_today(client, create_employee):
    emp = create_employee()

    client.patch(f"/api/employees/{emp['id']}", json={"salary": 90_000})

    assert history(client, emp["id"])[0]["effective_date"] == date.today().isoformat()


def test_history_is_newest_first(client, create_employee):
    emp = create_employee(salary=80_000)

    for salary in (85_000, 90_000):
        client.patch(f"/api/employees/{emp['id']}", json={"salary": salary})

    assert [c["new_salary"] for c in history(client, emp["id"])] == [90_000, 85_000]


def test_non_salary_edits_do_not_create_history(client, create_employee):
    emp = create_employee(salary=80_000)

    client.patch(f"/api/employees/{emp['id']}", json={"job_title": "Lead", "salary": 80_000})

    assert history(client, emp["id"]) == []


def test_country_move_with_new_salary_records_both_currencies(client, create_employee):
    emp = create_employee(salary=80_000, country="GB")

    response = client.patch(f"/api/employees/{emp['id']}", json={"country": "DE", "salary": 95_000})

    assert response.status_code == 200
    [change] = history(client, emp["id"])
    assert (change["old_salary"], change["old_currency"]) == (80_000, "GBP")
    assert (change["new_salary"], change["currency"]) == (95_000, "EUR")


def test_country_move_that_changes_currency_requires_salary(client, create_employee):
    emp = create_employee(country="GB")

    response = client.patch(f"/api/employees/{emp['id']}", json={"country": "IN"})

    assert response.status_code == 422
    assert "salary" in response.json()["detail"]
    assert client.get(f"/api/employees/{emp['id']}").json()["country"] == "GB"


def test_country_move_within_same_currency_needs_no_salary(client, create_employee):
    emp = create_employee(country="DE")

    response = client.patch(f"/api/employees/{emp['id']}", json={"country": "FR"})

    assert response.status_code == 200
    assert history(client, emp["id"]) == []


def test_history_is_deleted_with_employee(client, create_employee, db):
    from sqlalchemy import func, select

    from app.models import SalaryChange

    emp = create_employee()
    client.patch(f"/api/employees/{emp['id']}", json={"salary": 99_000})

    client.delete(f"/api/employees/{emp['id']}")

    assert db.scalar(select(func.count()).select_from(SalaryChange)) == 0


def test_history_for_missing_employee_is_404(client):
    assert client.get("/api/employees/999/salary-history").status_code == 404
