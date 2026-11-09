/** Browser-only writes must not be triggered by another site's page. */
export function checkBrowserWriteRequest(
  request: Request,
  contentType?: "application/json",
): Response | null {
  const origin = request.headers.get("origin");
  // HTTPS proxies may forward to HTTP on loopback; compare the browser's host,
  // including its port, rather than the internal request URL's origin.
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim();
  const host =
    forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const originUrl = origin && URL.canParse(origin) ? new URL(origin) : null;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin &&
      (!originUrl ||
        !["http:", "https:"].includes(originUrl.protocol) ||
        origin !== originUrl.origin ||
        originUrl.host !== host))
  ) {
    return Response.json(
      { error: "この操作はアプリの画面から実行してください。" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    contentType &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      contentType
  ) {
    return Response.json(
      { error: "Content-Typeにapplication/jsonを指定してください。" },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }
  // Headerless non-browser clients remain supported; this is a CSRF guard,
  // not authentication. Muse APIs enforce their own Bearer scopes separately.
  return null;
}
