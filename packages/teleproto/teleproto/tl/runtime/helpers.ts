import { Buffer } from "buffer";
import type { DateLike } from "../../define";

function toBuffer(data: unknown): Buffer {
    if (typeof data === "string") {
        return Buffer.from(data);
    }
    // npm `buffer` and the global Buffer can be different constructors in a
    // worker bundle; both are Uint8Array subclasses.
    if (data instanceof Uint8Array) {
        return Buffer.isBuffer(data) ? data : Buffer.from(data);
    }
    throw new Error(`Bytes or str expected, not ${typeof data}`);
}

export function serializeBytes(data: Buffer | Uint8Array | string): Buffer {
    const bytes = toBuffer(data);

    const chunks: Buffer[] = [];
    let padding: number;

    if (bytes.length < 254) {
        padding = (bytes.length + 1) % 4;
        if (padding !== 0) {
            padding = 4 - padding;
        }
        chunks.push(Buffer.from([bytes.length]));
        chunks.push(bytes);
    } else {
        padding = bytes.length % 4;
        if (padding !== 0) {
            padding = 4 - padding;
        }
        chunks.push(
            Buffer.from([
                254,
                bytes.length % 256,
                (bytes.length >> 8) % 256,
                (bytes.length >> 16) % 256,
            ])
        );
        chunks.push(bytes);
    }

    chunks.push(Buffer.alloc(padding).fill(0));
    return Buffer.concat(chunks);
}

export function serializeDate(dt: DateLike | Date | undefined | null): Buffer {
    if (!dt) {
        return Buffer.alloc(4).fill(0);
    }

    if (dt instanceof Date) {
        dt = Math.floor((Date.now() - dt.getTime()) / 1000);
    }

    if (typeof dt === "number") {
        const buffer = Buffer.alloc(4);
        buffer.writeInt32LE(dt, 0);
        return buffer;
    }

    throw new Error(`Cannot interpret "${String(dt)}" as a date`);
}
