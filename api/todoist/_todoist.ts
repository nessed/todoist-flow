const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API = "https://api.todoist.com/sync/v9";
const TODOIST_OAUTH_AUTHORIZE = "https://todoist.com/oauth/authorize";
const TODOIST_OAUTH_TOKEN = "https://todoist.com/oauth/access_token";
const TODOIST_OAUTH_REVOKE = "https://api.todoist.com/rest/v2/token/revoke";

export { TODOIST_API_BASE, TODOIST_SYNC_API, TODOIST_OAUTH_AUTHORIZE, TODOIST_OAUTH_TOKEN, TODOIST_OAUTH_REVOKE };

type TodoistProjectRaw = {
  id: string | number;
  name?: string;
  color?: string;
};

type TodoistTaskRaw = {
  id?: string | number;
  content?: string;
  project_id?: string | number;
  labels?: string[];
  priority?: number;
  due?: {
    date?: string | null;
    datetime?: string | null;
    timezone?: string | null;
  } | null;
  section_id?: string | number | null;
  url?: string;
};

type TodoistCompletedItem = {
  task_id?: string | number;
  id?: string | number;
  content?: string;
  completed_at?: string;
  project_id?: string | number;
  labels?: string[];
};

export async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    if (!response.ok && response.status >= 500 && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function fetchTodoistProfile(accessToken: string) {
  const response = await fetchWithRetry(`${TODOIST_SYNC_API}/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resource_types: "[\"user\"]" }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Authentication failed");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile (${response.status})`);
  }

  const data = await response.json();
  const profile = data?.user ?? {};
  return {
    id: profile.id?.toString?.() ?? "user",
    full_name: profile.full_name ?? profile.name ?? "Todoist user",
    email: profile.email ?? "",
    avatar_url: profile.avatar_big || profile.avatar_medium || profile.avatar_url || null,
    image_id: profile.image_id ? profile.image_id.toString() : null,
    timezone: profile.timezone ?? null,
  };
}

export async function revokeToken(accessToken: string, clientId?: string, clientSecret?: string) {
  const body = new URLSearchParams({ token: accessToken });
  if (clientId) body.append("client_id", clientId);
  if (clientSecret) body.append("client_secret", clientSecret);

  const response = await fetchWithRetry(TODOIST_OAUTH_REVOKE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  return response.ok;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const clientId = process.env.TODOIST_CLIENT_ID;
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Todoist OAuth is not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetchWithRetry(TODOIST_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange Todoist code: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error("Todoist did not return an access token");
  }
  return data.access_token as string;
}

export function getConfiguredRedirectUri() {
  const redirect = process.env.TODOIST_REDIRECT_URI;
  if (!redirect) {
    throw new Error("TODOIST_REDIRECT_URI is not configured");
  }
  return redirect;
}

export function buildAuthorizeUrl(state: string, scope?: string) {
  const clientId = process.env.TODOIST_CLIENT_ID;
  const redirectUri = process.env.TODOIST_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Todoist OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scope || "data:read,data:read_write,profile:read",
  });

  return `${TODOIST_OAUTH_AUTHORIZE}?${params.toString()}`;
}

export async function fetchTodoistProjects(accessToken: string) {
  const response = await fetchWithRetry(`${TODOIST_API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Authentication failed");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
  }

  const projects = (await response.json()) as TodoistProjectRaw[];
  return Array.isArray(projects) ? projects : [];
}

export async function fetchTodoistUpcomingTasks(accessToken: string, filter?: string) {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);

  const response = await fetchWithRetry(`${TODOIST_API_BASE}/tasks?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Authentication failed");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch tasks: ${response.status} ${errorText}`);
  }

  const tasks = (await response.json()) as TodoistTaskRaw[];
  return Array.isArray(tasks) ? tasks : [];
}

export async function fetchTodoistCompletedTasks(accessToken: string, since?: string) {
  const limit = 200;
  let offset = 0;
  const all: TodoistCompletedItem[] = [];

  while (true) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (since) params.set("since", since);

    const response = await fetchWithRetry(`${TODOIST_SYNC_API}/completed/get_all?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch completed tasks: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { items?: TodoistCompletedItem[] };
    const items = Array.isArray(data?.items) ? data.items : [];
    all.push(...items);

    if (items.length < limit) {
      break;
    }
    offset += limit;
  }

  return all;
}

