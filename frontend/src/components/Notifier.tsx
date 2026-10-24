import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Severity = "success" | "error" | "info";
type Notify = (message: string, severity?: Severity) => void;

const NotifierContext = createContext<Notify>(() => {});

/** App-wide toast for mutation results, so pages don't each manage a Snackbar. */
export function NotifierProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; severity: Severity; key: number } | null>(
    null,
  );
  const notify = useCallback<Notify>(
    (message, severity = "success") => setToast({ message, severity, key: Date.now() }),
    [],
  );

  return (
    <NotifierContext.Provider value={notify}>
      {children}
      <Snackbar
        key={toast?.key}
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifierContext.Provider>
  );
}

export const useNotify = () => useContext(NotifierContext);
