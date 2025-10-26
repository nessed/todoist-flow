import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "./_session";
import { fetchTodoistProfile } from "./_todoist";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  try {
    const profile = await fetchTodoistProfile(session.accessToken);
    return res.status(200).json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    return res.status(500).json({ error: message });
  }
}

