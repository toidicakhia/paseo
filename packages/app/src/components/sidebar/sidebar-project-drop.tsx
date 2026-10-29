import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { resolveDroppedItemPath } from "@/components/file-drop/dropped-paths";
import type { DroppedItem } from "@/components/file-drop/types";
import { useFileDrop } from "@/components/file-drop/use-file-drop";
import { useToast } from "@/contexts/toast-context";
import { getDesktopHost } from "@/desktop/host";
import { getOpenProjectFailureReason } from "@/hooks/open-project";
import { useLocalDaemonServerId } from "@/hooks/use-is-local-daemon";
import { useOpenProject } from "@/hooks/use-open-project";

/**
 * Adds local folders dropped anywhere on the workspace list as projects. Folder paths only
 * exist on the machine running the desktop app, so the feature is limited to its local daemon.
 */
export function SidebarProjectDropSink() {
  const { t } = useTranslation();
  const toast = useToast();
  const localServerId = useLocalDaemonServerId();
  const openProject = useOpenProject(localServerId);

  const handleDroppedFiles = useCallback(
    async (items: DroppedItem[]) => {
      const bridge = getDesktopHost();
      const paths = Array.from(
        new Set(
          items.flatMap((item) => {
            const path = resolveDroppedItemPath(item, bridge);
            return path ? [path] : [];
          }),
        ),
      );

      for (const path of paths) {
        try {
          const result = await openProject(path);
          if (result.ok) {
            continue;
          }
          const reason = getOpenProjectFailureReason(result);
          toast.error(
            t(
              reason === "directory_not_found"
                ? "projectPicker.errors.directory_not_found"
                : "projectPicker.errors.open_failed",
            ),
          );
        } catch {
          toast.error(t("projectPicker.errors.open_failed"));
        }
      }
    },
    [openProject, t, toast],
  );

  useFileDrop({ onGenericFiles: handleDroppedFiles }, { disabled: !localServerId });
  return null;
}
