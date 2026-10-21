import { Api } from '@telegenie/teleproto';

type ApiClassLike = { className: string };

/**
 * True when value is an instance of `ctor`, or a plain object with matching
 * GramJS `className` (cross-bundle / deserialized TL objects).
 */
export function isApiOfClass<T extends ApiClassLike>(
  value: unknown,
  // GramJS VirtualClass constructors are loosely typed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctor: abstract new (...args: any[]) => T,
  className: string,
): value is T {
  return (
    value instanceof ctor ||
    (!!value &&
      typeof value === 'object' &&
      (value as { className?: string }).className === className)
  );
}

export function isPeerUser(peer: unknown): peer is Api.PeerUser {
  return isApiOfClass(peer, Api.PeerUser, 'PeerUser');
}

export function isPeerChat(peer: unknown): peer is Api.PeerChat {
  return isApiOfClass(peer, Api.PeerChat, 'PeerChat');
}

export function isPeerChannel(peer: unknown): peer is Api.PeerChannel {
  return isApiOfClass(peer, Api.PeerChannel, 'PeerChannel');
}

export function isMessageEmpty(message: unknown): message is Api.MessageEmpty {
  return isApiOfClass(message, Api.MessageEmpty, 'MessageEmpty');
}
