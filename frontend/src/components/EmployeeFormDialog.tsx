import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid2 as Grid,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import type { Employee, FilterOptions } from "../api/types";
import {
  currencyOf,
  emptyForm,
  employeeSchema,
  needsSalaryForCurrencyChange,
  toFormValues,
  type EmployeeFormValues,
} from "../lib/employeeSchema";
import { EMPLOYMENT_TYPE_LABELS } from "../lib/format";

interface Props {
  open: boolean;
  /** Present when editing; absent when creating. */
  employee?: Employee;
  options?: FilterOptions;
  submitting: boolean;
  serverError?: string;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => void;
}

export default function EmployeeFormDialog({
  open,
  employee,
  options,
  submitting,
  serverError,
  onClose,
  onSubmit,
}: Props) {
  const isEdit = employee !== undefined;
  const countries = options?.countries ?? [];
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    if (open) reset(employee ? toFormValues(employee) : emptyForm);
  }, [open, employee, reset]);

  const country = watch("country");
  const salary = watch("salary");
  const currency = currencyOf(countries, country);
  const salaryChanged = isEdit && Number(salary) !== employee.salary;

  const submit = handleSubmit((values) => {
    if (needsSalaryForCurrencyChange(employee, values, countries)) {
      setError("salary", {
        message: `Currency changes to ${currencyOf(countries, values.country)}; enter the new salary`,
      });
      return;
    }
    onSubmit(values);
  });

  const text = (name: keyof EmployeeFormValues, label: string, props: object = {}) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          value={field.value ?? ""}
          label={label}
          fullWidth
          error={!!errors[name]}
          helperText={errors[name]?.message}
          {...props}
        />
      )}
    />
  );

  const suggest = (name: "job_title" | "department", label: string, values: string[]) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Autocomplete
          freeSolo
          options={values}
          value={field.value}
          onChange={(_, v) => field.onChange(v ?? "")}
          onInputChange={(_, v) => field.onChange(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              error={!!errors[name]}
              helperText={errors[name]?.message}
            />
          )}
        />
      )}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{isEdit ? `Edit ${employee.full_name}` : "Add employee"}</DialogTitle>
        <DialogContent dividers>
          {serverError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {serverError}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              {text("full_name", "Full name", { autoFocus: true })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{text("email", "Email", { type: "email" })}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {suggest("job_title", "Job title", options?.job_titles ?? [])}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {suggest("department", "Department", options?.departments ?? [])}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {text("country", "Country", {
                select: true,
                children: countries.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.name} ({c.currency})
                  </MenuItem>
                )),
              })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {text("salary", "Annual salary", {
                type: "number",
                inputMode: "numeric",
                slotProps: {
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">{currency ?? "—"}</InputAdornment>
                    ),
                  },
                  htmlInput: { min: 1, step: 1000 },
                },
              })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {text("employment_type", "Employment type", {
                select: true,
                children: Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                )),
              })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {text("hire_date", "Hire date", {
                type: "date",
                slotProps: { inputLabel: { shrink: true } },
              })}
            </Grid>
          </Grid>

          {salaryChanged && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Salary change details (saved to history)
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  {text("salary_change_reason", "Reason", { placeholder: "e.g. Annual review" })}
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  {text("salary_effective_date", "Effective date", {
                    type: "date",
                    slotProps: { inputLabel: { shrink: true } },
                    helperText: errors.salary_effective_date?.message ?? "Defaults to today",
                  })}
                </Grid>
              </Grid>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {isEdit ? "Save changes" : "Add employee"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
