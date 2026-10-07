import { infrai } from "./infrai_storage.js";

const bucket = process.env.INFRAI_ASSET_BUCKET ?? "nonprofit-product-assets";

await infrai.storage.bucket.create(bucket);
console.log(`Storage bucket ready: ${bucket}`);
