export const browserHeaders = ["authorization", "apikey", "content-type", "x-client-info"];

export function preflightProblem(status, headers, origin) {
  if (status < 200 || status >= 300) return `Preflight returned HTTP ${status}`;
  const allowedOrigin = headers.get("access-control-allow-origin");
  if (allowedOrigin !== "*" && allowedOrigin !== origin) return "Origin is not allowed";
  const methods = (headers.get("access-control-allow-methods") || "")
    .split(",")
    .map((method) => method.trim().toUpperCase());
  if (!methods.includes("POST")) return "POST is not allowed";
  const allowedHeaders = (headers.get("access-control-allow-headers") || "")
    .split(",")
    .map((header) => header.trim().toLowerCase());
  const missing = browserHeaders.filter((header) => !allowedHeaders.includes(header));
  return missing.length ? `Request headers are not allowed: ${missing.join(", ")}` : null;
}
