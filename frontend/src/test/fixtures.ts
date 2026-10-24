import type { Employee, FilterOptions } from "../api/types";

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employee_code: "EMP00001",
    full_name: "Ada Lovelace",
    email: "ada@acme.example",
    job_title: "Software Engineer",
    department: "Engineering",
    country: "GB",
    currency: "GBP",
    salary: 80000,
    salary_usd: 101266,
    employment_type: "full_time",
    hire_date: "2020-05-01",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export const filterOptions: FilterOptions = {
  countries: [
    { code: "DE", name: "Germany", currency: "EUR" },
    { code: "IN", name: "India", currency: "INR" },
    { code: "GB", name: "United Kingdom", currency: "GBP" },
    { code: "US", name: "United States", currency: "USD" },
  ],
  departments: ["Engineering", "Sales"],
  job_titles: ["Account Executive", "Software Engineer"],
  employment_types: ["full_time", "part_time", "contractor"],
};
