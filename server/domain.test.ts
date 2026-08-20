import { describe, expect, it } from "vitest";
import { calculateAdherence, deduplicateByIdempotency } from "./domain";

describe("멱등 동기화와 순응도 도메인 규칙", () => {
  it("같은 idempotencyKey를 가진 오프라인 이벤트는 한 번만 처리한다", () => {
    const events = deduplicateByIdempotency([
      { idempotencyKey: "dose-1", taken: false },
      { idempotencyKey: "dose-1", taken: true },
      { idempotencyKey: "dose-2", taken: true },
    ]);
    expect(events).toEqual([{ idempotencyKey: "dose-1", taken: false }, { idempotencyKey: "dose-2", taken: true }]);
  });

  it("순응도는 예정 이벤트를 분모로 하고 완료 이벤트를 분자로 계산한다", () => {
    expect(calculateAdherence([{ taken: true }, { taken: false }, { taken: true }, { taken: false }])).toEqual({ total: 4, taken: 2, percentage: 50 });
    expect(calculateAdherence([])).toEqual({ total: 0, taken: 0, percentage: 0 });
  });
});
