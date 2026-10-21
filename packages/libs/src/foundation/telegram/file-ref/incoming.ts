import type { LocalDb } from '../local-db/local-db';
import type { FileSourceRecord } from '../local-db/types';
import { fileRefToBase64 } from './bytes';
import { tryBuildSource } from './extractors';
import { encodeStoredConstructor, kindFromStoredConstructor } from './file-id';
import { classNameToPredicate } from './names';
import { getField, readId } from './tl-value';
import type {
  CommitNode,
  IncomingCtorNode,
  IndexedFileRefMap,
  MethodFrame,
  SourceNode,
  TraverseParamNode,
} from './types';
import { isMethodFrame } from './types';

export type IncomingTraverserOptions = {
  localDb: LocalDb;
  map: IndexedFileRefMap;
  getSelfId: () => Promise<string | undefined>;
};

type WalkState = {
  parentContext: Map<string, unknown[]>;
  sourceStack: FileSourceRecord[];
};

/** Walks incoming method results and updates; commits file refs and sources to LocalDb. */
export class IncomingTraverser {
  private readonly localDb: LocalDb;
  private readonly map: IndexedFileRefMap;
  private readonly getSelfId: () => Promise<string | undefined>;

  constructor(options: IncomingTraverserOptions) {
    this.localDb = options.localDb;
    this.map = options.map;
    this.getSelfId = options.getSelfId;
  }

  async ingestMethodResult(request: { className: string }, result: unknown): Promise<void> {
    const method = classNameToPredicate(request.className);
    const spec = this.map.methodResults.get(method);
    if (!spec) return;

    const frame: MethodFrame = {
      __fileRefMethod: true,
      method,
      request,
      result,
      className: request.className,
    };
    const state = emptyState();
    const pushed = await this.pushSources(spec.push_sources as SourceNode[], frame, state);
    if (spec.is_needed_parent) pushParent(state, method, frame);
    await this.walk(result, state);
    if (spec.is_needed_parent) popParent(state, method);
    popSources(state, pushed);
  }

  async ingestUpdate(update: unknown): Promise<void> {
    await this.walk(update, emptyState());
  }

  private async walk(value: unknown, state: WalkState): Promise<void> {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        await this.walk(item, state);
      }
      return;
    }
    if (typeof value !== 'object') return;

    const predicate = isMethodFrame(value)
      ? value.method
      : classNameToPredicate((value as { className?: string }).className ?? '');
    if (!predicate) return;

    const commit = this.map.commitsByPredicate.get(predicate);
    if (commit) {
      await this.runCommit(commit, value, state);
      return;
    }

    const ctor = this.map.incomingByPredicate.get(predicate);
    if (!ctor) return;
    await this.runIncomingCtor(ctor, value, state);
  }

  private async runIncomingCtor(
    ctor: IncomingCtorNode,
    value: unknown,
    state: WalkState,
  ): Promise<void> {
    const pushed = await this.pushSources(ctor.push_sources, value, state);
    if (ctor.is_needed_parent) {
      pushParent(state, ctor.predicate, value);
    }
    await this.walkParams(ctor.params, value, state);
    if (ctor.is_needed_parent) {
      popParent(state, ctor.predicate);
    }
    popSources(state, pushed);
  }

  private async runCommit(commit: CommitNode, value: unknown, state: WalkState): Promise<void> {
    const pushed = await this.pushSources(commit.push_sources, value, state);
    const id = readId(getField(value, 'id'));
    const fileReference = fileRefToBase64(getField(value, 'file_reference') as Uint8Array | undefined);
    if (id && fileReference) {
      const fileId = encodeStoredConstructor(commit.stored_constructor, id);
      await this.localDb.putFileRef({
        fileId,
        kind: kindFromStoredConstructor(commit.stored_constructor),
        id,
        fileReference,
      });
      const seen = new Set<string>();
      for (const source of state.sourceStack) {
        if (seen.has(source.kind)) continue;
        seen.add(source.kind);
        await this.localDb.putFileSource({ fileId, source });
      }
    }
    popSources(state, pushed);
  }

  private async walkParams(
    params: TraverseParamNode[],
    value: unknown,
    state: WalkState,
  ): Promise<void> {
    for (const param of params) {
      const child = getField(value, param.name);
      if (child == null) continue;
      if (param.is_vector || Array.isArray(child)) {
        const items = Array.isArray(child) ? child : [child];
        for (const item of items) {
          await this.walk(item, state);
        }
      } else {
        await this.walk(child, state);
      }
    }
  }

  private async pushSources(
    sources: SourceNode[] | undefined,
    current: unknown,
    state: WalkState,
  ): Promise<number> {
    if (!sources?.length) return 0;
    let count = 0;
    for (const source of sources) {
      const built = await tryBuildSource(source, {
        current,
        parentContext: state.parentContext,
        getSelfId: this.getSelfId,
      });
      if (built) {
        state.sourceStack.push(built);
        count += 1;
      }
    }
    return count;
  }
}

function popSources(state: WalkState, count: number): void {
  if (count > 0) state.sourceStack.splice(state.sourceStack.length - count, count);
}

function pushParent(state: WalkState, predicate: string, value: unknown): void {
  const stack = state.parentContext.get(predicate) ?? [];
  stack.push(value);
  state.parentContext.set(predicate, stack);
}

function popParent(state: WalkState, predicate: string): void {
  const stack = state.parentContext.get(predicate);
  stack?.pop();
}

function emptyState(): WalkState {
  return { parentContext: new Map(), sourceStack: [] };
}
