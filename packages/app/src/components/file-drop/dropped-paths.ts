import type { DesktopHostBridge } from "@/desktop/host";
import type { DroppedItem } from "./types";

function nonEmptyPath(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Resolves the client-machine path a dropped item came from, when one is available. */
export function resolveDroppedItemPath(
  item: DroppedItem,
  bridge: DesktopHostBridge | null,
): string | null {
  if (item.kind === "desktop-path") {
    return nonEmptyPath(item.path);
  }

  const getPathForFile = bridge?.webUtils?.getPathForFile;
  if (typeof getPathForFile === "function") {
    try {
      const path = nonEmptyPath(getPathForFile(item.file));
      if (path) {
        return path;
      }
    } catch {
      // Fall through to the legacy Electron File.path property if present.
    }
  }

  return nonEmptyPath(Reflect.get(item.file, "path"));
}
