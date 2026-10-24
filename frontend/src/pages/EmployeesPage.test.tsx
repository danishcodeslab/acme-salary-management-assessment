import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import type { EmployeeInput } from "../api/types";
import { renderWithProviders } from "../test/render";
import { server } from "../test/server";
import { filterOptions, makeEmployee } from "../test/fixtures";
import EmployeesPage from "./EmployeesPage";

const ada = makeEmployee();
const raj = makeEmployee({
  id: 2,
  employee_code: "EMP00002",
  full_name: "Raj Patel",
  email: "raj@acme.example",
  country: "IN",
  currency: "INR",
  salary: 2_000_000,
  salary_usd: 23952,
});

function setup({ route = "/employees" } = {}) {
  const listRequests: URLSearchParams[] = [];
  server.use(
    http.get("/api/meta/filters", () => HttpResponse.json(filterOptions)),
    http.get("/api/employees", ({ request }) => {
      const params = new URL(request.url).searchParams;
      listRequests.push(params);
      const q = params.get("q")?.toLowerCase();
      const items = [ada, raj].filter((e) => !q || e.full_name.toLowerCase().includes(q));
      return HttpResponse.json({ items, total: items.length, page: 1, size: 25 });
    }),
  );
  renderWithProviders(<EmployeesPage />, { route });
  return { listRequests, user: userEvent.setup() };
}

describe("EmployeesPage", () => {
  it("shows employees with local and USD salaries", async () => {
    setup();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("2 employees")).toBeInTheDocument();
    expect(screen.getByText("₹2,000,000")).toBeInTheDocument();
    expect(screen.getByText("$23,952")).toBeInTheDocument();
  });

  it("debounces search and queries the server with it", async () => {
    const { listRequests, user } = setup();
    await screen.findByText("Ada Lovelace");

    await user.type(screen.getByLabelText("Search employees"), "raj");

    await waitFor(() => expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument());
    expect(screen.getByText("Raj Patel")).toBeInTheDocument();
    expect(listRequests.at(-1)?.get("q")).toBe("raj");
    // One request for the initial load and one after typing stops, not one per keystroke.
    expect(listRequests.filter((p) => p.has("q"))).toHaveLength(1);
  });

  it("restores filters from the URL", async () => {
    const { listRequests } = setup({ route: "/employees?country=IN&sort=salary&order=desc" });
    await screen.findByText("Raj Patel");

    const params = listRequests[0];
    expect(params.get("country")).toBe("IN");
    expect(params.get("sort")).toBe("salary");
    expect(params.get("order")).toBe("desc");
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("validates the form before calling the API, then creates the employee", async () => {
    let posted: EmployeeInput | undefined;
    const { user } = setup();
    server.use(
      http.post("/api/employees", async ({ request }) => {
        posted = (await request.json()) as EmployeeInput;
        return HttpResponse.json(makeEmployee({ id: 3, ...posted, employee_code: "EMP00003" }), {
          status: 201,
        });
      }),
    );
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Add employee" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add employee" }));

    expect(await within(dialog).findByText("Name is required")).toBeInTheDocument();
    expect(posted).toBeUndefined();

    await user.type(within(dialog).getByLabelText("Full name"), "Grace Hopper");
    await user.type(within(dialog).getByLabelText("Email"), "grace@acme.example");
    await user.type(within(dialog).getByLabelText("Job title"), "Software Engineer");
    await user.type(within(dialog).getByLabelText("Department"), "Engineering");
    await user.click(within(dialog).getByLabelText("Country"));
    await user.click(await screen.findByRole("option", { name: "United States (USD)" }));
    await user.type(within(dialog).getByLabelText("Annual salary"), "120000");
    await user.click(within(dialog).getByRole("button", { name: "Add employee" }));

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted).toMatchObject({
      full_name: "Grace Hopper",
      email: "grace@acme.example",
      country: "US",
      salary: 120000,
      employment_type: "full_time",
    });
    expect(await screen.findByText("Added Grace Hopper (EMP00003)")).toBeInTheDocument();
  });

  it("shows server errors inside the form", async () => {
    const { user } = setup();
    server.use(
      http.patch("/api/employees/1", () =>
        HttpResponse.json({ detail: "An employee with email x already exists" }, { status: 409 }),
      ),
    );
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("menuitem", { name: "Edit Ada Lovelace" }));
    const dialog = await screen.findByRole("dialog");
    const email = within(dialog).getByLabelText("Email");
    await user.clear(email);
    await user.type(email, "taken@acme.example");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await within(dialog).findByText(/already exists/)).toBeInTheDocument();
  });
});
