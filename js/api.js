// Tiny fetch wrapper for the /api endpoints. Throws ApiError with the server's message.
export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.fields = data.fields || null;
  }
}

async function request(method, url, body, headers = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('We can’t reach the store right now. Please check your connection and try again.', 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data);
  return data;
}

export const api = {
  get: (url, headers) => request('GET', url, null, headers),
  post: (url, body, headers) => request('POST', url, body, headers),
};
