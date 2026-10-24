import CloseIcon from "@mui/icons-material/Close";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import type { Employee, SalaryChange } from "../api/types";
import { useSalaryHistory } from "../hooks/useEmployees";
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatMoney } from "../lib/format";

interface Props {
  employee?: Employee;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function changeLabel(c: SalaryChange): string {
  const from = formatMoney(c.old_salary, c.old_currency);
  const to = formatMoney(c.new_salary, c.currency);
  if (c.old_currency !== c.currency) return `${from} → ${to}`;
  const pct = ((c.new_salary - c.old_salary) / c.old_salary) * 100;
  return `${from} → ${to} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
}

export default function EmployeeDetailDrawer({ employee, onClose, onEdit }: Props) {
  const history = useSalaryHistory(employee?.id);

  return (
    <Drawer anchor="right" open={employee !== undefined} onClose={onClose}>
      {employee && (
        <Box
          sx={{ width: { xs: "100vw", sm: 420 }, p: 3 }}
          role="region"
          aria-label="Employee details"
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6">{employee.full_name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {employee.job_title} · {employee.department}
              </Typography>
            </Box>
            <IconButton aria-label="Close details" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ my: 2 }}>
            <Typography variant="h5" component="p">
              {formatMoney(employee.salary, employee.currency)}
            </Typography>
            {employee.currency !== "USD" && (
              <Typography variant="body2" color="text.secondary">
                ≈ {formatMoney(employee.salary_usd, "USD")} per year
              </Typography>
            )}
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Field label="Employee code" value={employee.employee_code} />
            <Field label="Country" value={employee.country} />
            <Field label="Email" value={employee.email} />
            <Field label="Employment" value={EMPLOYMENT_TYPE_LABELS[employee.employment_type]} />
            <Field label="Hire date" value={formatDate(employee.hire_date)} />
          </Box>

          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => onEdit(employee)}>
            Edit employee
          </Button>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" gutterBottom>
            Salary history
          </Typography>
          {history.isLoading ? (
            <Skeleton variant="rounded" height={64} />
          ) : history.data?.length ? (
            <List dense disablePadding>
              {history.data.map((c) => (
                <ListItem key={c.id} disableGutters alignItems="flex-start">
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    {c.new_salary >= c.old_salary || c.old_currency !== c.currency ? (
                      <TrendingUpIcon fontSize="small" color="success" />
                    ) : (
                      <TrendingDownIcon fontSize="small" color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={changeLabel(c)}
                    secondary={
                      <>
                        Effective {formatDate(c.effective_date)}
                        {c.reason && <> · {c.reason}</>}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Chip label="No salary changes recorded yet" size="small" variant="outlined" />
          )}
        </Box>
      )}
    </Drawer>
  );
}
