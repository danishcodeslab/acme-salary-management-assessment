import { AppBar, Box, Container, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import EmployeesPage from "./pages/EmployeesPage";
import InsightsPage from "./pages/InsightsPage";

const NAV = [
  { path: "/employees", label: "Employees" },
  { path: "/insights", label: "Insights" },
];

export default function App() {
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.path))?.path ?? false;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar sx={{ gap: 4 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: "primary.main" }}>
            ACME · Salaries
          </Typography>
          <Tabs value={current} aria-label="Main navigation">
            {NAV.map((n) => (
              <Tab key={n.path} label={n.label} value={n.path} component={Link} to={n.path} />
            ))}
          </Tabs>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/employees" replace />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Navigate to="/employees" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}
