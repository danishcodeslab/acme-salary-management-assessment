import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import type { CountryInsight } from "../api/types";
import { bucketLabel } from "../components/insights/DistributionChart";
import { renderWithProviders } from "../test/render";
import { server } from "../test/server";
import InsightsPage from "./InsightsPage";

const countries: CountryInsight[] = [
  {
    country: "US", country_name: "United States", currency: "USD", headcount: 2720,
    min_salary: 26000, max_salary: 225000, avg_salary: 94691, median_salary: 85000,
    avg_salary_usd: 94691, median_salary_usd: 85000,
  },
  {
    country: "IN", country_name: "India", currency: "INR", headcount: 2029,
    min_salary: 610000, max_salary: 5260000, avg_salary: 2194480, median_salary: 1990000,
    avg_salary_usd: 26281, median_salary_usd: 23832,
  },
]; // prettier-ignore

function setup() {
  const requests: string[] = [];
  server.use(
    http.get("/api/insights/*", ({ request }) => {
      requests.push(request.url);
      return undefined; // fall through to the specific handlers below
    }),
    http.get("/api/insights/overview", () =>
      HttpResponse.json({
        headcount: 10000, countries: 12, departments: 9,
        total_payroll_usd: 672782776, avg_salary_usd: 67278, median_salary_usd: 61842,
      }),
    ), // prettier-ignore
    http.get("/api/insights/by-country", () => HttpResponse.json(countries)),
    http.get("/api/insights/by-country/:code/job-titles", ({ params }) =>
      HttpResponse.json([
        {
          job_title: params.code === "IN" ? "Data Scientist" : "Engineering Manager",
          currency: params.code === "IN" ? "INR" : "USD",
          headcount: 10, min_salary: 100, max_salary: 300, avg_salary: 200, median_salary: 210,
        },
      ]),
    ), // prettier-ignore
    http.get("/api/insights/by-department", () =>
      HttpResponse.json([
        { department: "Engineering", headcount: 2392, total_payroll_usd: 211596070,
          avg_salary_usd: 88460, median_salary_usd: 88971 },
      ]),
    ), // prettier-ignore
    http.get("/api/insights/distribution", () =>
      HttpResponse.json([
        { min_usd: 0, max_usd: 20000, count: 674 },
        { min_usd: 20000, max_usd: null, count: 9326 },
      ]),
    ),
  );
  renderWithProviders(<InsightsPage />);
  return { requests, user: userEvent.setup() };
}

describe("InsightsPage", () => {
  it("shows org-level headline numbers", async () => {
    setup();

    const tile = (name: string) => screen.getByRole("group", { name });

    await waitFor(() => expect(tile("Median annual salary (USD)")).toHaveTextContent("$61,842"));
    expect(tile("Median annual salary (USD)")).toHaveTextContent("Average $67,278");
    expect(tile("Headcount")).toHaveTextContent("10,000");
    expect(tile("Annual payroll (USD)")).toHaveTextContent("$672.8M");
    expect(tile("Footprint")).toHaveTextContent("12 countries");
  });

  it("lists local-currency stats per country", async () => {
    setup();

    const table = await screen.findByRole("table", { name: "Pay by country" });
    const india = (await within(table).findByText("India")).closest("tr")!;
    expect(within(india).getByText("₹1,990,000")).toBeInTheDocument();
  });

  it("drills into job titles for the chosen country", async () => {
    const { user } = setup();
    const titles = () => screen.getByRole("table", { name: "Pay by job title" });

    // Defaults to the largest country.
    await waitFor(() =>
      expect(within(titles()).getByText("Engineering Manager")).toBeInTheDocument(),
    );

    const countryTable = screen.getByRole("table", { name: "Pay by country" });
    await user.click(within(countryTable).getByText("India"));

    await waitFor(() => expect(within(titles()).getByText("Data Scientist")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Pay by job title in India" })).toBeInTheDocument();
  });

  it("refetches every insight with the employment type filter", async () => {
    const { requests, user } = setup();
    await screen.findByText("$61,842");

    await user.click(screen.getByRole("button", { name: "Full-time" }));

    await waitFor(() =>
      expect(
        requests.filter((u) => u.includes("employment_type=full_time")).length,
      ).toBeGreaterThanOrEqual(5),
    );
  });
});

describe("bucketLabel", () => {
  it("labels closed and open-ended bands", () => {
    expect(bucketLabel({ min_usd: 20000, max_usd: 40000, count: 1 })).toBe("$20k–$40k");
    expect(bucketLabel({ min_usd: 240000, max_usd: null, count: 1 })).toBe("$240k+");
  });
});
