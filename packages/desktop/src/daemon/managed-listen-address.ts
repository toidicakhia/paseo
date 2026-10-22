import { createServer } from "node:net";
import { readPersistedConfig, savePersistedConfig } from "@getpaseo/server/configuration";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 6767;
const DEFAULT_LISTEN = `${DEFAULT_HOST}:${DEFAULT_PORT}`;
const FALLBACK_PORT_ATTEMPTS = 100;

export interface ManagedListenAddressDeps {
  readConfig: typeof readPersistedConfig;
  saveConfig: typeof savePersistedConfig;
  isPortAvailable: (port: number) => Promise<boolean>;
  allocatePort: () => Promise<number>;
}

function isDefaultLoopbackListen(listen: string): boolean {
  const normalized = listen.trim().toLowerCase();
  return normalized === DEFAULT_LISTEN || normalized === `localhost:${DEFAULT_PORT}`;
}

export function probeLoopbackPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    let settled = false;
    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      resolve(available);
    };
    server.once("error", () => finish(false));
    server.listen({ port, host: DEFAULT_HOST, exclusive: true }, () => {
      server.close(() => finish(true));
    });
  });
}

export function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ port: 0, host: DEFAULT_HOST }, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address !== null) {
          resolve(address.port);
          return;
        }
        reject(new Error("Could not allocate a loopback port."));
      });
    });
  });
}

async function findFallbackPort(
  isPortAvailable: (port: number) => Promise<boolean>,
  allocatePort: () => Promise<number>,
): Promise<number> {
  for (let offset = 1; offset <= FALLBACK_PORT_ATTEMPTS; offset += 1) {
    const port = DEFAULT_PORT + offset;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return await allocatePort();
}

export async function ensureDesktopManagedListenAddress(
  home: string,
  overrides: Partial<ManagedListenAddressDeps> = {},
): Promise<string> {
  const readConfig = overrides.readConfig ?? readPersistedConfig;
  const saveConfig = overrides.saveConfig ?? savePersistedConfig;
  const isPortAvailable = overrides.isPortAvailable ?? probeLoopbackPort;
  const allocatePort = overrides.allocatePort ?? allocateLoopbackPort;

  const configured = readConfig(home).daemon?.listen?.trim();
  if (configured && !isDefaultLoopbackListen(configured)) {
    return configured;
  }

  if (await isPortAvailable(DEFAULT_PORT)) {
    return configured ?? DEFAULT_LISTEN;
  }

  const port = await findFallbackPort(isPortAvailable, allocatePort);
  const listen = `${DEFAULT_HOST}:${port}`;
  const config = readConfig(home, { defaultsIfMissing: true });
  saveConfig(home, {
    ...config,
    daemon: {
      ...config.daemon,
      listen,
    },
  });
  return listen;
}
