const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

let csrfToken = "";
let csrfRequest: Promise<void> | null = null;

type ApiOptions = RequestInit & { body?: BodyInit | null };

async function loadCsrfToken(force = false) {
  if (csrfToken && !force) return;
  if (!csrfRequest) {
    csrfRequest = (async () => {
      const response = await fetch(`${API_BASE}/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          "Could not connect to FoodHub. Check that the backend is running.",
        );
      const data = (await response.json()) as { token: string };
      csrfToken = data.token;
    })();
  }
  try {
    await csrfRequest;
  } finally {
    csrfRequest = null;
  }
}

export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfToken)
    await loadCsrfToken();
  const headers = new Headers(options.headers);
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  )
    headers.set("Content-Type", "application/json");
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("X-XSRF-TOKEN", csrfToken);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    if (response.status === 403 && !csrfToken) {
      await loadCsrfToken();
    }
    const message =
      typeof data?.error === "string"
        ? data.error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function eventStream(
  path: string,
  onMessage: (event: MessageEvent) => void,
  onOpen?: () => void,
) {
  const stream = new EventSource(`${API_BASE}${path}`, {
    withCredentials: true,
  });
  stream.onmessage = onMessage;
  if (onOpen) stream.onopen = onOpen;
  [
    "order.created",
    "order.updated",
    "order.deleted",
    "request.created",
    "request.updated",
    "bill.created",
    "bill.paid",
    "tables.updated",
    "menu.updated",
    "message.created",
  ].forEach((event) =>
    stream.addEventListener(event, onMessage as EventListener),
  );
  return stream;
}

export async function login(username: string, password: string) {
  await loadCsrfToken();
  const staff = await api<{ username: string; role: StaffRole }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  );
  await loadCsrfToken(true);
  return staff;
}

export type StaffRole = "ADMIN" | "KITCHEN";
