import { Api } from '@telegenie/teleproto';
import bigInt from 'big-integer';
import { Buffer } from 'buffer';

import { isByteArray } from './bytes';
import { classNameToPredicate, predicateToClassName, snakeToCamel } from './names';
import { isMethodFrame } from './types';

export class ExtractAbort extends Error {
  constructor() {
    super('file-ref extract abort');
    this.name = 'ExtractAbort';
  }
}

export function predicateOf(value: unknown): string | undefined {
  if (isMethodFrame(value)) return value.method;
  if (value && typeof value === 'object' && 'className' in value) {
    const className = (value as { className?: string }).className;
    if (typeof className === 'string' && className) {
      return classNameToPredicate(className);
    }
  }
  if (value && typeof value === 'object' && '_' in value && typeof (value as { _: unknown })._ === 'string') {
    return (value as { _: string })._;
  }
  return undefined;
}

export function matchesPredicate(value: unknown, predicate: string): boolean {
  return predicateOf(value) === predicate;
}

export function getField(value: unknown, tlParam: string): unknown {
  if (value == null) return undefined;
  if (tlParam === '') {
    if (isMethodFrame(value)) return value.result;
    return value;
  }
  const camel = snakeToCamel(tlParam);
  if (isMethodFrame(value)) {
    return (value.request as Record<string, unknown>)[camel];
  }
  return (value as Record<string, unknown>)[camel];
}

export function isEmptyFlag(value: unknown): boolean {
  return value === undefined || value === null;
}

export function toStoredValue(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (bigInt.isInstance(value)) return value.toString();
  if (isByteArray(value)) {
    return Buffer.from(value).toString('base64');
  }
  if (Array.isArray(value)) return value.map(toStoredValue);
  if (typeof value === 'object') {
    return serializeTl(value);
  }
  return value;
}

export function serializeTl(value: object): Record<string, unknown> {
  const pred = predicateOf(value);
  const out: Record<string, unknown> = {};
  if (pred) out._ = pred;
  for (const [key, field] of Object.entries(value)) {
    if (key === 'className' || key === 'CONSTRUCTOR_ID' || key === 'SUBCLASS_OF_ID' || key === 'classType') {
      continue;
    }
    if (typeof field === 'function') continue;
    out[key] = toStoredValue(field);
  }
  return out;
}

export function getApiConstructor(predicate: string): (new (args?: object) => object) | undefined {
  const className = predicateToClassName(predicate);
  const dot = className.lastIndexOf('.');
  const root = Api as unknown as Record<string, unknown>;
  if (dot < 0) {
    const Ctor = root[className];
    return typeof Ctor === 'function' ? (Ctor as new (args?: object) => object) : undefined;
  }
  const ns = root[className.slice(0, dot)] as Record<string, unknown> | undefined;
  const Ctor = ns?.[className.slice(dot + 1)];
  return typeof Ctor === 'function' ? (Ctor as new (args?: object) => object) : undefined;
}

export function reconstructTl(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(reconstructTl);
  if (typeof value !== 'object') return value;
  const rec = value as Record<string, unknown>;
  if (rec._ === 'bytes' && typeof rec.bytes === 'string') {
    return Buffer.from(rec.bytes, 'base64');
  }
  const pred = typeof rec._ === 'string' ? rec._ : undefined;
  if (!pred) return value;
  const Ctor = getApiConstructor(pred);
  if (!Ctor) return value;
  const args: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(rec)) {
    if (key === '_') continue;
    args[key] = reconstructTl(field);
  }
  try {
    return new Ctor(args);
  } catch {
    return value;
  }
}

export function coerceForApi(value: unknown, type: string): unknown {
  if (value === undefined || value === null) return value;
  const reconstructed = typeof value === 'object' ? reconstructTl(value) : value;
  if (type === 'long' || type.endsWith('long')) {
    if (typeof reconstructed === 'number') {
      return bigInt(reconstructed);
    }
    if (typeof reconstructed === 'string') {
      return bigInt(reconstructed);
    }
    return reconstructed;
  }
  if (type === 'int' || type === 'double') return reconstructed;
  if (type === 'bytes') {
    if (typeof reconstructed === 'string') return Buffer.from(reconstructed, 'base64');
    if (isByteArray(reconstructed)) return Buffer.from(reconstructed);
    return reconstructed;
  }
  if (type === 'string') return String(reconstructed);
  if (type === 'Bool' || type === 'true') return Boolean(reconstructed);
  return reconstructed;
}

export function readId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (bigInt.isInstance(value)) return value.toString();
  if (typeof value === 'object' && 'toString' in value) return String((value as { toString(): string }).toString());
  return undefined;
}
