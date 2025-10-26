import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie, requireSession } from "./_session";
import { revokeToken } from "./_todoist";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await requireSession(req, res);
  if (!session) {
    return;
  }

  const clientId = process.env.TODOIST_CLIENT_ID;
  const clientSecret = process.env.TODOIST_CLIENT_SECRET;

  try {
    await revokeToken(session.accessToken, clientId, clientSecret);
  } catch (error) {
    console.warn("[logout] Failed to revoke Todoist token", error);
  }

  clearSessionCookie(res);
  res.status(200).json({ success: true });
}

