import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("핵심 접근성 구조", () => {
  it("한국어 문서 언어와 명확한 키보드 포커스 스타일을 제공한다", () => {
    expect(read("client/index.html")).toContain('<html lang="ko">');
    expect(read("client/src/index.css")).toContain(":focus-visible");
  });

  it("측정 입력은 접근성 Dialog와 레이블·상태 메시지를 사용한다", () => {
    const home = read("client/src/pages/Home.tsx");
    expect(home).toContain("DialogContent");
    expect(home).toContain("DialogTitle");
    expect(home).toContain("DialogDescription");
    expect(home).toContain('role="alert"');
    expect(home).toContain("min-h-11");
  });
});
