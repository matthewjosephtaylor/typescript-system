import { createDenoSystem } from "./DenoSystem";
import { createNodeSystem } from "./NodeSystem";

export type System = {
  exit: (code: number) => void;
};

export function createSystem() {
  if (Deno !== undefined) {
    return createDenoSystem();
  }

  return createNodeSystem();
}
