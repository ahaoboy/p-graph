import { it, assert, describe } from "vitest";
import { Graph } from "../../src";

export function test() {
  describe("AdjacencyList", () => {
    it("constructor should initialize an empty graph", () => {
      const graph = new Graph();
      const id = graph.addNode(1);
      assert(id === 0);
    });
  });
}
