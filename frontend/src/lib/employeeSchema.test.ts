import { filterOptions, makeEmployee } from "../test/fixtures";
import {
  employeeSchema,
  needsSalaryForCurrencyChange,
  toFormValues,
  toUpdatePayload,
} from "./employeeSchema";

const countries = filterOptions.countries;

describe("employeeSchema", () => {
  const valid = toFormValues(makeEmployee());

  it("accepts a valid employee and coerces salary from input text", () => {
    const result = employeeSchema.safeParse({ ...valid, salary: "95000" });
    expect(result.success && result.data.salary).toBe(95000);
  });

  it.each([
    ["salary", 0, "Salary must be greater than 0"],
    ["salary", 1.5, "Use whole amounts"],
    ["email", "nope", "Enter a valid email"],
    ["full_name", "  ", "Name is required"],
    ["country", "", "Select a country"],
  ])("rejects invalid %s", (field, value, message) => {
    const result = employeeSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("toUpdatePayload", () => {
  const original = makeEmployee();

  it("sends only changed fields", () => {
    const values = { ...toFormValues(original), job_title: "Staff Engineer" };
    expect(toUpdatePayload(original, values)).toEqual({ job_title: "Staff Engineer" });
  });

  it("includes salary change metadata only when salary changed", () => {
    const meta = { salary_change_reason: "Promotion", salary_effective_date: "2026-04-01" };

    expect(toUpdatePayload(original, { ...toFormValues(original), ...meta })).toEqual({});
    expect(
      toUpdatePayload(original, { ...toFormValues(original), salary: 90000, ...meta }),
    ).toEqual({
      salary: 90000,
      ...meta,
    });
  });
});

describe("needsSalaryForCurrencyChange", () => {
  const original = makeEmployee({ country: "GB", currency: "GBP", salary: 80000 });

  it("is true when moving to another currency without a new salary", () => {
    expect(
      needsSalaryForCurrencyChange(original, { country: "IN", salary: 80000 }, countries),
    ).toBe(true);
  });

  it("is false when a new salary is entered", () => {
    expect(
      needsSalaryForCurrencyChange(original, { country: "IN", salary: 6_000_000 }, countries),
    ).toBe(false);
  });

  it("is false when creating, or when currency is unchanged", () => {
    const de = makeEmployee({ country: "DE", currency: "EUR" });
    expect(needsSalaryForCurrencyChange(undefined, { country: "IN", salary: 1 }, countries)).toBe(
      false,
    );
    expect(needsSalaryForCurrencyChange(de, { country: "DE", salary: de.salary }, countries)).toBe(
      false,
    );
  });
});
