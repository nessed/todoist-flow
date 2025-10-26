import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TodoistConfigError, buildAuthorizeUrl } from "./_todoist";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;

  if (!state) {
    return res.status(400).json({ error: "Missing state" });
  }

  try {
    const url = buildAuthorizeUrl(state, scope);
    return res.status(200).json({ authorizeUrl: url });
  } catch (error) {
    if (error instanceof TodoistConfigError) {
      return res
        .status(503)
        .json({ error: error.message, missing: error.missing });
    }
    const message = error instanceof Error ? error.message : "Failed to build authorize URL";
    return res.status(500).json({ error: message });
  }
}

