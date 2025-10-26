import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SessionSecretMissingError, createSessionCookie } from "./_session";
import { TodoistConfigError, fetchTodoistProfile, fetchTodoistProjects } from "./_todoist";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { token } = req.body ?? {};
  if (typeof token !== "string" || token.trim().length === 0) {
    return res.status(400).json({ error: "Missing Todoist token" });
  }

  const accessToken = token.trim();

  try {
    await fetchTodoistProjects(accessToken);
    await createSessionCookie(res, { accessToken });
    const profile = await fetchTodoistProfile(accessToken).catch(() => null);
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    if (error instanceof SessionSecretMissingError) {
      return res.status(503).json({ error: error.message, missing: error.missing });
    }
    if (error instanceof TodoistConfigError) {
      return res.status(503).json({ error: error.message, missing: error.missing });
    }
    const message = error instanceof Error ? error.message : "Failed to validate token";
    return res.status(401).json({ error: message });
  }
}

