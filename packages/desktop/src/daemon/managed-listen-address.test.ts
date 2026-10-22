import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPersistedConfig, savePersistedConfig } from "@getpaseo/server/configuration";
import {
  allocateLoopbackPort,
  ensureDesktopManagedListenAddress,
  probeLoopbackPort,
} from "./managed-listen-address";

describe("ensureDesktopManagedListenAddress", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(path.join(tmpdir(), "paseo-managed-listen-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("keeps an explicitly configured non-default listen address", async () => {
    savePersistedConfig(home, { daemon: { listen: "0.0.0.0:7000" } });
    const isPortAvailable = vi.fn(async () => false);

    const listen = await ensureDesktopManagedListenAddress(home, { isPortAvailable });

    expect(listen).toBe("0.0.0.0:7000");
    expect(isPortAvailable).not.toHaveBeenCalled();
  });

  it("keeps the default listen address when its port is free", async () => {
    const saveConfig = vi.fn(savePersistedConfig);

    const listen = await ensureDesktopManagedListenAddress(home, {
      isPortAvailable: async () => true,
      saveConfig,
    });

    expect(listen).toBe("127.0.0.1:6767");
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("moves to the next loopback port and persists it when 6767 is taken", async () => {
    const listen = await ensureDesktopManagedListenAddress(home, {
      isPortAvailable: async (port) => port !== 6767,
    });

    expect(listen).toBe("127.0.0.1:6768");
    expect(readPersistedConfig(home).daemon?.listen).toBe("127.0.0.1:6768");
  });

  it("preserves other persisted settings when saving the fallback port", async () => {
    savePersistedConfig(home, { daemon: { listen: "127.0.0.1:6767", relay: { enabled: true } } });

    await ensureDesktopManagedListenAddress(home, {
      isPortAvailable: async (port) => port !== 6767,
    });

    expect(readPersistedConfig(home).daemon).toMatchObject({
      listen: "127.0.0.1:6768",
      relay: { enabled: true },
    });
  });

  it("treats localhost:6767 as replaceable", async () => {
    savePersistedConfig(home, { daemon: { listen: "localhost:6767" } });

    const listen = await ensureDesktopManagedListenAddress(home, {
      isPortAvailable: async (port) => port !== 6767,
    });

    expect(listen).toBe("127.0.0.1:6768");
  });

  it("scans past ports that are already in use", async () => {
    const listen = await ensureDesktopManagedListenAddress(home, {
      isPortAvailable: async (port) => port >= 6770,
    });

    expect(listen).toBe("127.0.0.1:6770");
  });

  it("allocates an ephemeral port when the fallback range is exhausted", async () => {
    const listen = await ensureDesktopManagedListenAddress(home, {
      isPortAvailable: async () => false,
      allocatePort: async () => 54001,
    });

    expect(listen).toBe("127.0.0.1:54001");
    expect(readPersistedConfig(home).daemon?.listen).toBe("127.0.0.1:54001");
  });
});

describe("loopback port probes", () => {
  it("reports an occupied port and frees it after the listener closes", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, "127.0.0.1", resolve));
    const address = blocker.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected a TCP address");
    }

    expect(await probeLoopbackPort(address.port)).toBe(false);

    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    expect(await probeLoopbackPort(address.port)).toBe(true);
  });

  it("allocates a loopback port", async () => {
    const port = await allocateLoopbackPort();

    expect(port).toBeGreaterThan(0);
    expect(await probeLoopbackPort(port)).toBe(true);
  });
});
