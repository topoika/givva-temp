import "server-only";

type ApiRequestOptions = RequestInit & {
  accessToken?: string;
  version?: 1 | 2;
};

export async function apiRequest(
  endpoint: string,
  { accessToken, version = 1, ...options }: ApiRequestOptions = {},
): Promise<Response> {
  const baseUrl = process.env.GIVVA_API_BASE_URL;
  const apiKey = process.env.GIVVA_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Givva API configuration is missing.");
  }

  const base = new URL(baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  if (version === 2) {
    if (!base.pathname.endsWith("/api/v1/")) throw new Error("Expected a Givva v1 API base URL.");
    base.pathname = base.pathname.replace(/v1\/$/, "v2/");
  }
  const url = new URL(endpoint.replace(/^\/+/, ""), base);
  if (base.protocol !== "https:" || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new Error("Givva API requests must use the configured HTTPS base URL.");
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-API-KEY", apiKey);
  headers.delete("Authorization");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(url, {
    ...options,
    headers,
    cache: "no-store",
    redirect: "error",
    signal: options.signal ?? AbortSignal.timeout(45_000),
  });
}
