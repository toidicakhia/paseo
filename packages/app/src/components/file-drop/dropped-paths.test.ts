import { describe, expect, it, vi } from "vitest";
import type { DesktopHostBridge } from "@/desktop/host";
import { resolveDroppedItemPath } from "./dropped-paths";

function fakeFile(name: string, legacyPath?: string): File {
  const file = { name } as File;
  if (legacyPath) {
    Reflect.set(file, "path", legacyPath);
  }
  return file;
}

describe("resolveDroppedItemPath", () => {
  it("returns desktop paths as-is", () => {
    expect(resolveDroppedItemPath({ kind: "desktop-path", path: "/Users/me/project" }, null)).toBe(
      "/Users/me/project",
    );
  });

  it("asks the desktop bridge for a dropped file path", () => {
    const getPathForFile = vi.fn(() => "/Users/me/project");
    const bridge: DesktopHostBridge = { webUtils: { getPathForFile } };
    const file = fakeFile("project");

    expect(resolveDroppedItemPath({ kind: "web-file", file }, bridge)).toBe("/Users/me/project");
    expect(getPathForFile).toHaveBeenCalledWith(file);
  });

  it("falls back to the legacy File.path property", () => {
    const bridge: DesktopHostBridge = {
      webUtils: {
        getPathForFile: () => {
          throw new Error("unavailable");
        },
      },
    };

    expect(
      resolveDroppedItemPath(
        { kind: "web-file", file: fakeFile("project", "/Users/me/legacy") },
        bridge,
      ),
    ).toBe("/Users/me/legacy");
  });

  it("returns null when no local path is available", () => {
    expect(
      resolveDroppedItemPath({ kind: "web-file", file: fakeFile("project") }, null),
    ).toBeNull();
    expect(resolveDroppedItemPath({ kind: "desktop-path", path: "  " }, null)).toBeNull();
  });
});
