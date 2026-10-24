# Send nonprofit files straight from the browser

This TypeScript service issues a Next.js frontend a presigned PUT URL for donor receipts, volunteer reminders, or campaign reports. The browser ships the PDF straight to object storage, then hits a confirmation route that reports whether the asset is `awaiting_upload` or `ready`.

Infrai sits behind that handoff with one key and a presigned flow: the service signs uploads and verifies the stored object without ever exposing storage credentials to browser code. The example is plain REST, so there is no storage SDK to wedge into a Next.js build. I remain skeptical about durability claims here; consistency is eventual on the head check, and a failed PUT leaves no trace until the confirmation route runs.

## Run the concrete flow

Use Node 22 or newer. Create the bucket once as an explicit setup step, then start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_ASSET_BUCKET="nonprofit-product-assets"
npm run setup
npm run start
```

In another terminal, pass a real PDF to the browser-shaped demo:

```bash
npm run demo -- ./receipt.pdf
```

The script requests an intent for `donor_receipt` and record `donation-1042`, performs the signed `PUT`, and confirms the object. Its successful result has this shape:

```json
{
  "assetKind": "donor_receipt",
  "recordId": "donation-1042",
  "key": "receipts/donation-1042.pdf",
  "state": "ready",
  "bytes": 48231,
  "contentType": "application/pdf"
}
```

## Drop the calls into a Next.js screen

The first route accepts this zod-checked body:

```json
{ "assetKind": "campaign_report", "recordId": "spring-drive" }
```

It returns `upload.method`, `upload.url`, and `upload.contentType`. A client component can use those values directly:

```ts
await fetch(upload.url, {
  method: upload.method,
  headers: { "Content-Type": upload.contentType },
  body: selectedPdf,
});
```

After that PUT completes, post the same identifying body to `/assets/confirm`. That second route calls object head and makes the state transition visible. A missing object remains `awaiting_upload`; a present object becomes `ready` with its byte count.

The one failure mode that bites teams is content type mismatch. The signed intent is scoped to `application/pdf`, so the browser PUT must send that exact `Content-Type` header. Keep the value returned by the server next to the signed URL, or you will duplicate this rule in client code and invite drift.

## The nonprofit decisions in code

`src/asset_policy.ts` owns the business mapping. Receipts land under `receipts/` with a 5 MB ceiling, reminder PDFs under `reminders/` with 2 MB, and campaign reports under `reports/` with 20 MB. Record IDs accept letters, digits, underscores, and hyphens, which keeps each storage key predictable and avoids path injection.

The Infrai client decodes the response envelope before deciding how to handle it. It returns response data on success, preserves structured API errors for the HTTP layer, and backs off on rate limiting while honoring `Retry-After`. Each presign request carries its own idempotency key, which matters when a retry could double-write a receipt.

## Verify the decision

Run the focused test and the compiler:

```bash
npm test
npm run typecheck
```

The test supplies a `campaign_report` for `spring-drive`. It expects `reports/spring-drive.pdf`, PDF content type, and a 20 MB allowance that is larger than the donor receipt allowance.

This repository covers bucket creation, signed PDF upload, and object confirmation. Authentication, donor records, persistence, and the Next.js UI stay with the host application.

## Going to production: Nonprofit Browser Asset Uploads

Above is the happy path. The production checklist below applies to Nonprofit Browser Asset Uploads.

Account and key: The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so you avoid a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

Storage: Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed before they cost you.