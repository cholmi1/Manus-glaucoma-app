import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("interactive authentication entrypoint", () => {
  it("does not register legacy Manus OAuth routes", () => {
    const entrypoint = readFileSync(
      resolve(process.cwd(), "server/_core/index.ts"),
      "utf8"
    );

    expect(entrypoint).not.toContain('from "./oauth"');
    expect(entrypoint).not.toContain("registerOAuthRoutes");
    expect(entrypoint).toContain('"/api/scheduled/rental-notifications"');
  });
});
