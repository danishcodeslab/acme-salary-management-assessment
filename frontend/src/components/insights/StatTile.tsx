import { Paper, Skeleton, Typography } from "@mui/material";

interface Props {
  label: string;
  value?: string;
  hint?: string;
  hero?: boolean;
}

export default function StatTile({ label, value, hint, hero = false }: Props) {
  return (
    <Paper role="group" aria-label={label} sx={{ p: 2.5, height: "100%" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{ fontSize: hero ? 40 : 28, fontWeight: 600, lineHeight: 1.2, mt: 0.5 }}
      >
        {value ?? <Skeleton width="60%" />}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
