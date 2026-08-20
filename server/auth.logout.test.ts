import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.logout", () => {
  it("Supabase 클라이언트 로그아웃 뒤 서버 종료 상태를 성공으로 반환한다", async () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      organizationId: 1,
      email: "sample@example.com",
      name: "Sample User",
      role: "patient" as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result).toEqual({ success: true });
  });
});
