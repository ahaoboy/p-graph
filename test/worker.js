const { parentPort } = require("worker_threads");
const { AdjacencyList, NodeTypeMap, EdgeTypeMap } = require("../dist/cjs");
parentPort.once("message", (serialized) => {
  let graph = AdjacencyList.deserialize(serialized);
  serialized.nodes.forEach((v, i) => {
    if (i < NodeTypeMap._HEADER_SIZE) return;
    serialized.nodes[i] = v * 2;
  });
  serialized.edges.forEach((v, i) => {
    if (i < EdgeTypeMap._HEADER_SIZE) return;
    serialized.edges[i] = v * 2;
  });
  parentPort.postMessage(graph.serialize());
});
