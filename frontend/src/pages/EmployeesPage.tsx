import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridSortModel,
} from "@mui/x-data-grid";
import { useMemo, useState } from "react";

import { api, ApiError } from "../api/client";
import type { Employee, SortField } from "../api/types";
import ConfirmDialog from "../components/ConfirmDialog";
import EmployeeDetailDrawer from "../components/EmployeeDetailDrawer";
import EmployeeFilters from "../components/EmployeeFilters";
import EmployeeFormDialog from "../components/EmployeeFormDialog";
import { useNotify } from "../components/Notifier";
import { useEmployeeQueryParams } from "../hooks/useEmployeeQueryParams";
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  useFilterOptions,
  useUpdateEmployee,
} from "../hooks/useEmployees";
import { toCreatePayload, toUpdatePayload, type EmployeeFormValues } from "../lib/employeeSchema";
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatMoney, formatNumber } from "../lib/format";

type FormState = { mode: "create" } | { mode: "edit"; employee: Employee } | null;

export default function EmployeesPage() {
  const { query, update, setFilter, clearFilters, hasFilters } = useEmployeeQueryParams();
  const employees = useEmployees(query);
  const options = useFilterOptions();
  const notify = useNotify();

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();

  const [form, setForm] = useState<FormState>(null);
  const [selected, setSelected] = useState<Employee>();
  const [toDelete, setToDelete] = useState<Employee>();

  const activeMutation = form?.mode === "edit" ? updateMutation : createMutation;
  const formError =
    activeMutation.error instanceof ApiError ? activeMutation.error.message : undefined;

  const openForm = (state: FormState) => {
    createMutation.reset();
    updateMutation.reset();
    setForm(state);
  };

  const handleSubmit = (values: EmployeeFormValues) => {
    if (form?.mode === "edit") {
      const data = toUpdatePayload(form.employee, values);
      if (Object.keys(data).length === 0) return setForm(null);
      updateMutation.mutate(
        { id: form.employee.id, data },
        {
          onSuccess: (updated) => {
            setForm(null);
            if (selected?.id === updated.id) setSelected(updated);
            notify(`Saved changes to ${updated.full_name}`);
          },
        },
      );
    } else {
      createMutation.mutate(toCreatePayload(values), {
        onSuccess: (created) => {
          setForm(null);
          notify(`Added ${created.full_name} (${created.employee_code})`);
        },
      });
    }
  };

  const handleDelete = () => {
    if (!toDelete) return;
    deleteMutation.mutate(toDelete.id, {
      onSuccess: () => {
        notify(`Deleted ${toDelete.full_name}`);
        if (selected?.id === toDelete.id) setSelected(undefined);
        setToDelete(undefined);
      },
      onError: (e) => notify(e.message, "error"),
    });
  };

  const columns = useMemo<GridColDef<Employee>[]>(
    () => [
      { field: "employee_code", headerName: "Code", width: 110 },
      { field: "full_name", headerName: "Name", flex: 1, minWidth: 170 },
      { field: "job_title", headerName: "Job title", flex: 1, minWidth: 190 },
      { field: "department", headerName: "Department", width: 150 },
      { field: "country", headerName: "Country", width: 90 },
      {
        field: "salary",
        headerName: "Salary (local)",
        width: 150,
        align: "right",
        headerAlign: "right",
        valueFormatter: (_v, row) => formatMoney(row.salary, row.currency),
      },
      {
        field: "salary_usd",
        headerName: "Salary (USD)",
        width: 130,
        align: "right",
        headerAlign: "right",
        valueFormatter: (v: number) => formatMoney(v, "USD"),
      },
      {
        field: "employment_type",
        headerName: "Type",
        width: 110,
        sortable: false,
        valueFormatter: (v: string) => EMPLOYMENT_TYPE_LABELS[v] ?? v,
      },
      {
        field: "hire_date",
        headerName: "Hired",
        width: 120,
        valueFormatter: (v: string) => formatDate(v),
      },
      {
        field: "actions",
        type: "actions",
        width: 90,
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditOutlinedIcon />}
            label={`Edit ${row.full_name}`}
            onClick={() => openForm({ mode: "edit", employee: row })}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteOutlineIcon />}
            label={`Delete ${row.full_name}`}
            onClick={() => setToDelete(row)}
          />,
        ],
      },
    ],
    // Columns must be referentially stable for DataGrid; the handlers only call setters.
    [],
  );

  const sortModel: GridSortModel = [{ field: query.sort!, sort: query.order! }];

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
      >
        <Box>
          <Typography variant="h5" component="h1">
            Employees
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {employees.data ? `${formatNumber(employees.data.total)} employees` : "Loading…"}
            {hasFilters && " match your filters"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<DownloadIcon />} href={api.exportUrl(query)} variant="outlined">
            Export CSV
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => openForm({ mode: "create" })}
          >
            Add employee
          </Button>
        </Stack>
      </Stack>

      <EmployeeFilters
        query={query}
        options={options.data}
        hasFilters={hasFilters}
        onChange={setFilter}
        onClear={clearFilters}
      />

      {employees.isError && (
        <Alert severity="error">Could not load employees: {employees.error.message}</Alert>
      )}

      <Paper sx={{ height: "calc(100vh - 290px)", minHeight: 420 }}>
        <DataGrid
          rows={employees.data?.items ?? []}
          columns={columns}
          rowCount={employees.data?.total ?? 0}
          loading={employees.isFetching}
          paginationMode="server"
          sortingMode="server"
          paginationModel={{ page: query.page! - 1, pageSize: query.size! }}
          onPaginationModelChange={(m) =>
            update({ page: m.page + 1, size: m.pageSize }, m.pageSize !== query.size)
          }
          pageSizeOptions={[25, 50, 100]}
          sortModel={sortModel}
          onSortModelChange={(model) => {
            const [first] = model;
            update({
              sort: first ? (first.field as SortField) : undefined,
              order: first?.sort ?? undefined,
            });
          }}
          disableColumnFilter
          disableRowSelectionOnClick
          onRowClick={({ row }) => setSelected(row)}
          sx={{ border: 0, "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </Paper>

      <EmployeeFormDialog
        open={form !== null}
        employee={form?.mode === "edit" ? form.employee : undefined}
        options={options.data}
        submitting={activeMutation.isPending}
        serverError={formError}
        onClose={() => setForm(null)}
        onSubmit={handleSubmit}
      />

      <EmployeeDetailDrawer
        employee={selected}
        onClose={() => setSelected(undefined)}
        onEdit={(e) => openForm({ mode: "edit", employee: e })}
      />

      <ConfirmDialog
        open={toDelete !== undefined}
        title="Delete employee?"
        message={`${toDelete?.full_name ?? ""} and their salary history will be permanently removed.`}
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={() => setToDelete(undefined)}
      />
    </Stack>
  );
}
