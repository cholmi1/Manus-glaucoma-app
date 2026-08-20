import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { provisionSupabaseUser } from "../db";
import { getSupabaseAuthClient } from "../supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const authorization = opts.req.headers.authorization;
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (token) {
    try {
      const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
      if (!error && data.user) {
        user = await provisionSupabaseUser({ id: data.user.id, email: data.user.email, name: typeof data.user.user_metadata.full_name === "string" ? data.user.user_metadata.full_name : null });
      }
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
