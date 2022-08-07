import { IGraph } from "@parcel-graph/type";
import { it, assert, describe } from "vitest";
export function test(Graph: new <T>() => IGraph<T>) {
  describe("AdjacencyList", () => {
    it("constructor should initialize an empty graph", () => {
      const graph = new Graph();
      const id = graph.addNode(1);
      assert(id === 0);
    });
  });
}
