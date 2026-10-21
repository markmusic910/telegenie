/**
 * Yields execution to the main thread's event loop.
 * This is useful for splitting long-running tasks to prevent UI jank.
 * Works in both Window and Worker (Service/Web Worker) contexts.
 */
export function yieldToMain(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
