import type {
  CommitNode,
  FileReferenceMapJson,
  IncomingCtorNode,
  IncomingMethodNode,
  IndexedFileRefMap,
  OutgoingCtorNode,
  OutgoingMethodNode,
  RefreshActionNode,
  SwapNode,
} from './types';

export function indexFileRefMap(map: FileReferenceMapJson): IndexedFileRefMap {
  const methodResults = new Map<string, IncomingMethodNode>();
  const incomingByPredicate = new Map<string, IncomingCtorNode>();
  const commitsByPredicate = new Map<string, CommitNode>();
  const outgoingMethods = new Map<string, OutgoingMethodNode>();
  const outgoingByPredicate = new Map<string, OutgoingCtorNode>();
  const swapsByPredicate = new Map<string, SwapNode>();
  const refreshByKind = new Map<string, RefreshActionNode>();

  for (const node of map.traversers_incoming) {
    if (node._ === 'traverseMethodResult') {
      const n = node as IncomingMethodNode;
      methodResults.set(n.name, n);
    } else if (node._ === 'traverseIncomingConstructor') {
      const n = node as IncomingCtorNode;
      incomingByPredicate.set(n.predicate, n);
    } else if (node._ === 'traverseCommitSourceLocation') {
      const n = node as CommitNode;
      commitsByPredicate.set(n.predicate, n);
    }
  }

  for (const node of map.traversers_outgoing) {
    if (node._ === 'traverseMethodCall') {
      const n = node as OutgoingMethodNode;
      outgoingMethods.set(n.name, n);
    } else if (node._ === 'traverseOutgoingConstructor') {
      const n = node as OutgoingCtorNode;
      outgoingByPredicate.set(n.predicate, n);
    } else if (node._ === 'traverseSwapLocation') {
      const n = node as SwapNode;
      swapsByPredicate.set(n.predicate, n);
    }
  }

  for (const action of map.refresh_actions) {
    refreshByKind.set(action.stored_constructor, action);
  }

  return {
    layer: map.layer,
    methodResults,
    incomingByPredicate,
    commitsByPredicate,
    outgoingMethods,
    outgoingByPredicate,
    swapsByPredicate,
    refreshByKind,
  };
}
