import type { IGraph, TraversalActions } from "./type";
import { AdjacencyList } from "./AdjacencyList";
import { assert, nullthrows, fromNodeId } from "./share";
import {
  NullEdgeType,
  AllEdgeTypes,
  SerializedAdjacencyList,
  GraphOpts,
  SerializedGraph,
} from "./type";

export function mapVisitor(
  filter: (id: number, action: TraversalActions) => any,
  visit: any
): any {
  function makeEnter(visit: any) {
    return function mappedEnter(nodeId: number, context: any, actions: any) {
      let value = filter(nodeId, actions);
      if (value != null) {
        return visit(value, context, actions);
      }
    };
  }

  if (typeof visit === "function") {
    return makeEnter(visit);
  }

  let mapped: any = {};
  if (visit.enter != null) {
    mapped.enter = makeEnter(visit.enter);
  }

  if (visit.exit != null) {
    mapped.exit = function mappedExit(
      nodeId: number,
      context: any,
      actions: any
    ) {
      let exit = visit.exit;
      if (!exit) {
        return;
      }

      let value = filter(nodeId, actions);
      if (value != null) {
        return exit(value, context, actions);
      }
    };
  }

  return mapped;
}

export class Graph<N> implements IGraph<N> {
  nodes: Map<number, N>;
  adjacencyList: AdjacencyList;
  rootNodeId?: number | undefined;
  constructor(opts?: GraphOpts<N>) {
    this.nodes = opts?.nodes || new Map();
    this.setRootNodeId(opts?.rootNodeId);

    let adjacencyList = opts?.adjacencyList;
    this.adjacencyList = adjacencyList
      ? AdjacencyList.deserialize(adjacencyList)
      : new AdjacencyList();
  }
  resizeEdges(n: number) {
    this.adjacencyList.resizeEdges(n);
    return true;
  }
  setRootNodeId(id?: number) {
    this.rootNodeId = id;
  }
  serialize(): SerializedGraph<N> {
    return {
      nodes: this.nodes,
      adjacencyList: this.adjacencyList.serialize(),
      rootNodeId: this.rootNodeId ?? 0,
    };
  }

  // Returns an iterator of all edges in the graph. This can be large, so iterating
  // the complete list can be costly in large graphs. Used when merging graphs.
  getAllEdges() {
    return this.adjacencyList.getAllEdges();
  }

  addNode(node: N): number {
    let id = this.adjacencyList.addNode();
    this.nodes.set(id, node);
    return id;
  }

  hasNode(id: number): boolean {
    return this.nodes.has(id);
  }

  getNode(id: number) {
    return this.nodes.get(id) ?? null;
  }

  addEdge(from: number, to: number, type = NullEdgeType): boolean {
    if (Number(type) === 0) {
      throw new Error(`Edge type "${type}" not allowed`);
    }

    if (!this.getNode(from)) {
      throw new Error(`"from" node '${fromNodeId(from)}' not found`);
    }

    if (!this.getNode(to)) {
      throw new Error(`"to" node '${fromNodeId(to)}' not found`);
    }

    return this.adjacencyList.addEdge(from, to, type);
  }

  hasEdge(
    from: number,
    to: number,
    type: number | number[] = NullEdgeType
  ): boolean {
    return this.adjacencyList.hasEdge(from, to, type);
  }

  getNodeIdsConnectedTo(nodeId: number, type = NullEdgeType): Array<number> {
    this._assertHasNodeId(nodeId);

    return this.adjacencyList.getNodeIdsConnectedTo(nodeId, type);
  }

  getNodeIdsConnectedFrom(nodeId: number, type = NullEdgeType): Array<number> {
    this._assertHasNodeId(nodeId);
    return this.adjacencyList.getNodeIdsConnectedFrom(nodeId, type);
  }

  // Removes node and any edges coming from or to that node
  removeNode(nodeId: number) {
    if (!this.hasNode(nodeId)) {
      return false;
    }

    for (let { type, from } of this.adjacencyList.getInboundEdgesByType(
      nodeId
    )) {
      this._removeEdge(
        from,
        nodeId,
        type,
        // Do not allow orphans to be removed as this node could be one
        // and is already being removed.
        false
      );
    }

    for (let { type, to } of this.adjacencyList.getOutboundEdgesByType(
      nodeId
    )) {
      this._removeEdge(nodeId, to, type);
    }

    let wasRemoved = this.nodes.delete(nodeId);
    assert(wasRemoved);
    return true;
  }

  removeEdges(nodeId: number, type = NullEdgeType) {
    if (!this.hasNode(nodeId)) {
      return;
    }

    for (let to of this.getNodeIdsConnectedFrom(nodeId, type)) {
      this._removeEdge(nodeId, to, type);
    }
  }

  removeEdge(
    from: number,
    to: number,
    type = 1,
    removeOrphans: boolean = true
  ) {
    if (!this.adjacencyList.hasEdge(from, to, type)) {
      throw new Error(
        `Edge from ${fromNodeId(from)} to ${fromNodeId(to)} not found!`
      );
    }

    return this._removeEdge(from, to, type, removeOrphans);
  }

  // Removes edge and node the edge is to if the node is orphaned
  private _removeEdge(
    from: number,
    to: number,
    type = NullEdgeType,
    removeOrphans: boolean = true
  ) {
    if (!this.adjacencyList.hasEdge(from, to, type)) {
      return false;
    }

    this.adjacencyList.removeEdge(from, to, type);
    if (removeOrphans && this.isOrphanedNode(to)) {
      this.removeNode(to);
    }
    return true;
  }

  isOrphanedNode(nodeId: number): boolean {
    if (!this.hasNode(nodeId)) {
      return false;
    }

    if (this.rootNodeId == null) {
      // If the graph does not have a root, and there are inbound edges,
      // this node should not be considered orphaned.
      return !this.adjacencyList.hasInboundEdges(nodeId);
    }

    // Otherwise, attempt to traverse backwards to the root. If there is a path,
    // then this is not an orphaned node.
    let hasPathToRoot = false;
    // go back to traverseAncestors
    this.traverseAncestors(
      nodeId,
      (ancestorId: number, _: any, actions: any) => {
        if (ancestorId === this.rootNodeId) {
          hasPathToRoot = true;
          actions.stop();
        }
      },
      AllEdgeTypes
    );

    if (hasPathToRoot) {
      return false;
    }

    return true;
  }

  updateNode(nodeId: number, node: N): void {
    this._assertHasNodeId(nodeId);
    this.nodes.set(nodeId, node);
  }

  // Update a node's downstream nodes making sure to prune any orphaned branches
  replaceNodeIdsConnectedTo(
    fromNodeId: number,
    toNodeIds: readonly number[],
    replaceFilter?: null | ((id: number) => boolean),
    type = NullEdgeType
  ): void {
    this._assertHasNodeId(fromNodeId);

    let outboundEdges = [...this.getNodeIdsConnectedFrom(fromNodeId, type)];
    let childrenToRemove = new Set(
      replaceFilter
        ? outboundEdges.filter((toNodeId) => replaceFilter(toNodeId))
        : outboundEdges
    );
    for (let toNodeId of toNodeIds) {
      childrenToRemove.delete(toNodeId);

      if (!this.hasEdge(fromNodeId, toNodeId, type)) {
        this.addEdge(fromNodeId, toNodeId, type);
      }
    }

    for (let child of childrenToRemove) {
      this._removeEdge(fromNodeId, child, type);
    }
  }

  traverse<TContext>(
    visit: any,
    startNodeId?: number | undefined,
    type = NullEdgeType
  ): any {
    return this.dfs({
      visit,
      startNodeId,
      getChildren: (nodeId: number) =>
        this.getNodeIdsConnectedFrom(nodeId, type),
    });
  }

  filteredTraverse<TValue, TContext>(
    filter: (id: number, action: any) => TValue,
    visit: any,
    startNodeId: number,
    type = NullEdgeType
  ): any {
    return this.traverse(mapVisitor(filter, visit), startNodeId, type);
  }

  traverseAncestors<TContext>(
    startNodeId: number,
    visit?: any,
    type = NullEdgeType
  ): any {
    return this.dfs({
      visit,
      startNodeId,
      getChildren: (nodeId: number) => this.getNodeIdsConnectedTo(nodeId, type),
    });
  }

  dfs<TContext>({
    visit,
    startNodeId,
    getChildren,
  }: {
    visit: any;
    getChildren(nodeId: number): Array<number>;
    startNodeId?: number | undefined;
  }): any {
    let traversalStartNode = nullthrows(
      startNodeId ?? this.rootNodeId,
      "A start node is required to traverse"
    );
    this._assertHasNodeId(traversalStartNode);

    let visited = new Set<number>();
    let stopped = false;
    let skipped = false;
    let actions: TraversalActions = {
      skipChildren() {
        skipped = true;
      },
      stop() {
        stopped = true;
      },
    };

    let walk: any = (nodeId: number, context: any) => {
      if (!this.hasNode(nodeId)) return;
      visited.add(nodeId);

      skipped = false;
      let enter = typeof visit === "function" ? visit : visit.enter;
      if (enter) {
        let newContext = enter(nodeId, context, actions);
        if (typeof newContext !== "undefined") {
          // $FlowFixMe[reassign-const]
          context = newContext;
        }
      }

      if (skipped) {
        return;
      }

      if (stopped) {
        return context;
      }

      for (let child of getChildren(nodeId)) {
        if (visited.has(child)) {
          continue;
        }

        visited.add(child);
        let result = walk(child, context);
        if (stopped) {
          return result;
        }
      }

      if (
        typeof visit !== "function" &&
        visit.exit &&
        // Make sure the graph still has the node: it may have been removed between enter and exit
        this.hasNode(nodeId)
      ) {
        let newContext = visit.exit(nodeId, context, actions);
        if (typeof newContext !== "undefined") {
          // $FlowFixMe[reassign-const]
          context = newContext;
        }
      }

      if (skipped) {
        return;
      }

      if (stopped) {
        return context;
      }
    };

    return walk(traversalStartNode);
  }

  bfs(visit: (nodeId: number) => boolean): number | null {
    let rootNodeId = nullthrows(
      this.rootNodeId,
      "A root node is required to traverse"
    );

    let queue: Array<number> = [rootNodeId];
    let visited = new Set<number>([rootNodeId]);

    while (queue.length > 0) {
      let node = queue.shift()!;
      let stop = visit(rootNodeId);
      if (stop === true) {
        return node;
      }

      for (let child of this.getNodeIdsConnectedFrom(node)) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }
    }

    return null;
  }

  // topoSort(): Array<number> {
  //   let sorted: Array<number> = [];
  //   this.traverse({
  //     exit: (nodeId: number) => {
  //       sorted.push(nodeId);
  //     },
  //   });
  //   return sorted.reverse();
  // }

  findAncestor(nodeId: number, fn: (nodeId: number) => boolean): number | null {
    let res = null;
    this.traverseAncestors(
      nodeId,
      (nodeId: number, ctx: any, traversal: any) => {
        if (fn(nodeId)) {
          res = nodeId;
          traversal.stop();
        }
      }
    );
    return res;
  }

  findAncestors(
    nodeId: number,
    fn: (nodeId: number) => boolean
  ): Array<number> {
    const res: number[] = [];
    this.traverseAncestors(
      nodeId,
      (nodeId: number, ctx: any, traversal: any) => {
        if (fn(nodeId)) {
          res.push(nodeId);
          traversal.skipChildren();
        }
      }
    );
    return res;
  }

  findDescendant(
    nodeId: number,
    fn: (nodeId: number) => boolean
  ): number | null {
    let res = null;
    this.traverse((nodeId: any, ctx: any, traversal: any) => {
      if (fn(nodeId)) {
        res = nodeId;
        traversal.stop();
      }
    }, nodeId);
    return res;
  }

  findDescendants(
    nodeId: number,
    fn: (nodeId: number) => boolean
  ): Array<number> {
    const res: number[] = [];
    this.traverse((nodeId: number, ctx: any, traversal: any) => {
      if (fn(nodeId)) {
        res.push(nodeId);
        traversal.skipChildren();
      }
    }, nodeId);
    return res;
  }

  _assertHasNodeId(nodeId: number) {
    if (!this.hasNode(nodeId)) {
      throw new Error("Does not have node " + fromNodeId(nodeId));
    }
  }
  static deserialize<N>(opts: GraphOpts<N>): Graph<N> {
    return new Graph<N>({
      nodes: opts.nodes,
      adjacencyList: opts.adjacencyList,
      rootNodeId: opts.rootNodeId,
    });
  }
}
