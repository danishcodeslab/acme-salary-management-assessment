// Mirrors backend/app/schemas.py.

export type EmploymentType = "full_time" | "part_time" | "contractor";

export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  job_title: string;
  department: string;
  country: string;
  currency: string;
  salary: number;
  salary_usd: number;
  employment_type: EmploymentType;
  hire_date: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInput {
  full_name: string;
  email: string;
  job_title: string;
  department: string;
  country: string;
  salary: number;
  employment_type: EmploymentType;
  hire_date: string;
}

export interface EmployeeUpdate extends Partial<EmployeeInput> {
  salary_change_reason?: string;
  salary_effective_date?: string;
}

export interface SalaryChange {
  id: number;
  old_salary: number;
  old_currency: string;
  new_salary: number;
  currency: string;
  effective_date: string;
  reason: string | null;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type SortField =
  | "employee_code"
  | "full_name"
  | "email"
  | "job_title"
  | "department"
  | "country"
  | "salary"
  | "salary_usd"
  | "hire_date";

export interface EmployeeQuery {
  q?: string;
  country?: string;
  department?: string;
  job_title?: string;
  employment_type?: EmploymentType;
  sort?: SortField;
  order?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface CountryOption {
  code: string;
  name: string;
  currency: string;
}

export interface FilterOptions {
  countries: CountryOption[];
  departments: string[];
  job_titles: string[];
  employment_types: EmploymentType[];
}

export interface Overview {
  headcount: number;
  countries: number;
  departments: number;
  total_payroll_usd: number;
  avg_salary_usd: number;
  median_salary_usd: number;
}

export interface SalaryStats {
  headcount: number;
  min_salary: number;
  max_salary: number;
  avg_salary: number;
  median_salary: number;
}

export interface CountryInsight extends SalaryStats {
  country: string;
  country_name: string;
  currency: string;
  avg_salary_usd: number;
  median_salary_usd: number;
}

export interface JobTitleInsight extends SalaryStats {
  job_title: string;
  currency: string;
}

export interface DepartmentInsight {
  department: string;
  headcount: number;
  total_payroll_usd: number;
  avg_salary_usd: number;
  median_salary_usd: number;
}

export interface DistributionBucket {
  min_usd: number;
  max_usd: number | null;
  count: number;
}
