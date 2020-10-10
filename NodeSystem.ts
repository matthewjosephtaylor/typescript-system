import {
  joinToBase,
  System,
  SystemScheme,
  urlToFileSystemBase,
  WriteOptions,
} from "./Systems";
import fs from "fs";
import os from "os";
import { Bytes, bytesToBuffer } from "byte/Bytes";
import { clarify, explain } from "explain/Explains";
import { ugly } from "log/Logs";

/**
 * process::cwd looks like 'C:\foo\bar in windows'
 * This makes it look like `\foo\bar`
 */
export function portableCwd(): string {
  const nodeCwd = process.cwd();
  const winParts = nodeCwd.split(":");
  if (winParts.length === 1) {
    return nodeCwd;
  }
  return winParts.slice(1).join("/");
}

export function createNodeSystem(
  systemName: string,
  baseUrl: URL = new URL(`file:///${portableCwd()}`)
): System {
  return clarify(`createNodeSystem: baseUrl: ${baseUrl}`, () => {
    if (baseUrl.protocol !== SystemScheme.file) {
      throw new Error(
        `wrong scheme to create NodeSystem, scheme: ${baseUrl.protocol}`
      );
    }
    const base = urlToFileSystemBase(baseUrl);
    return {
      env: (key, valueMaybe) => {
        if (valueMaybe === undefined) {
          return process.env[key];
        }
        return (process.env[key] = valueMaybe);
      },
      selectSystems: () => {
        throw new Error("selectSystem not implemented");
      },
      subSystem: (sub) =>
        createNodeSystem(
          [systemName, sub].join("/"),
          new URL(`file://${base}/${sub}`)
        ),
      name: () => systemName,
      exit: (code) => process.exit(code),
      cwd: () => process.cwd(),
      homedir: () => os.homedir(),
      readFile: (path, options) =>
        explain(
          `nodeSystem: ${systemName} readFile: path: ${path} options: ${ugly(
            options
          )}`,
          fs.promises
            .readFile(joinToBase(base, path), options)
            .then(Buffer.from)
        ),
      writeFile: (bytes, path, options) =>
        explain(
          `nodeSystem: ${systemName} writeFile: bytes: ${typeof bytes} path: ${path} options: ${ugly(
            options
          )}`,
          writeFileRecursive(joinToBase(base, path), bytes, options)
        ),
    };
  });
}

function writeFileRecursive(
  path: string,
  bytes: Bytes,
  options: WriteOptions
): Promise<string> {
  const pathParts = path.split("/");
  const dirMaybe = pathParts.length === 1 ? undefined : pathParts.slice(0, -1);
  let dirConstructor: Promise<string> = undefined;
  if (dirMaybe === undefined) {
    dirConstructor = Promise.resolve("");
  } else {
    dirConstructor = fs.promises.mkdir(dirMaybe.join("/"), {
      recursive: true,
    });
  }
  return explain(
    `writeFileRecursive: path: ${path} options: ${ugly(options)}`,
    dirConstructor.then(() =>
      bytesToBuffer(bytes)
        .then((buffer) => {
          return fs.promises.writeFile(path, buffer, options);
        })
        .then(() => path)
    )
  );
}
