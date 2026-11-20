export async function wiseGet(token, path, query = {}) {
  if (!/^\/(?:v[1-9]\d*|\d{4}Q[1-4])\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?$/.test(path)) {
    throw new Error("Use a versioned Wise API path without a query string.");
  }

  const url = new URL(path, "https://api.wise.com");
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, String(item));
    }
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  return {
    content: [{ type: "text", text: `Wise HTTP ${response.status}\n${body.replaceAll(token, "[redacted]")}` }],
    isError: !response.ok,
  };
}
