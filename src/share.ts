import { IGraph } from "./type";
export const toNodeId = <T>(n: T) => n;
export const fromNodeId = <T>(n: T) => n;
export const nullthrows = <T>(
  n: T | null | undefined,
  info?: string
): NonNullable<T> => {
  return n as any;
};

export function assertHasNode<T>(graph: IGraph<T>, nodeId: number) {
  if (!graph.hasNode(nodeId)) {
    throw new Error("Does not have node " + nodeId);
  }
}

export function interpolate(x: number, y: number, t: number): number {
  return x + (y - x) * Math.min(1, Math.max(0, t));
}

// From https://gist.github.com/badboy/6267743#32-bit-mix-functions
export function hash32shift(key: number): number {
  key = ~key + (key << 15); // key = (key << 15) - key - 1;
  key = key ^ (key >> 12);
  key = key + (key << 2);
  key = key ^ (key >> 4);
  key = key * 2057; // key = (key + (key << 3)) + (key << 11);
  key = key ^ (key >> 16);
  return key;
}

export const assert = (v: unknown, msg?: string | Error) => {
  if (!v) {
    if (msg instanceof Error) throw msg;
    throw new Error(msg);
  }
};
