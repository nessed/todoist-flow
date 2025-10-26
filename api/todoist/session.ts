import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readSession } from "./_session";
import { fetchTodoistProfile } from "./_todoist";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await readSession(req);
  if (!session) {
    return res.status(200).json({ authenticated: false, profile: null });
  }

  try {
    const profile = await fetchTodoistProfile(session.accessToken).catch(() => null);
    return res.status(200).json({ authenticated: true, profile });
  } catch {
    return res.status(200).json({ authenticated: true, profile: null });
  }
}

