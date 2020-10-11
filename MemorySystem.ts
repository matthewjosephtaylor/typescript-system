import { Bytes } from "byte/Bytes";
import { clarify, explain } from "explain/Explains";
import {
  envImpl,
  joinToBase,
  ReadOptions,
  System,
  urlToFileSystemBase,
  WriteOptions,
} from "system/Systems";

type ByteStore = { [k in string]: Bytes };
export function createMemorySystem(
  systemName: string,
  baseUrl: URL,
  byteStore: ByteStore = {}
): System {
  const environment = {};
  const workDir = [];
  const base = urlToFileSystemBase(baseUrl);
  return {
    dump: () => byteStore,
    env: (key, valueMaybe) => envImpl(environment, key, valueMaybe),
    name: () => systemName,
    selectSystems: (sub) => {
      throw new Error("not impl");
    },
    subSystem: (sub) => {
      return createMemorySystem(
        [systemName, sub].join("/"),
        new URL(`mem://${base}/${sub}`),
        byteStore
      );
    },
    exit: (code: number) => {
      throw new Error("not impl");
    },

    cwd: () => workDir.join("/"),
    homedir: () => "/",
    readFile: (path: string, options?: ReadOptions) =>
      readFile(systemName, byteStore, joinToBase(base, path), options),
    writeFile: (bytes: Bytes, path?: string, options?: WriteOptions) =>
      writeFile(systemName, byteStore, bytes, joinToBase(base, path), options),
  };
}

function readFile(
  id: string,
  store: ByteStore,
  path: string,
  options?: ReadOptions
): Promise<Bytes> {
  return explain(
    `MemorySystem::readFile: ${id} path: ${path} options: ${options}`,
    new Promise((resolve, reject) => {
      const bytes = store[path];
      if (bytes === undefined) {
        reject(new Error(`No file found for path: ${path}`));
      }
      resolve(bytes);
    })
  );
}

function writeFile(
  id: string,
  store: ByteStore,
  bytes: Bytes,
  path?: string,
  options?: WriteOptions
): Promise<string> {
  return explain(
    `MemorySystem::writeFile: id: ${id} path: ${path} options: ${options}`,
    new Promise((resolve, reject) => {
      if (path === undefined) {
        reject(new Error(`Illegal path: ${path}`));
      }
      store[path] = bytes;
      console.log("added bytes to store", store);
      resolve(path);
    })
  );
}
