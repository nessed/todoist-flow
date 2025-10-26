import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSession } from "./_session";
import { fetchTodoistUpcomingTasks } from "./_todoist";

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

  const filter = typeof req.query.filter === "string" ? req.query.filter : undefined;

  try {
    const tasks = await fetchTodoistUpcomingTasks(session.accessToken, filter);
    return res.status(200).json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch tasks";
    return res.status(500).json({ error: message });
  }
}

