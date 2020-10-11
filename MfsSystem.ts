import { Bytes, bytesToBuffer } from "byte/Bytes";
import { assert } from "chai";
import { bytesToContentId } from "content/LocalContents";
import { clarify, explain } from "explain/Explains";
import { trace } from "explain/Tracer";
import { ipfsClientNode } from "ipfs/client/IpfsClients";
import { createMfsInstance, MfsWriteOptions } from "ipfs/Mfs";
import { stringToBuffer } from "string/Strings";
import { urlStringToParts } from "string/Urls";
import {
  envImpl,
  joinToBase,
  System,
  SystemScheme,
  WriteOptions,
} from "system/Systems";
import { Test } from "test/Test";

const DEFAULT_IPFS_PORT = 5001;

export function createMfsSystem(systemName: string, baseUrl: URL): System {
  return clarify(
    `createMfsSystem: systemName: ${systemName}, baseUrl: ${baseUrl}`,
    () => {
      const [ipfsBase, pathBase] = urlToMfsBases(baseUrl);
      const ipfsNode = ipfsClientNode(ipfsBase);
      const mfs = createMfsInstance(ipfsNode);
      const environment = {};
      return {
        env: (key, valueMaybe) => envImpl(environment, key, valueMaybe),
        name: () => systemName,
        selectSystems: () => {
          throw new Error("selectSystem not implemented");
        },
        subSystem: (sub) =>
          createMfsSystem(
            [systemName, sub].join("/"),
            new URL([baseUrl.toString(), sub].join("/"))
          ),
        exit: (code) => () => undefined,
        cwd: () => undefined,
        homedir: () => undefined,
        readFile: (path, options) =>
          explain(
            `MfsSystem: ${systemName} readFile path: ${path} ignored options: ${options}`,
            mfs.mfsRead(joinToBase(pathBase, path))
            // mfs.readCid(path)
          ),
        writeFile: (bytes, path, options) =>
          explain(
            `MfsSystem: ${systemName} writeFile path: ${path} options: ${options}`,
            pathOrContentId(bytes, path).then((pathOrCid) => {
              const joinedPath = joinToBase(pathBase, pathOrCid);
              return mfs
                .mfsStat(joinedPath)
                .then((stat) => {
                  trace(() => [
                    `file exists, skipping writing ${pathOrCid}`,
                    stat,
                  ]);
                  return pathOrCid;
                })
                .catch((reason) => {
                  trace(() => [
                    `file does not exist, writing ${pathOrCid}`,
                    reason,
                  ]);
                  return mfs
                    .mfsWrite(
                      joinedPath,
                      bytes,
                      systemWriteOptionsToMfsWriteOptions(options)
                    )
                    .then(() => pathOrCid);
                });
            })
          ),
      };
    }
  );
}

function pathOrContentId(bytes: Bytes, path: string): Promise<string> {
  if (path !== undefined) {
    return Promise.resolve(path);
  }
  return bytesToContentId(bytes);
}

function urlToMfsBases(url: URL): [string, string] {
  const [scheme, host, portMaybe, pathArray, query] = urlStringToParts(
    url.toString()
  );
  // if (url.protocol !== SystemScheme.mfs) {
  //   throw new Error(
  //     `wrong scheme to create MfsSystem, scheme: ${url.protocol}`
  //   );
  // }
  // const hostname = url.hostname;
  // let port = url?.port;
  let port = portMaybe;
  if (portMaybe === undefined || portMaybe === "") {
    port = String(DEFAULT_IPFS_PORT);
  }
  const path = "/" + pathArray.join("/");
  return [`/dns4/${host}/tcp/${port}`, path];
}

function systemWriteOptionsToMfsWriteOptions(
  systemWriteOptions: WriteOptions
): MfsWriteOptions {
  return {
    truncate: true,
    parents: true,
    mode: systemWriteOptions?.mode,
    create: systemWriteOptions?.flag !== "wx",
  };
}

export namespace MFS_SYSTEM_TEST {
  /** NOTE: These tests assumes there is an IPFS node running here */
  const testMfsBaseUrl = new URL("mfs://localhost/mfs-system-test");
  // const testMfsBaseUrl = new URL("mfs://home-0.local/test");

  export const mfsWriteReadFileTest: Test = (pass, fail) => {
    const sys = createMfsSystem("testMfs", testMfsBaseUrl);
    const testDate = new Date();
    const expectedString = "MfsSystem Write Test on date: " + testDate;
    const expectedBuffer = stringToBuffer(expectedString);
    const testFilename = testDate + "test.txt";
    sys.writeFile(expectedBuffer, testFilename).then((filename) => {
      sys
        .readFile(filename)
        .then(bytesToBuffer)
        .then((actualBuffer) => {
          assert.strictEqual(filename, testFilename);
          trace(() => ["ACTUAL BYTES", actualBuffer]);
          trace(() => ["EXPECTED BYTES", expectedBuffer]);
          if (expectedBuffer.equals(actualBuffer)) {
            pass();
          } else {
            fail("Buffers not equal");
          }
        });
    });
  };
}
