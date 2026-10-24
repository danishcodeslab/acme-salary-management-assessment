import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { EmployeeQuery, EmploymentType, SortField } from "../api/types";

export const DEFAULT_PAGE_SIZE = 25;
const FILTER_KEYS = ["q", "country", "department", "job_title", "employment_type"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/**
 * Directory state (filters, sort, paging) lives in the URL so views can be bookmarked,
 * shared, and restored with the browser's back button.
 */
export function useEmployeeQueryParams() {
  const [params, setParams] = useSearchParams();

  const query: EmployeeQuery = useMemo(
    () => ({
      q: params.get("q") ?? undefined,
      country: params.get("country") ?? undefined,
      department: params.get("department") ?? undefined,
      job_title: params.get("job_title") ?? undefined,
      employment_type: (params.get("employment_type") as EmploymentType) ?? undefined,
      sort: (params.get("sort") as SortField) ?? "employee_code",
      order: (params.get("order") as "asc" | "desc") ?? "asc",
      page: Number(params.get("page") ?? 1),
      size: Number(params.get("size") ?? DEFAULT_PAGE_SIZE),
    }),
    [params],
  );

  const update = useCallback(
    (changes: Record<string, string | number | undefined>, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setFilter = useCallback(
    (key: FilterKey, value: string | undefined) => update({ [key]: value }),
    [update],
  );

  const clearFilters = useCallback(
    () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined]))),
    [update],
  );

  const hasFilters = FILTER_KEYS.some((k) => params.has(k));

  return { query, update, setFilter, clearFilters, hasFilters };
}
