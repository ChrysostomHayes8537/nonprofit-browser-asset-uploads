import { readFile } from "node:fs/promises";

const serviceUrl = process.env.SERVICE_URL ?? "http://localhost:3000";
const pdfPath = process.argv[2];
if (!pdfPath) throw new Error("Pass a PDF path: npm run demo -- ./receipt.pdf");

const requestBody = { assetKind: "donor_receipt", recordId: "donation-1042" };
const intentResponse = await fetch(`${serviceUrl}/assets/upload-intents`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
});
if (!intentResponse.ok) throw new Error(await intentResponse.text());
const intent = (await intentResponse.json()) as {
  upload: { method: "PUT"; url: string; contentType: string };
};

const uploadResponse = await fetch(intent.upload.url, {
  method: intent.upload.method,
  headers: { "Content-Type": intent.upload.contentType },
  body: await readFile(pdfPath),
});
if (!uploadResponse.ok) throw new Error(`Upload returned HTTP ${uploadResponse.status}`);

const confirmResponse = await fetch(`${serviceUrl}/assets/confirm`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
});
if (!confirmResponse.ok) throw new Error(await confirmResponse.text());
console.log(await confirmResponse.json());
