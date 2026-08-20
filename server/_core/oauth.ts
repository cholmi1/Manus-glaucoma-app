import type { Express, Request, Response } from "express";

/** Legacy callback kept only to return a clear migration message. Authentication now uses Supabase Auth in the browser. */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(410).json({ error: "Manus OAuth is disabled. Use Supabase Auth sign-in." });
  });
}
