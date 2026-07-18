import { AppError } from "@/lib/errors/app-error";

export function assertPublicHttpsUrl(value: string) {
  if (!isPublicHttpsUrl(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "公開HTTPS URLのみ調査ソースに登録できます。",
      400,
    );
  }
}

export function isPublicHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    hostname !== "localhost" &&
    !hostname.endsWith(".local") &&
    !isPrivateIpLiteral(hostname)
  );
}

function isPrivateIpLiteral(hostname: string) {
  if (hostname === "::1" || hostname === "[::1]") return true;
  if (
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  ) {
    return true;
  }
  const private172 = /^172\.(\d{1,3})\./.exec(hostname);
  return Boolean(
    private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31,
  );
}
