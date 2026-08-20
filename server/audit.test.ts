import { describe, expect, it } from "vitest";
import { createAuditEntryHash } from "./audit";

describe("감사 로그 해시 체인", () => {
  const entry = { organizationId: 1, actorUserId: 7, patientId: 11, action: "view", targetType: "iop_measurement", targetId: "55", detail: { eye: "OD", range: "7d" } };
  it("같은 이벤트는 같은 해시를, 선행 해시 또는 세부 값이 달라지면 다른 해시를 만든다", () => {
    const first = createAuditEntryHash({ ...entry, previousHash: null });
    expect(first).toHaveLength(64);
    expect(createAuditEntryHash({ ...entry, previousHash: null })).toBe(first);
    expect(createAuditEntryHash({ ...entry, previousHash: "previous" })).not.toBe(first);
    expect(createAuditEntryHash({ ...entry, previousHash: null, detail: { eye: "OS", range: "7d" } })).not.toBe(first);
  });
});
