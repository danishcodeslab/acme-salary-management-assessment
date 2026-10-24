import {
  Alert,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

import type { JobTitleInsight } from "../../api/types";
import { formatMoney } from "../../lib/format";
import RangeBar from "./RangeBar";

interface Props {
  rows?: JobTitleInsight[];
  loading: boolean;
}

export default function JobTitleTable({ rows, loading }: Props) {
  if (loading) return <Skeleton variant="rounded" height={240} />;
  if (!rows?.length) return <Alert severity="info">No employees match in this country.</Alert>;

  const scaleMin = Math.min(...rows.map((r) => r.min_salary));
  const scaleMax = Math.max(...rows.map((r) => r.max_salary));
  const money = (v: number, currency: string) => formatMoney(v, currency);

  return (
    <TableContainer>
      <Table size="small" aria-label="Pay by job title">
        <TableHead>
          <TableRow>
            <TableCell>Job title</TableCell>
            <TableCell align="right">People</TableCell>
            <TableCell align="right">Min</TableCell>
            <TableCell align="right">Median</TableCell>
            <TableCell align="right">Average</TableCell>
            <TableCell align="right">Max</TableCell>
            <TableCell sx={{ width: "25%" }}>Range (median marked)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.job_title} hover>
              <TableCell>{r.job_title}</TableCell>
              <TableCell align="right">{r.headcount}</TableCell>
              <TableCell align="right">{money(r.min_salary, r.currency)}</TableCell>
              <TableCell align="right">
                <strong>{money(r.median_salary, r.currency)}</strong>
              </TableCell>
              <TableCell align="right">{money(r.avg_salary, r.currency)}</TableCell>
              <TableCell align="right">{money(r.max_salary, r.currency)}</TableCell>
              <TableCell>
                <RangeBar
                  min={r.min_salary}
                  median={r.median_salary}
                  max={r.max_salary}
                  scaleMin={scaleMin}
                  scaleMax={scaleMax}
                  label={`${r.job_title}: ${money(r.min_salary, r.currency)} to ${money(r.max_salary, r.currency)}, median ${money(r.median_salary, r.currency)}`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
