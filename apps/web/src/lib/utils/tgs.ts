/** Telegram animated stickers are gzip-compressed Lottie JSON (`.tgs`). */
export async function decodeTgs(bytes: ArrayBuffer): Promise<Record<string, unknown>> {
  const compressed = new Uint8Array(bytes);
  const payload =
    compressed.length >= 2 && compressed[0] === 0x1f && compressed[1] === 0x8b
      ? await gunzip(compressed)
      : compressed;
  const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Animated sticker is not Lottie JSON');
  }
  return parsed as Record<string, unknown>;
}

// TODO: move this to a shared worker
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = (
    source.pipeThrough(
      new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>,
    )
  ).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const payload = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return payload;
}
