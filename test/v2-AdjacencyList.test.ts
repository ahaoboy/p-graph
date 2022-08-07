import { AdjacencyList } from "../src";
import { test } from "./base/AdjacencyList";
import { it, assert, describe } from "vitest";
test(AdjacencyList);

describe("AdjacencyList", () => {
  it("addEdge should resize edges array when necessary", () => {
    let graph = new AdjacencyList();
    let size = graph.serialize().edges.byteLength;
    let a = graph.addNode();
    let b = graph.addNode();
    graph.addEdge(a, b, 1);
    graph.addEdge(a, b, 2);
    graph.addEdge(a, b, 3);
    assert(size < graph.serialize().edges.byteLength);
    assert(graph.serialize().nodes.buffer.byteLength === 220);
  });

  it("u16", () => {
    let graph = new AdjacencyList({
      typedArray: Uint16Array,
    });
    let size = graph.serialize().edges.byteLength;
    let a = graph.addNode();
    let b = graph.addNode();
    graph.addEdge(a, b, 1);
    graph.addEdge(a, b, 2);
    graph.addEdge(a, b, 3);
    assert(size < graph.serialize().edges.byteLength);
    assert(graph.serialize().nodes.buffer.byteLength === 110);
  });

  it("u8", () => {
    let graph = new AdjacencyList({
      typedArray: Uint8Array,
    });
    let size = graph.serialize().edges.byteLength;
    let a = graph.addNode();
    let b = graph.addNode();
    graph.addEdge(a, b, 1);
    graph.addEdge(a, b, 2);
    graph.addEdge(a, b, 3);
    assert(size < graph.serialize().edges.byteLength);
    assert(graph.serialize().nodes.buffer.byteLength === 55);
  });
});
