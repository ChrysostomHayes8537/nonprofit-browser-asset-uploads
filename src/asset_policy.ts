export const assetKinds = ["donor_receipt", "volunteer_reminder", "campaign_report"] as const;
export type AssetKind = (typeof assetKinds)[number];

const limits: Record<AssetKind, number> = {
  donor_receipt: 5_000_000,
  volunteer_reminder: 2_000_000,
  campaign_report: 20_000_000,
};

const folders: Record<AssetKind, string> = {
  donor_receipt: "receipts",
  volunteer_reminder: "reminders",
  campaign_report: "reports",
};

export type AssetPlan = {
  key: string;
  maxBytes: number;
  contentType: "application/pdf";
};

export function planAsset(kind: AssetKind, recordId: string): AssetPlan {
  return {
    key: `${folders[kind]}/${recordId}.pdf`,
    maxBytes: limits[kind],
    contentType: "application/pdf",
  };
}
