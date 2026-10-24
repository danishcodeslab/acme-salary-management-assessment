import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import type { EmployeeInput, EmployeeQuery, EmployeeUpdate } from "../api/types";

export const keys = {
  employees: ["employees"] as const,
  employeeList: (q: EmployeeQuery) => ["employees", "list", q] as const,
  history: (id: number) => ["employees", id, "history"] as const,
  filterOptions: ["meta", "filters"] as const,
  insights: ["insights"] as const,
};

export function useEmployees(query: EmployeeQuery) {
  return useQuery({
    queryKey: keys.employeeList(query),
    queryFn: () => api.listEmployees(query),
    placeholderData: keepPreviousData, // keep the grid populated while the next page loads
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: keys.filterOptions,
    queryFn: api.filterOptions,
    staleTime: 5 * 60_000,
  });
}

export function useSalaryHistory(id: number | undefined) {
  return useQuery({
    queryKey: keys.history(id ?? -1),
    queryFn: () => api.salaryHistory(id!),
    enabled: id !== undefined,
  });
}

/** Any write can change lists, history, dropdown values and insights. */
function useInvalidateAll() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.employees }),
      client.invalidateQueries({ queryKey: keys.filterOptions }),
      client.invalidateQueries({ queryKey: keys.insights }),
    ]);
}

export function useCreateEmployee() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: EmployeeInput) => api.createEmployee(data),
    onSuccess: invalidate,
  });
}

export function useUpdateEmployee() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmployeeUpdate }) =>
      api.updateEmployee(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteEmployee() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => api.deleteEmployee(id),
    onSuccess: invalidate,
  });
}
