import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createSessionCookie, SessionSecretMissingError } from "./_session";
import {
  TodoistConfigError,
  exchangeCodeForToken,
  fetchTodoistProfile,
  getConfiguredRedirectUri,
} from "./_todoist";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { code, state } = req.body ?? {};
  if (typeof code !== "string" || code.length === 0) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  if (typeof state !== "string" || state.length === 0) {
    return res.status(400).json({ error: "Missing OAuth state" });
  }

  try {
    const redirectUri = getConfiguredRedirectUri();
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    await createSessionCookie(res, { accessToken });
    const profile = await fetchTodoistProfile(accessToken).catch(() => null);
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    if (error instanceof TodoistConfigError) {
      return res.status(503).json({ error: error.message, missing: error.missing });
    }
    if (error instanceof SessionSecretMissingError) {
      return res.status(503).json({ error: error.message, missing: error.missing });
    }
    const message = error instanceof Error ? error.message : "Failed to complete OAuth";
    return res.status(500).json({ error: message });
  }
}

