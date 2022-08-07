export type SerializedAdjacencyList<T> = {
  nodes: TypedArray;
  edges: TypedArray;
  edgeCapacity?: never;
  nodeCapacity?: never;
  typedArray?: TypedArrayConstructor;
};

// eslint-disable-next-line no-unused-vars
export type AdjacencyListOptions<T> = {
  nodes?: never;
  edges?: never;
  edgeCapacity?: number;
  nodeCapacity?: number;
  typedArray?: TypedArrayConstructor;
};

export type GraphOpts<N> = {
  nodes: Map<number, N>;
  adjacencyList: SerializedAdjacencyList<N>;
  rootNodeId: number;
};

export type SerializedGraph<N> = {
  nodes: Map<number, N>;
  adjacencyList: SerializedAdjacencyList<N>;
  rootNodeId: number;
};

export interface IGraph<N = number> {
  addNode: (node: N) => number;
  hasNode: (nodeId: number) => boolean;
  getNode: (id: number) => N | null;
  nodes: Map<number, N>;
  getAllEdges: () => Generator<{
    from: number;
    to: number;
    type: number;
  }>;
  addEdge: (from: number, to: number, type?: number) => boolean;
  removeEdge: (from: number, to: number, type?: number) => boolean;
  serialize: () => SerializedGraph<N>
  getNodeIdsConnectedTo: (nodeId: number, type?: number) => Array<number>;
  getNodeIdsConnectedFrom: (nodeId: number, type?: number) => Array<number>;
  hasEdge: (from: number, to: number, type?: number) => boolean;
  resizeEdges: (n: number) => boolean;

  traverse<Context>(
    visit: (node?: N, c?: Context) => void,
    startNodeId: number,
    type?: number
  ): void;

  replaceNodeIdsConnectedTo(
    fromNodeId: number,
    toNodeIds: number[],
    replaceFilter?: (nodeId: number) => boolean,
    type?: number
  ): void;

  setRootNodeId: (nodeId: number) => void;
  isOrphanedNode: (nodeId: number) => boolean;
  removeNode: (nodeId: number) => boolean;
}
export type NodeId = number;
export type TraversalActions = {
  skipChildren: () => void;
  stop: () => void;
};

export type GraphVisitor<NodeId, TContext> = any;

export const NullEdgeType = 1;
export type NullEdgeType = 1;
export type AllEdgeTypes = -1;
export const AllEdgeTypes = -1;

export type AdjacencyListStats = {
  nodes: number;
  edges: number;
  deleted: number;
};
export interface IAdjacencyList {
  stats: AdjacencyListStats;
  addNode: () => number;
  addEdge: (from: number, to: number, type?: number) => boolean;
  removeEdge: (from: number, to: number, type?: number) => boolean;
  serialize: () => {
    nodes: TypedArray;
    edges: TypedArray;
  };
  getAllEdges: () => Generator<{
    from: number;
    to: number;
    type: number;
  }>;
  hasEdge: (from: number, to: number, type?: number) => boolean;
  resizeEdges: (n: number) => boolean;
  hasInboundEdges: (to: number) => boolean;
  getNodeIdsConnectedTo: (nodeId: number, type?: number) => Array<number>;
  getNodeIdsConnectedFrom: (nodeId: number, type?: number) => Array<number>;
  getOutboundEdgesByType: (from: number) => { type: number; to: number }[];
  getInboundEdgesByType: (to: number) => { type: number; from: number }[];
}

export type TypedArrayConstructor =
  | Uint32ArrayConstructor
  | Uint16ArrayConstructor
  | Uint8ArrayConstructor;
export type TypedArray = Uint32Array | Uint16Array | Uint8Array;
