/** TL snake_case param → GramJS camelCase. */
export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** GramJS `className` (`Document`, `messages.GetHistory`) → TL predicate. */
export function classNameToPredicate(className: string): string {
  const dot = className.lastIndexOf('.');
  if (dot < 0) {
    return unpascal(className);
  }
  return `${className.slice(0, dot)}.${unpascal(className.slice(dot + 1))}`;
}

/** TL predicate (`document`, `messages.getHistory`) → GramJS `className`. */
export function predicateToClassName(predicate: string): string {
  const dot = predicate.lastIndexOf('.');
  if (dot < 0) {
    return pascal(predicate);
  }
  return `${predicate.slice(0, dot)}.${pascal(predicate.slice(dot + 1))}`;
}

function pascal(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function unpascal(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}
