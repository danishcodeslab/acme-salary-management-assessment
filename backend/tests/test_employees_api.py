import pytest

from tests.conftest import employee_payload


class TestCreate:
    def test_creates_employee_with_derived_fields(self, client):
        response = client.post("/api/employees", json=employee_payload())

        assert response.status_code == 201
        body = response.json()
        assert body["employee_code"] == f"EMP{body['id']:05d}"
        assert body["currency"] == "GBP"  # derived from country
        assert body["salary_usd"] == 101_266  # 80,000 GBP / 0.79

    def test_normalizes_email_and_country(self, create_employee):
        body = create_employee(email="Ada@ACME.example", country="gb", full_name="  Ada  ")

        assert body["email"] == "ada@acme.example"
        assert body["country"] == "GB"
        assert body["full_name"] == "Ada"

    def test_duplicate_email_is_conflict(self, client, create_employee):
        create_employee(email="dup@acme.example")

        response = client.post("/api/employees", json=employee_payload(email="DUP@acme.example"))

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("salary", 0),
            ("salary", -5),
            ("salary", 2_000_000_000),
            ("email", "not-an-email"),
            ("country", "XX"),
            ("full_name", "   "),
            ("employment_type", "intern"),
            ("hire_date", "1900-01-01"),
        ],
    )
    def test_rejects_invalid_input(self, client, field, value):
        response = client.post("/api/employees", json=employee_payload(**{field: value}))

        assert response.status_code == 422

    def test_rejects_missing_required_field(self, client):
        payload = employee_payload()
        del payload["salary"]

        assert client.post("/api/employees", json=payload).status_code == 422


class TestReadUpdateDelete:
    def test_get_returns_employee(self, client, create_employee):
        created = create_employee()

        response = client.get(f"/api/employees/{created['id']}")

        assert response.status_code == 200
        assert response.json() == created

    def test_get_missing_is_404(self, client):
        assert client.get("/api/employees/999").status_code == 404

    def test_patch_updates_only_sent_fields(self, client, create_employee):
        created = create_employee()

        response = client.patch(
            f"/api/employees/{created['id']}", json={"job_title": "Staff Engineer"}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["job_title"] == "Staff Engineer"
        assert body["salary"] == created["salary"]
        assert body["email"] == created["email"]

    def test_changing_country_updates_currency(self, client, create_employee):
        created = create_employee(country="GB")

        body = client.patch(f"/api/employees/{created['id']}", json={"country": "IN"}).json()

        assert body["currency"] == "INR"

    def test_patch_to_taken_email_is_conflict(self, client, create_employee):
        create_employee(email="taken@acme.example")
        other = create_employee(email="other@acme.example")

        response = client.patch(
            f"/api/employees/{other['id']}", json={"email": "taken@acme.example"}
        )

        assert response.status_code == 409

    def test_patch_keeping_own_email_is_allowed(self, client, create_employee):
        created = create_employee()

        response = client.patch(f"/api/employees/{created['id']}", json={"email": created["email"]})

        assert response.status_code == 200

    def test_patch_missing_is_404(self, client):
        assert client.patch("/api/employees/999", json={"salary": 1}).status_code == 404

    def test_delete_removes_employee(self, client, create_employee):
        created = create_employee()

        assert client.delete(f"/api/employees/{created['id']}").status_code == 204
        assert client.get(f"/api/employees/{created['id']}").status_code == 404

    def test_delete_missing_is_404(self, client):
        assert client.delete("/api/employees/999").status_code == 404


class TestList:
    @pytest.fixture
    def staff(self, create_employee):
        return [
            create_employee(full_name="Alice Smith", email="alice@acme.example", country="US",
                            department="Engineering", salary=150_000),
            create_employee(full_name="Bob Jones", email="bob@acme.example", country="IN",
                            department="Sales", job_title="Account Executive", salary=2_000_000),
            create_employee(full_name="Carol Smith", email="carol@acme.example", country="US",
                            department="Sales", job_title="Account Executive", salary=90_000),
        ]  # fmt: skip

    def test_paginates_with_total(self, client, staff):
        body = client.get("/api/employees", params={"size": 2, "page": 2}).json()

        assert body["total"] == 3
        assert body["page"] == 2
        assert [e["full_name"] for e in body["items"]] == ["Carol Smith"]

    def test_search_matches_name_email_or_code(self, client, staff):
        by_name = client.get("/api/employees", params={"q": "smith"}).json()
        by_email = client.get("/api/employees", params={"q": "bob@"}).json()
        by_code = client.get("/api/employees", params={"q": staff[0]["employee_code"]}).json()

        assert {e["full_name"] for e in by_name["items"]} == {"Alice Smith", "Carol Smith"}
        assert [e["full_name"] for e in by_email["items"]] == ["Bob Jones"]
        assert [e["full_name"] for e in by_code["items"]] == ["Alice Smith"]

    def test_filters_combine(self, client, staff):
        body = client.get("/api/employees", params={"country": "us", "department": "Sales"}).json()

        assert [e["full_name"] for e in body["items"]] == ["Carol Smith"]

    def test_sorts_by_local_salary(self, client, staff):
        body = client.get("/api/employees", params={"sort": "salary", "order": "desc"}).json()

        assert [e["full_name"] for e in body["items"]] == [
            "Bob Jones",
            "Alice Smith",
            "Carol Smith",
        ]

    def test_sorts_by_usd_salary_across_currencies(self, client, staff):
        body = client.get("/api/employees", params={"sort": "salary_usd", "order": "desc"}).json()

        # 2,000,000 INR is ~23,952 USD, so Bob ranks last once normalized.
        assert [e["full_name"] for e in body["items"]] == [
            "Alice Smith",
            "Carol Smith",
            "Bob Jones",
        ]

    @pytest.mark.parametrize(
        "params", [{"size": 0}, {"size": 101}, {"page": 0}, {"sort": "password"}, {"order": "up"}]
    )
    def test_rejects_invalid_query_params(self, client, params):
        assert client.get("/api/employees", params=params).status_code == 422


def test_filter_options_list_distinct_values(client, create_employee):
    create_employee(email="a@acme.example", department="Sales", job_title="Account Executive")
    create_employee(email="b@acme.example", department="Engineering")
    create_employee(email="c@acme.example", department="Sales", job_title="Account Executive")

    body = client.get("/api/meta/filters").json()

    assert body["departments"] == ["Engineering", "Sales"]
    assert body["job_titles"] == ["Account Executive", "Software Engineer"]
    assert {"code": "IN", "name": "India", "currency": "INR"} in body["countries"]
    assert body["employment_types"] == ["full_time", "part_time", "contractor"]
