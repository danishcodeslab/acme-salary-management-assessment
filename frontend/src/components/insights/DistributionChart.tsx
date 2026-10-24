import { BarChart } from "@mui/x-charts/BarChart";

import type { DistributionBucket } from "../../api/types";
import { formatNumber } from "../../lib/format";
import { bandAxis, SERIES_COLOR } from "./chartTheme";

export function bucketLabel(b: DistributionBucket): string {
  const k = (n: number) => `$${n / 1000}k`;
  return b.max_usd === null ? `${k(b.min_usd)}+` : `${k(b.min_usd)}–${k(b.max_usd)}`;
}

export default function DistributionChart({ buckets }: { buckets: DistributionBucket[] }) {
  const data = buckets.map((b) => ({ band: bucketLabel(b), count: b.count }));
  return (
    <BarChart
      dataset={data}
      height={320}
      margin={{ left: 50, right: 16, top: 10, bottom: 80 }}
      borderRadius={4}
      grid={{ horizontal: true }}
      xAxis={[
        bandAxis({
          scaleType: "band",
          dataKey: "band",
          categoryGapRatio: 0.15, // histogram bands sit close; a small surface gap separates them
          tickLabelStyle: { angle: -35, textAnchor: "end", fontSize: 11 },
          disableTicks: true,
        }),
      ]}
      yAxis={[{ valueFormatter: (v: number) => formatNumber(v) }]}
      series={[
        {
          dataKey: "count",
          label: "Employees",
          color: SERIES_COLOR,
          valueFormatter: (v) => `${formatNumber(v ?? 0)} employees`,
        },
      ]}
      slotProps={{ legend: { hidden: true } }}
    />
  );
}
