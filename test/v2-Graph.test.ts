import { Graph, AdjacencyList } from "../src";
import { test } from "./base/Graph";
import { it, assert, describe } from "vitest";

test();

describe("Graph", () => {
  it("circle edge", () => {
    const g = new Graph();
    const a = g.addNode(1);
    g.addEdge(a, a, 1);
    g.addEdge(a, a, 2);
    assert.deepEqual(
      [...g.getAllEdges()],
      [
        { from: 0, to: 0, type: 1 },
        { from: 0, to: 0, type: 2 },
      ]
    );
  });
});
