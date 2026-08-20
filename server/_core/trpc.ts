import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { AppRole } from "../../drizzle/schema";
import { hasRole } from "../rbac";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.user.isActive || (ctx.user.lockedUntil && ctx.user.lockedUntil > new Date())) {
    throw new TRPCError({ code: "FORBIDDEN", message: "현재 계정은 사용할 수 없습니다." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export function roleProcedure(allowedRoles: AppRole[]) {
  return protectedProcedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      const actor = ctx.user!;
      if (!hasRole(actor.role as AppRole, allowedRoles)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "이 작업을 수행할 권한이 없습니다." });
      }
      return next({ ctx: { ...ctx, user: actor } });
    })
  );
}

export const patientProcedure = roleProcedure(["patient"]);
export const clinicianProcedure = roleProcedure(["physician", "admin"]);
export const educatorProcedure = roleProcedure(["educator", "physician", "admin"]);
export const adminProcedure = roleProcedure(["admin"]);
