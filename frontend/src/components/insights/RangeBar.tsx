import { Box, Tooltip } from "@mui/material";

import { SERIES_COLOR } from "./chartTheme";

interface Props {
  min: number;
  median: number;
  max: number;
  /** Shared scale so rows are comparable. */
  scaleMin: number;
  scaleMax: number;
  label: string;
}

/** Inline min–max band with a median tick, scaled to the table's overall range. */
export default function RangeBar({ min, median, max, scaleMin, scaleMax, label }: Props) {
  const span = scaleMax - scaleMin || 1;
  const pct = (v: number) => ((v - scaleMin) / span) * 100;
  return (
    <Tooltip title={label}>
      <Box
        role="img"
        aria-label={label}
        sx={{
          position: "relative",
          height: 16,
          minWidth: 160,
          bgcolor: "action.hover",
          borderRadius: 1,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 5,
            height: 6,
            left: `${pct(min)}%`,
            width: `${Math.max(pct(max) - pct(min), 0.5)}%`,
            bgcolor: SERIES_COLOR,
            opacity: 0.35,
            borderRadius: 1,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 1,
            height: 14,
            width: 3,
            left: `calc(${pct(median)}% - 1.5px)`,
            bgcolor: SERIES_COLOR,
            borderRadius: 1,
          }}
        />
      </Box>
    </Tooltip>
  );
}
