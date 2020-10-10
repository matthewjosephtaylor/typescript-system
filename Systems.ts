import { Bytes } from "byte/Bytes";
import { clarify } from "explain/Explains";
import { trace } from "explain/Tracer";
import { firstValue } from "object/Objects";
import { createIpfsSystem } from "system/IpfsSystem";
import { createMfsSystem } from "system/MfsSystem";
import { UrlString } from "texture/Textures";
import { createNodeSystem } from "./NodeSystem";

export type ReadOptions = {
  timeoutMillis?: number;
  encoding?: "utf8" | null;
  flag?: "r";
};
export type WriteOptions = {
  timeoutMillis?: number;
  mode?: number;
  flag?: "w" | "wx";
};
export type System = {
  env: (key: string, value?: string) => string;
  name: () => string;
  selectSystems: (predicate: (system: System) => boolean) => System[];
  subSystem: (sub: string) => System;
  exit: (code: number) => void;
  cwd: () => string;
  homedir: () => string;
  readFile: (path: string, options?: ReadOptions) => Promise<Bytes>;
  writeFile: (
    bytes: Bytes,
    path?: string,
    options?: WriteOptions
  ) => Promise<string>;
};

export enum SystemScheme {
  ipfs = "ipfs:",
  file = "file:",
  mfs = "mfs:",
}

export function createSystem(
  systemName: string,
  urlStringOrUrl: UrlString | URL
): System {
  return clarify(`createSystem: url: ${urlStringOrUrl}`, () => {
    let url =
      urlStringOrUrl instanceof URL ? urlStringOrUrl : new URL(urlStringOrUrl);
    const scheme = url.protocol;
    switch (scheme) {
      case SystemScheme.ipfs: {
        return createIpfsSystem(systemName, url);
      }
      case SystemScheme.mfs: {
        return createMfsSystem(systemName, url);
      }
      case SystemScheme.file: {
        return createNodeSystem(systemName, url);
      }
      default: {
        throw new Error(
          `Unable to create remote system from scheme: ${scheme}, valid schemes: ${Object.keys(
            SystemScheme
          )}`
        );
      }
    }
  });
}

export function urlToFileSystemBase(url: URL): string {
  return clarify(`urlTofFileSystemBase: url: ${url}`, () => {
    const hostname = url.hostname;
    const pathname = url.pathname;
    if (hostname !== undefined && hostname !== "") {
      return [hostname, pathname].join("/");
    }
    return pathname;
  });
}

export function joinToBase(base: string, path: string): string {
  if (base === "") {
    return path;
  }
  if (path === undefined) {
    return base;
  }
  return [base, path].join("/");
}

export function nameMaybeToSelectedSystem(
  system: System,
  systemNameMaybe: string,
  subNameMaybe?: string
): System {
  const resultSystem =
    systemNameMaybe === undefined
      ? system
      : firstValue(
          system.selectSystems((sys) => {
            const systemName =
              subNameMaybe !== undefined
                ? [systemNameMaybe, subNameMaybe].join("/")
                : systemNameMaybe;
            trace(() => `checking ${sys.name()} match against ${systemName}`);
            return sys.name().startsWith(systemName);
          })
        );
  if (resultSystem === undefined) {
    throw new Error(`No system found for systemName: ${systemNameMaybe}`);
  }
  return resultSystem;
}
