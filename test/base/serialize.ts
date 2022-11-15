import { Graph } from "../../src";

import { it, assert, describe } from "vitest";
export function testGraph() {
  describe("Graph", () => {
    it("serialize", () => {
      const graph = new Graph();
      const n = 10;
      for (let i = 0; i < n; i++) {
        graph.addNode(i);
      }
      for (let i = 1; i < n; i++) {
        for (let j = 1; j < n; j++) {
          if (i !== j) {
            graph.addEdge(i, j);
          }
        }
      }
      const data = graph.serialize();
      const copy = Graph.deserialize(data);
      assert.deepEqual(data, copy.serialize());
    });
  });
}
