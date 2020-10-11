import { Bytes } from "byte/Bytes";
import { clarify, explain } from "explain/Explains";
import { trace } from "explain/Tracer";
import { ugly } from "log/Logs";
import { loop, valueOrElse } from "object/Objects";
import { ReadOptions, System, WriteOptions } from "system/Systems";

type ContentId = string;

const DEFAULT_TIMEOUT = 10 * 1000;
export function createMultiSystem(
  systemName: string,
  systems: System[]
): System {
  return {
    env: () => {
      throw new Error("env not implemented for multi-system");
    },
    name: () => systemName,
    selectSystems: (predicate) =>
      clarify(
        `selectSystems: systemName: ${systemName} systems.length: ${systems.length}`,
        () => {
          return systems.filter((sys) => predicate(sys));
        }
      ),
    subSystem: (sub: string) =>
      createMultiSystem(
        [systemName, sub].join("/"),
        systems.map((sys) => sys.subSystem(sub))
      ),
    exit: (code: number) => systems.map((sys) => sys.exit(code)),
    cwd: () => systems.map((sys) => sys.cwd()).join(),
    homedir: () => systems.map((sys) => sys.homedir()).join(),
    readFile: (path: string, options?: ReadOptions) =>
      readFile(systems, path, options),
    writeFile: (bytes: Bytes, path?: string, options?: WriteOptions) =>
      writeFile(systems, bytes, path, options),
  };
}

function readFile(
  systems: System[],
  path: string,
  options?: ReadOptions
): Promise<Bytes> {
  return explain(
    `MultiSystem::readFile: path: ${path} options: ${ugly(options)}`,
    new Promise((resolve, reject) => {
      if (systems.length === 0) {
        throw new Error("No systems to read from");
      }
      const readers = systems.map((sys) => sys.readFile(path, options));
      const timeoutMillis = valueOrElse(
        options?.timeoutMillis,
        DEFAULT_TIMEOUT
      );
      const timeoutHandle = setTimeout(() => {
        reject(
          `MultiSystem::readFile timeout reading ${path} from systems ${systems
            .map((sys) => sys.name())
            .join()} timeoutMillis: ${timeoutMillis}`
        );
      }, timeoutMillis);
      loop(readers, (reader) => {
        reader
          .then((bytes) => {
            if (bytes !== undefined) {
              resolve(bytes);
              clearTimeout(timeoutHandle);
            }
          })
          .catch((reason) => {
            trace(() => `MultiSystem::readFile: ignored error ${reason}`);
          });
      });
    })
  );
}

function writeFile(
  systems: System[],
  bytes: Bytes,
  path: string,
  options?: WriteOptions
): Promise<ContentId> {
  return explain(
    `MultiSystem::writeFile: path: ${path} options: ${ugly(options)}`,
    new Promise((resolve, reject) => {
      if (systems.length === 0) {
        throw new Error("No systems to write to");
      }
      const writers = systems.map((sys) => sys.writeFile(bytes, path, options));
      const timeoutMillis = valueOrElse(
        options?.timeoutMillis,
        DEFAULT_TIMEOUT
      );
      const timeoutHandle = setTimeout(() => {
        reject(
          `MultiSystem::writeFile timeout writing path: ${path} to systems: '${systems
            .map((sys) => sys.name())
            .join()}' timeoutMillis: ${timeoutMillis}`
        );
      }, timeoutMillis);
      loop(writers, (writer) => {
        writer.then((contentId) => {
          if (bytes !== undefined) {
            resolve(contentId);
            clearTimeout(timeoutHandle);
          }
        });
        // .catch((reason) => {
        //   trace(() => `MultiSystem::writeFile: ignored error ${reason}`);
        // });
      });
    })
  );
}
