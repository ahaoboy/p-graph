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

export type TypedArrayConstructor =
  | Uint32ArrayConstructor
  | Uint16ArrayConstructor
  | Uint8ArrayConstructor;
export type TypedArray = Uint32Array | Uint16Array | Uint8Array;
