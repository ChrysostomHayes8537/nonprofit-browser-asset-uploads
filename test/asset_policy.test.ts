import { describe, expect, it } from "vitest";
import { planAsset } from "../src/asset_policy.js";

describe("nonprofit asset policy", () => {
  it("gives campaign reports their own folder and the largest upload allowance", () => {
    const report = planAsset("campaign_report", "spring-drive");
    const receipt = planAsset("donor_receipt", "gift-1042");

    expect(report).toEqual({
      key: "reports/spring-drive.pdf",
      maxBytes: 20_000_000,
      contentType: "application/pdf",
    });
    expect(report.maxBytes).toBeGreaterThan(receipt.maxBytes);
  });
});
