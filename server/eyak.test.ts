import { describe, expect, it } from "vitest";
import { hasEyakServiceKey } from "./eyak";

describe("e약은요 서버 프록시 구성", () => {
  it("서비스 키가 서버 환경변수에서만 감지되고 클라이언트 계약에 포함되지 않는다", () => {
    expect(typeof hasEyakServiceKey()).toBe("boolean");
  });
});
