import { base64ToFileRef } from './bytes';
import { encodeStoredConstructor } from './file-id';
import { classNameToPredicate } from './names';
import { getField, readId } from './tl-value';
import type { IndexedFileRefMap, TraverseParamNode } from './types';

export type SwapLocation = {
  object: { id: unknown; fileReference: unknown };
  fileId: string;
  storedConstructor: string;
};

/** Walks outgoing requests to find and patch file_reference swap locations. */
export class OutgoingTraverser {
  constructor(private readonly map: IndexedFileRefMap) {}

  collectSwapLocations(request: object): SwapLocation[] {
    const method = classNameToPredicate((request as { className?: string }).className ?? '');
    const spec = this.map.outgoingMethods.get(method);
    const found: SwapLocation[] = [];
    if (!spec) {
      this.walk(request, found);
      return found;
    }
    this.walkParams(spec.params, request, found);
    return found;
  }

  applyFileReference(location: SwapLocation, fileReferenceB64: string): void {
    location.object.fileReference = base64ToFileRef(fileReferenceB64);
  }

  private walk(value: unknown, found: SwapLocation[]): void {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) this.walk(item, found);
      return;
    }
    if (typeof value !== 'object') return;

    const predicate = classNameToPredicate((value as { className?: string }).className ?? '');
    if (!predicate) return;

    const swap = this.map.swapsByPredicate.get(predicate);
    if (swap) {
      const id = readId(getField(value, 'id'));
      if (id) {
        found.push({
          object: value as SwapLocation['object'],
          fileId: encodeStoredConstructor(swap.stored_constructor, id),
          storedConstructor: swap.stored_constructor,
        });
      }
      return;
    }

    const ctor = this.map.outgoingByPredicate.get(predicate);
    if (ctor) {
      this.walkParams(ctor.params, value, found);
    }
  }

  private walkParams(params: TraverseParamNode[], value: unknown, found: SwapLocation[]): void {
    for (const param of params) {
      const child = getField(value, param.name);
      if (child == null) continue;
      if (param.is_vector || Array.isArray(child)) {
        const items = Array.isArray(child) ? child : [child];
        for (const item of items) this.walk(item, found);
      } else {
        this.walk(child, found);
      }
    }
  }
}
