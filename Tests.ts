import { IPFS_SYSTEM_TEST } from "system/IpfsSystem";
import { MFS_SYSTEM_TEST } from "system/MfsSystem";
import { runTests } from "test/Test";

export const SYSTEM_TEST_RESULTS = runTests(
  [IPFS_SYSTEM_TEST, MFS_SYSTEM_TEST],
  5 * 1000
);
