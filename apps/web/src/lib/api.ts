/** Fetch JSON responses without turning HTTP or malformed responses into empty data. */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const payload = body as { error?: unknown; message?: unknown } | null;
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (body === null) {
    throw new Error('The server returned an invalid JSON response.');
  }

  return body as T;
}
