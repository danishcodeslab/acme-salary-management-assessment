import { z } from "zod";

import type { CountryOption, Employee, EmployeeInput, EmployeeUpdate } from "../api/types";

/** Client-side mirror of the backend rules, for instant feedback. The API stays the authority. */
export const employeeSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  job_title: z.string().trim().min(1, "Job title is required").max(80),
  department: z.string().trim().min(1, "Department is required").max(80),
  country: z.string().length(2, "Select a country"),
  salary: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int("Use whole amounts")
    .positive("Salary must be greater than 0")
    .max(1_000_000_000, "Salary looks too large"),
  employment_type: z.enum(["full_time", "part_time", "contractor"]),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  salary_change_reason: z.string().trim().max(500).optional(),
  salary_effective_date: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export const emptyForm: EmployeeFormValues = {
  full_name: "",
  email: "",
  job_title: "",
  department: "",
  country: "",
  salary: "" as unknown as number, // empty input until the user types
  employment_type: "full_time",
  hire_date: new Date().toISOString().slice(0, 10),
  salary_change_reason: "",
  salary_effective_date: "",
};

export function toFormValues(e: Employee): EmployeeFormValues {
  return {
    full_name: e.full_name,
    email: e.email,
    job_title: e.job_title,
    department: e.department,
    country: e.country,
    salary: e.salary,
    employment_type: e.employment_type,
    hire_date: e.hire_date,
    salary_change_reason: "",
    salary_effective_date: "",
  };
}

const EDITABLE: (keyof EmployeeInput)[] = [
  "full_name",
  "email",
  "job_title",
  "department",
  "country",
  "salary",
  "employment_type",
  "hire_date",
];

export function toCreatePayload(v: EmployeeFormValues): EmployeeInput {
  return Object.fromEntries(EDITABLE.map((k) => [k, v[k]])) as unknown as EmployeeInput;
}

/** PATCH only what changed; attach salary-change metadata only when salary changed. */
export function toUpdatePayload(original: Employee, v: EmployeeFormValues): EmployeeUpdate {
  const payload: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (v[key] !== original[key]) payload[key] = v[key];
  }
  if ("salary" in payload) {
    if (v.salary_change_reason) payload.salary_change_reason = v.salary_change_reason;
    if (v.salary_effective_date) payload.salary_effective_date = v.salary_effective_date;
  }
  return payload as EmployeeUpdate;
}

export function currencyOf(countries: CountryOption[], code: string): string | undefined {
  return countries.find((c) => c.code === code)?.currency;
}

/** Moving to a country with another currency must come with a new salary amount. */
export function needsSalaryForCurrencyChange(
  original: Employee | undefined,
  v: Pick<EmployeeFormValues, "country" | "salary">,
  countries: CountryOption[],
): boolean {
  if (!original) return false;
  const newCurrency = currencyOf(countries, v.country);
  return (
    newCurrency !== undefined && newCurrency !== original.currency && v.salary === original.salary
  );
}
