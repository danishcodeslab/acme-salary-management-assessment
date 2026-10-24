import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import type { EmploymentType } from "../api/types";
import { keys } from "./useEmployees";

type Params = { employment_type?: EmploymentType };

export const useOverview = (p: Params) =>
  useQuery({ queryKey: [...keys.insights, "overview", p], queryFn: () => api.overview(p) });

export const useByCountry = (p: Params) =>
  useQuery({ queryKey: [...keys.insights, "country", p], queryFn: () => api.byCountry(p) });

export const useJobTitles = (country: string | undefined, p: Params) =>
  useQuery({
    queryKey: [...keys.insights, "titles", country, p],
    queryFn: () => api.jobTitles(country!, p),
    enabled: !!country,
  });

export const useByDepartment = (p: Params) =>
  useQuery({ queryKey: [...keys.insights, "department", p], queryFn: () => api.byDepartment(p) });

export const useDistribution = (p: Params) =>
  useQuery({
    queryKey: [...keys.insights, "distribution", p],
    queryFn: () => api.distribution(p),
  });
