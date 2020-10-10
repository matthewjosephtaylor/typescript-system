import { bytesToBuffer, bytesToString } from "byte/Bytes";
import { assert } from "chai";
import { explain } from "explain/Explains";
import { enableTrace } from "explain/Tracer";
import { ipfsClientNode } from "ipfs/client/IpfsClients";
import { createIpfsContentInstance } from "ipfs/IpfsContents";
import { stringToBuffer } from "string/Strings";
import { System, SystemScheme } from "system/Systems";
import { Test } from "test/Test";

const DEFAULT_IPFS_PORT = 5001;

export function createIpfsSystem(systemName: string, baseUrl: URL): System {
  const base = urlToIpfsBase(baseUrl);
  const ipfsNode = ipfsClientNode(base);
  const ipfs = createIpfsContentInstance(ipfsNode);
  const environment = {};
  return {
    env: (key, valueMaybe) => {
      if (valueMaybe === undefined) {
        return environment[key];
      }
      return (environment[key] = valueMaybe);
    },
    name: () => systemName,
    selectSystems: () => {
      throw new Error("selectSystem not implemented");
    },
    subSystem: (sub) => createIpfsSystem([systemName, sub].join("/"), baseUrl),
    exit: () => () => undefined,
    cwd: () => undefined,
    homedir: () => undefined,
    readFile: (path, options) =>
      explain(
        `IpfsSystem: ${systemName} readFile path: ${path} options: ${options}`,
        ipfs.readCid(path)
      ),
    writeFile: (bytes, path, options) =>
      explain(
        `IpfsSystem: ${systemName} writeFile path: ${path} options: ${options}`,
        ipfs.addByteData(bytes)
      ).then((fileMeta) => fileMeta.cid.toString()),
  };
}

function urlToIpfsBase(url: URL): string {
  if (url.protocol !== SystemScheme.ipfs) {
    throw new Error(
      `wrong scheme to create IpfsSystem, scheme: ${url.protocol}`
    );
  }
  const hostname = url.hostname;
  let port = url?.port;
  if (port === undefined || port === "") {
    port = String(DEFAULT_IPFS_PORT);
  }
  // const port = valueOrElse(url?.port, "5001");
  return `/dns4/${hostname}/tcp/${port}`;
}

export namespace IPFS_SYSTEM_TEST {
  /** NOTE: These tests assumes there is an IPFS node running here */
  // const testIpfsBaseAddr = new URL("ipfs://localhost");
  const testIpfsBaseAddr = new URL("ipfs://home-0.local");

  export const ipfsWriteReadFileTest: Test = (pass) => {
    const sys = createIpfsSystem("testIpfs", testIpfsBaseAddr);
    const expectedString = "IpfsSystem Write Test on date: " + new Date();
    const expectedBuffer = stringToBuffer(expectedString);
    sys.writeFile(expectedBuffer).then((cid) => {
      sys
        .readFile(cid)
        .then(bytesToBuffer)
        .then((actualBuffer) => {
          assert.isTrue(expectedBuffer.equals(actualBuffer));
          pass();
        });
    });
  };
}
