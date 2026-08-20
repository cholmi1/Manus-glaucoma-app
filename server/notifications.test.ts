import { describe, expect, it } from "vitest";
import { rentalNotificationLevel } from "./notifications";

describe("대여 기기 알림 단계", () => {
  const today = "2026-08-20";
  it("D-3, D-1, 당일, 연체, 수신 중단 단계를 정확히 구분한다", () => {
    expect(rentalNotificationLevel("2026-08-23", today)).toBe("d3");
    expect(rentalNotificationLevel("2026-08-21", today)).toBe("d1");
    expect(rentalNotificationLevel("2026-08-20", today)).toBe("d0");
    expect(rentalNotificationLevel("2026-08-19", today)).toBe("overdue");
    expect(rentalNotificationLevel("2026-08-16", today)).toBe("blocked");
  });
});
