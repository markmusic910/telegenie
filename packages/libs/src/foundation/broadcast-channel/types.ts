export type BroadcastEnvelope<T = unknown> = {
  type: string;
  payload: T;
  senderId: string;
  ts: number;
};

export type BroadcastHandler<T = unknown> = (envelope: BroadcastEnvelope<T>) => void;

export const DEFAULT_BROADCAST_CHANNEL_NAME = 'telegenie';
