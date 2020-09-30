import { System } from "./Systems";

export function createDenoSystem(): System {
  return {
    exit: (code) => Deno.exit(code),
  };
}
