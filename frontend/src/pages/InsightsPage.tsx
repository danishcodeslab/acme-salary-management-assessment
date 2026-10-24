import {
  Alert,
  Box,
  Grid2 as Grid,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";

import type { EmploymentType } from "../api/types";
import DistributionChart from "../components/insights/DistributionChart";
import HorizontalBarChart from "../components/insights/HorizontalBarChart";
import JobTitleTable from "../components/insights/JobTitleTable";
import StatTile from "../components/insights/StatTile";
import {
  useByCountry,
  useByDepartment,
  useDistribution,
  useJobTitles,
  useOverview,
} from "../hooks/useInsights";
import { EMPLOYMENT_TYPE_LABELS, formatCompactUsd, formatMoney, formatNumber } from "../lib/format";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

const usd = (v: number) => formatMoney(v, "USD");

export default function InsightsPage() {
  const [employmentType, setEmploymentType] = useState<EmploymentType | "all">("all");
  const params = employmentType === "all" ? {} : { employment_type: employmentType };

  const overview = useOverview(params);
  const countries = useByCountry(params);
  const departments = useByDepartment(params);
  const distribution = useDistribution(params);

  const [selectedCountry, setSelectedCountry] = useState<string>();
  const country = selectedCountry ?? countries.data?.[0]?.country;
  const jobTitles = useJobTitles(country, params);
  const countryName = countries.data?.find((c) => c.country === country)?.country_name;

  const failed = [overview, countries, departments, distribution].find((q) => q.isError);
  const o = overview.data;

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-end"
        flexWrap="wrap"
        gap={2}
      >
        <Box>
          <Typography variant="h5" component="h1">
            Pay insights
          </Typography>
          <Typography variant="body2" color="text.secondary">
            USD figures use fixed reference exchange rates so countries can be compared.
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={employmentType}
          onChange={(_, v) => v && setEmploymentType(v)}
          aria-label="Employment type"
        >
          <ToggleButton value="all">All</ToggleButton>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
            <ToggleButton key={value} value={value}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {failed && <Alert severity="error">Could not load insights: {failed.error?.message}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatTile
            hero
            label="Median annual salary (USD)"
            value={o && usd(o.median_salary_usd)}
            hint={o && `Average ${usd(o.avg_salary_usd)}`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 2.66 }}>
          <StatTile label="Headcount" value={o && formatNumber(o.headcount)} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.66 }}>
          <StatTile
            label="Annual payroll (USD)"
            value={o && formatCompactUsd(o.total_payroll_usd)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 2.68 }}>
          <StatTile
            label="Footprint"
            value={o && `${o.countries} countries`}
            hint={o && `${o.departments} departments`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section
            title="Median salary by country"
            subtitle="In USD for comparison. Click a bar to see pay by job title in that country."
          >
            {countries.data ? (
              <HorizontalBarChart
                data={[...countries.data].sort((a, b) => b.median_salary_usd - a.median_salary_usd)}
                categoryKey="country_name"
                valueKey="median_salary_usd"
                label="Median salary (USD)"
                format={usd}
                axisFormat={formatCompactUsd}
                onCategoryClick={(row) => setSelectedCountry(row.country)}
              />
            ) : (
              <Skeleton variant="rounded" height={400} />
            )}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section title="Countries" subtitle="Local-currency pay statistics per country.">
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table size="small" stickyHeader aria-label="Pay by country">
                <TableHead>
                  <TableRow>
                    <TableCell>Country</TableCell>
                    <TableCell align="right">People</TableCell>
                    <TableCell align="right">Min</TableCell>
                    <TableCell align="right">Median</TableCell>
                    <TableCell align="right">Max</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {countries.data?.map((c) => (
                    <TableRow
                      key={c.country}
                      hover
                      selected={c.country === country}
                      onClick={() => setSelectedCountry(c.country)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{c.country_name}</TableCell>
                      <TableCell align="right">{formatNumber(c.headcount)}</TableCell>
                      <TableCell align="right">{formatMoney(c.min_salary, c.currency)}</TableCell>
                      <TableCell align="right">
                        <strong>{formatMoney(c.median_salary, c.currency)}</strong>
                      </TableCell>
                      <TableCell align="right">{formatMoney(c.max_salary, c.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        </Grid>
      </Grid>

      <Section
        title={`Pay by job title${countryName ? ` in ${countryName}` : ""}`}
        subtitle="Local currency. Highest average pay first."
      >
        <TextField
          select
          size="small"
          label="Country"
          value={country ?? ""}
          onChange={(e) => setSelectedCountry(e.target.value)}
          sx={{ minWidth: 220, mb: 2 }}
        >
          {(countries.data ?? []).map((c) => (
            <MenuItem key={c.country} value={c.country}>
              {c.country_name}
            </MenuItem>
          ))}
        </TextField>
        <JobTitleTable rows={jobTitles.data} loading={jobTitles.isLoading} />
      </Section>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section title="Annual payroll by department" subtitle="Total cost in USD.">
            {departments.data ? (
              <>
                <HorizontalBarChart
                  data={departments.data}
                  categoryKey="department"
                  valueKey="total_payroll_usd"
                  label="Annual payroll (USD)"
                  format={usd}
                  axisFormat={formatCompactUsd}
                />
                <Table size="small" aria-label="Pay by department">
                  <TableHead>
                    <TableRow>
                      <TableCell>Department</TableCell>
                      <TableCell align="right">People</TableCell>
                      <TableCell align="right">Median (USD)</TableCell>
                      <TableCell align="right">Average (USD)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {departments.data.map((d) => (
                      <TableRow key={d.department}>
                        <TableCell>{d.department}</TableCell>
                        <TableCell align="right">{formatNumber(d.headcount)}</TableCell>
                        <TableCell align="right">{usd(d.median_salary_usd)}</TableCell>
                        <TableCell align="right">{usd(d.avg_salary_usd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Skeleton variant="rounded" height={400} />
            )}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Section title="Salary distribution" subtitle="Number of employees per USD salary band.">
            {distribution.data ? (
              <DistributionChart buckets={distribution.data} />
            ) : (
              <Skeleton variant="rounded" height={300} />
            )}
          </Section>
        </Grid>
      </Grid>
    </Stack>
  );
}
