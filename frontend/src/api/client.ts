import type {
  CountryInsight,
  DepartmentInsight,
  DistributionBucket,
  Employee,
  EmployeeInput,
  EmployeeQuery,
  EmployeeUpdate,
  EmploymentType,
  FilterOptions,
  JobTitleInsight,
  Overview,
  Page,
  SalaryChange,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turn FastAPI's error bodies ({detail: string} or a 422 list) into one readable message. */
export function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = d.loc?.filter((p) => p !== "body").join(".");
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join("; ");
  }
  return fallback;
}

export function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(body, response.statusText));
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

type InsightParams = { employment_type?: EmploymentType };

export const api = {
  listEmployees: (query: EmployeeQuery) =>
    request<Page<Employee>>(`/employees${toQueryString(query)}`),
  getEmployee: (id: number) => request<Employee>(`/employees/${id}`),
  createEmployee: (data: EmployeeInput) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),
  updateEmployee: (id: number, data: EmployeeUpdate) =>
    request<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEmployee: (id: number) => request<void>(`/employees/${id}`, { method: "DELETE" }),
  salaryHistory: (id: number) => request<SalaryChange[]>(`/employees/${id}/salary-history`),
  exportUrl: (query: EmployeeQuery) => {
    const { page: _page, size: _size, ...filters } = query;
    return `/api/employees/export.csv${toQueryString(filters)}`;
  },
  filterOptions: () => request<FilterOptions>("/meta/filters"),

  overview: (p: InsightParams) => request<Overview>(`/insights/overview${toQueryString(p)}`),
  byCountry: (p: InsightParams) =>
    request<CountryInsight[]>(`/insights/by-country${toQueryString(p)}`),
  jobTitles: (country: string, p: InsightParams) =>
    request<JobTitleInsight[]>(
      `/insights/by-country/${encodeURIComponent(country)}/job-titles${toQueryString(p)}`,
    ),
  byDepartment: (p: InsightParams) =>
    request<DepartmentInsight[]>(`/insights/by-department${toQueryString(p)}`),
  distribution: (p: InsightParams) =>
    request<DistributionBucket[]>(`/insights/distribution${toQueryString(p)}`),
};
