import { http, HttpResponse } from "msw";

import { server } from "../test/server";
import { api, ApiError, errorMessage, toQueryString } from "./client";

describe("toQueryString", () => {
  it("drops empty values and encodes the rest", () => {
    expect(toQueryString({ q: "ada lovelace", country: "", page: 2, x: undefined })).toBe(
      "?q=ada+lovelace&page=2",
    );
  });

  it("returns an empty string when nothing is set", () => {
    expect(toQueryString({})).toBe("");
  });
});

describe("errorMessage", () => {
  it("uses a string detail as-is", () => {
    expect(errorMessage({ detail: "Email taken" }, "x")).toBe("Email taken");
  });

  it("flattens FastAPI validation errors with field names", () => {
    const body = { detail: [{ loc: ["body", "salary"], msg: "must be greater than 0" }] };
    expect(errorMessage(body, "x")).toBe("salary: must be greater than 0");
  });

  it("falls back when the body is unknown", () => {
    expect(errorMessage(null, "Server Error")).toBe("Server Error");
  });
});

describe("api", () => {
  it("throws ApiError carrying status and server message", async () => {
    server.use(
      http.post("/api/employees", () =>
        HttpResponse.json({ detail: "already exists" }, { status: 409 }),
      ),
    );

    const error = await api.createEmployee({} as never).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("already exists");
  });

  it("builds export URLs from filters without paging", () => {
    expect(api.exportUrl({ country: "IN", page: 3, size: 25, sort: "salary" })).toBe(
      "/api/employees/export.csv?country=IN&sort=salary",
    );
  });
});
