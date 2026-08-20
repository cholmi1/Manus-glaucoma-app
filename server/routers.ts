import { COOKIE_NAME } from "@shared/const";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ensureServiceWorkspace, listOrganizationUsers, requireDb } from "./db";
import { appendAuditLog } from "./audit";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { clinicalRouter } from "./routers/clinical";
import { medicineRouter } from "./routers/medicine";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    bootstrap: protectedProcedure.mutation(async ({ ctx }) => {
      const actor = ctx.user!;
      const organization = await ensureServiceWorkspace(actor.id);
      await appendAuditLog({
        organizationId: organization.id,
        actorUserId: actor.id,
        action: "session_bootstrap",
        targetType: "user",
        targetId: String(actor.id),
      });
      return { organizationId: organization.id, role: actor.role };
    }),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  members: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const actor = ctx.user!;
      const organization = await ensureServiceWorkspace(actor.id);
      return listOrganizationUsers(organization.id);
    }),
    setRole: adminProcedure.input(z.object({ userId: z.string().uuid(), role: z.enum(["patient", "physician", "educator", "admin"]) })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await ensureServiceWorkspace(actor.id);
      if (input.userId === actor.id) throw new Error("현재 로그인한 관리자의 역할은 이 화면에서 변경할 수 없습니다.");
      const db = await requireDb();
      const target = (await db.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target || target.organizationId !== organization.id) throw new Error("같은 기관의 사용자를 찾을 수 없습니다.");
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, action: "role_changed", targetType: "user", targetId: String(input.userId), detail: { role: input.role } });
      return { success: true } as const;
    }),
    setActive: adminProcedure.input(z.object({ userId: z.string().uuid(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      const actor = ctx.user!;
      const organization = await ensureServiceWorkspace(actor.id);
      if (input.userId === actor.id) throw new Error("현재 로그인한 관리자 계정은 비활성화할 수 없습니다.");
      const db = await requireDb();
      await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
      await appendAuditLog({ organizationId: organization.id, actorUserId: actor.id, action: input.isActive ? "account_enabled" : "account_disabled", targetType: "user", targetId: String(input.userId) });
      return { success: true } as const;
    }),
  }),
  clinical: clinicalRouter,
  medicine: medicineRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
