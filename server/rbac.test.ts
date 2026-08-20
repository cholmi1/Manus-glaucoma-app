import { describe, expect, it } from "vitest";
import { hasCapability, hasRole } from "./rbac";

describe("역할 기반 접근 제어", () => {
  it("patient는 본인 기록 권한만 가지고 physician은 진료 권한을 가진다", () => {
    expect(hasRole("patient", ["patient"])).toBe(true);
    expect(hasRole("patient", ["physician", "admin"])).toBe(false);
    expect(hasCapability("patient", "iop:upload:self")).toBe(true);
    expect(hasCapability("patient", "iop:exclude")).toBe(false);
    expect(hasCapability("physician", "iop:exclude")).toBe(true);
  });

  it("educator는 진료 기록 변경 권한이 없고 admin은 사용자 관리 권한을 가진다", () => {
    expect(hasCapability("educator", "target:set")).toBe(false);
    expect(hasCapability("educator", "education:manage")).toBe(true);
    expect(hasCapability("admin", "member:manage")).toBe(true);
  });
});
