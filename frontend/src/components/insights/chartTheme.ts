import type { AxisConfig, ChartsXAxisProps, ChartsYAxisProps } from "@mui/x-charts/models";

// Single-series charts use one categorical hue (validated default palette, slot 1).
// Text never wears the series color; it stays in theme text tokens.
export const SERIES_COLOR = "#2a78d6";
export const BAR_ROW_HEIGHT = 34; // with categoryGapRatio below, bars render ~20px thick
export const CATEGORY_GAP_RATIO = 0.4;

/**
 * MUI's axis prop is typed as a union over every scale type, which hides band-only options
 * such as categoryGapRatio; this helper types a band axis precisely.
 */
export function bandAxis(
  config: Omit<AxisConfig<"band", string, ChartsXAxisProps & ChartsYAxisProps>, "id">,
) {
  return config;
}
