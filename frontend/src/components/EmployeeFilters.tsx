import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { Autocomplete, Button, InputAdornment, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";

import type { EmployeeQuery, FilterOptions } from "../api/types";
import type { FilterKey } from "../hooks/useEmployeeQueryParams";
import { EMPLOYMENT_TYPE_LABELS } from "../lib/format";

const SEARCH_DEBOUNCE_MS = 300;

interface Props {
  query: EmployeeQuery;
  options?: FilterOptions;
  hasFilters: boolean;
  onChange: (key: FilterKey, value: string | undefined) => void;
  onClear: () => void;
}

export default function EmployeeFilters({ query, options, hasFilters, onChange, onClear }: Props) {
  const [search, setSearch] = useState(query.q ?? "");

  // Keep the input in sync when the URL changes (e.g. "Clear filters", back button).
  useEffect(() => setSearch(query.q ?? ""), [query.q]);

  useEffect(() => {
    if (search === (query.q ?? "")) return;
    const timer = setTimeout(() => onChange("q", search.trim() || undefined), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, query.q, onChange]);

  const select = (key: FilterKey, label: string, items: { value: string; label: string }[]) => {
    const value = (query[key] as string | undefined) ?? "";
    // A value from the URL may arrive before options load; keep it selectable meanwhile.
    if (value && !items.some((i) => i.value === value)) items = [...items, { value, label: value }];
    return (
      <TextField
        select
        size="small"
        label={label}
        value={value}
        onChange={(e) => onChange(key, e.target.value || undefined)}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">All</MenuItem>
        {items.map((i) => (
          <MenuItem key={i.value} value={i.value}>
            {i.label}
          </MenuItem>
        ))}
      </TextField>
    );
  };

  return (
    <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center">
      <TextField
        size="small"
        placeholder="Search name, email or code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ minWidth: 260, flexGrow: 1, maxWidth: 360 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
          htmlInput: { "aria-label": "Search employees" },
        }}
      />
      {select(
        "country",
        "Country",
        (options?.countries ?? []).map((c) => ({ value: c.code, label: c.name })),
      )}
      {select(
        "department",
        "Department",
        (options?.departments ?? []).map((d) => ({ value: d, label: d })),
      )}
      <Autocomplete
        size="small"
        options={options?.job_titles ?? []}
        value={query.job_title ?? null}
        onChange={(_, v) => onChange("job_title", v ?? undefined)}
        renderInput={(params) => <TextField {...params} label="Job title" />}
        sx={{ minWidth: 220 }}
      />
      {select(
        "employment_type",
        "Employment",
        Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      )}
      {hasFilters && (
        <Button startIcon={<ClearIcon />} onClick={onClear}>
          Clear filters
        </Button>
      )}
    </Stack>
  );
}
