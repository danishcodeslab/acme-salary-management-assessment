import { Box } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";

import { BAR_ROW_HEIGHT, bandAxis, CATEGORY_GAP_RATIO, SERIES_COLOR } from "./chartTheme";

interface Props<T> {
  data: T[];
  categoryKey: keyof T & string;
  valueKey: keyof T & string;
  label: string;
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  onCategoryClick?: (row: T) => void;
}

/** One-series, sorted horizontal bar chart (magnitude comparison across categories). */
export default function HorizontalBarChart<T extends object>({
  data,
  categoryKey,
  valueKey,
  label,
  format,
  axisFormat = format,
  onCategoryClick,
}: Props<T>) {
  return (
    <Box sx={{ cursor: onCategoryClick ? "pointer" : undefined }}>
      <BarChart
        dataset={data as Record<string, string | number>[]}
        layout="horizontal"
        height={data.length * BAR_ROW_HEIGHT + 50}
        margin={{ left: 150, right: 24, top: 10, bottom: 30 }}
        borderRadius={4}
        grid={{ vertical: true }}
        yAxis={[
          bandAxis({
            scaleType: "band",
            dataKey: categoryKey,
            categoryGapRatio: CATEGORY_GAP_RATIO,
            disableTicks: true,
          }),
        ]}
        xAxis={[{ valueFormatter: (v: number) => axisFormat(v), tickNumber: 5 }]}
        series={[
          {
            dataKey: valueKey,
            label,
            color: SERIES_COLOR,
            valueFormatter: (v) => (v == null ? "" : format(v)),
          },
        ]}
        slotProps={{ legend: { hidden: true } }}
        onItemClick={(_, item) => onCategoryClick?.(data[item.dataIndex])}
      />
    </Box>
  );
}
