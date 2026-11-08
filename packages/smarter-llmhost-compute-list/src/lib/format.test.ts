import { describe, expect, it } from "vitest";

import { makeObject } from "@/mocks/fixtures";

import { formatPrice } from "./format";

describe("format", () => {
  it("formats the price of one node", () => {
    expect(formatPrice(makeObject(1))).toBe("$0.98/hr");
  });

  it.each([null, undefined])("shows a dash for a node without a price: %s", (pricePerHour) => {
    expect(formatPrice(makeObject(1, { pricePerHour: pricePerHour as never }))).toBe("—");
  });
});
