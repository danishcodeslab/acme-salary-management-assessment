import { formatCompactUsd, formatDate, formatMoney } from "./format";

describe("format", () => {
  it("formats whole amounts in the given currency", () => {
    expect(formatMoney(85000, "USD")).toBe("$85,000");
    expect(formatMoney(1990000, "INR")).toBe("₹1,990,000");
  });

  it("formats compact USD", () => {
    expect(formatCompactUsd(672_782_776)).toBe("$672.8M");
  });

  it("formats calendar dates without timezone drift", () => {
    expect(formatDate("2024-03-01")).toBe("Mar 1, 2024");
  });
});
