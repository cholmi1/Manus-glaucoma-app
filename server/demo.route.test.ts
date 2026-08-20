import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("개인정보 없는 가상 시연 경로", () => {
  it("인증 없이 열 수 있는 별도 시연 경로와 역할 선택 화면을 제공한다", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const demo = readFileSync(resolve(process.cwd(), "client/src/pages/Demo.tsx"), "utf8");

    expect(app).toContain('path={"/demo"}');
    expect(demo).toContain("개인정보·실제 의료 기록 없음");
    expect(demo).toContain("환자");
    expect(demo).toContain("의사");
    expect(demo).toContain("교육담당자");
    expect(demo).toContain("관리자");
  });
});
