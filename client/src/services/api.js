export class ApiError extends Error {
  constructor(message, { status = 0, details, body, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.body = body;
  }
}

export function createApiClient(baseUrl = '/api', fetcher = (...args) => fetch(...args)) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return async (path, options = {}) => {
    if (/^(?:[a-z]+:)?\/\//i.test(path)) throw new TypeError('Use an API-relative path.');
    const { body, headers, ...rest } = options;
    const requestHeaders = new Headers(headers);
    requestHeaders.set('Accept', 'application/json');
    const json =
      body !== undefined &&
      body !== null &&
      (Array.isArray(body) || Object.getPrototypeOf(body) === Object.prototype);
    if (json) requestHeaders.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetcher(`${base}/${path.replace(/^\/+/, '')}`, {
        ...rest,
        headers: requestHeaders,
        body: json ? JSON.stringify(body) : body,
        credentials: 'include',
      });
    } catch (cause) {
      if (cause.name === 'AbortError') throw cause;
      throw new ApiError('Cannot reach the server. Please try again.', { cause });
    }
    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new ApiError(
          response.ok
            ? 'The server returned an invalid response.'
            : `Request failed (${response.status}).`,
          { status: response.status },
        );
      }
    }
    if (!response.ok) {
      const fieldErrors = Object.entries(payload?.details?.fieldErrors || {}).flatMap(
        ([field, messages]) => messages.map((message) => `${field}: ${message}`),
      );
      const message =
        typeof payload?.error === 'string'
          ? payload.error
          : `Request failed (${response.status}).`;
      throw new ApiError(
        fieldErrors.length ? `${message}. ${fieldErrors.join('; ')}` : message,
        {
          status: response.status,
          details: payload?.details,
          body: payload,
        },
      );
    }
    return payload;
  };
}

export const api = createApiClient(import.meta.env?.VITE_API_BASE_URL || '/api');
