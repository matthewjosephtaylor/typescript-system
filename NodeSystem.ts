import { System } from "./Systems";

export function createNodeSystem(): System {
  return {
    exit: (code) => process.exit(code),
  };
}
