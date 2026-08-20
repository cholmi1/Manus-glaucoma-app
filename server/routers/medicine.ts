import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasEyakServiceKey, searchEyak } from "../eyak";
import { protectedProcedure, router } from "../_core/trpc";

export const medicineRouter = router({
  status: protectedProcedure.query(() => ({
    configured: hasEyakServiceKey(),
    verified: false,
    enabled: false,
    message: hasEyakServiceKey() ? "서비스 키가 감지되었지만 최소 조회 검증 전까지 약품 검색은 비활성화됩니다." : "EYAK_SERVICE_KEY를 등록하고 최소 조회를 검증하면 e약은요 약품 검색을 활성화할 수 있습니다.",
  })),
  search: protectedProcedure.input(z.object({ query: z.string().trim().min(2).max(80) })).query(async ({ input }) => {
    if (!hasEyakServiceKey()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "e약은요 검색은 서비스 키 등록 후 최소 조회 검증을 완료하면 사용할 수 있습니다." });
    try {
      return await searchEyak(input.query);
    } catch (error) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "e약은요 검색에 실패했습니다." });
    }
  }),
});
