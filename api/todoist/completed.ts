import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "./_session";
import { fetchTodoistCompletedTasks } from "./_todoist";

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

  const since = typeof req.query.since === "string" ? req.query.since : undefined;

  try {
    const items = await fetchTodoistCompletedTasks(session.accessToken, since);
    return res.status(200).json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch completed tasks";
    return res.status(500).json({ error: message });
  }
}

