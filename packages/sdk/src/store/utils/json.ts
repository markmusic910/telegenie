/** JSON.stringify that writes bigint values as decimal strings. */
export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) =>
    typeof nested === 'bigint' ? nested.toString() : nested,
  );
}
