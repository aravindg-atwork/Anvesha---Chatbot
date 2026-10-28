export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin', headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    } });
  } catch {
    throw new ApiError('The local backend could not be reached. Start Docker Compose and retry.', 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : null;
    throw new ApiError(body?.error || detail || (response.status === 422 ? 'Some information is invalid or exceeds the allowed size.' : `The backend returned an error (${response.status}).`), response.status);
  }
  return body as T;
}
