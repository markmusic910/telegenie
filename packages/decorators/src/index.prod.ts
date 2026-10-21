export { MUTED, type FuncLogOptions, type RequestLogOptions, type RecoverOptions, type ListRequestDebounceOptions } from './options';
export { FuncLog, FuncLog as Log } from './func-log.noop';
export { Recover } from './recover.noop';
export { RequestLog } from './request-log.noop';
export { Method, type MethodOptions } from './method';
export { ListRequestDebounce } from './list-request-debounce';
export { Controller } from './controller';

// Export no-op versions for logRequest and getTabId in production (just in case they are referenced)
export function logRequest(): void {}
export function getTabId(): string {
  return 'prod';
}
