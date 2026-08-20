import { describe, expect, it } from "vitest";
import { formatRemainingMinutes, remainingMagicLinkCooldown } from "../client/src/lib/magicLinkRateLimit";

describe("매직링크 재요청 제한", () => {
  it("최근 성공 요청 후 60초 이내에는 남은 대기 시간을 계산한다", () => {
    expect(remainingMagicLinkCooldown(10_000, 10_000)).toBe(60_000);
    expect(remainingMagicLinkCooldown(10_000, 70_000)).toBe(0);
    expect(formatRemainingMinutes(3_599_000)).toBe(60);
  });
});
