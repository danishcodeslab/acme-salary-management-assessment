import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { NotifierProvider } from "../components/Notifier";
import { ROUTER_FUTURE } from "../routerFuture";
import { theme } from "../theme";

export function renderWithProviders(ui: ReactElement, { route = "/" } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotifierProvider>
          <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE}>
            {ui}
          </MemoryRouter>
        </NotifierProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
