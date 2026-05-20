const PREVIEW_SMOKE_URLS = [
  "/",
  "/help",
  "/contact",
  "/waitlist",
  "/api/health",
  "/offline",
];

async function main() {
  const baseUrl = process.env.PREVIEW_URL ?? "http://localhost:3000";
  let failed = false;

  for (const path of PREVIEW_SMOKE_URLS) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { method: "HEAD" });
      if (!res.ok && res.status !== 405) {
        console.error(`FAIL ${path}: ${res.status}`);
        failed = true;
      } else {
        console.log(`OK ${path}`);
      }
    } catch (err) {
      console.error(`FAIL ${path}: ${err}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log("Preview smoke test passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
