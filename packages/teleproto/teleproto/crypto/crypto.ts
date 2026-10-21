import { Buffer } from "buffer";

function getWebCrypto(): Crypto {
    const c = globalThis.crypto;
    if (!c?.getRandomValues || !c.subtle) {
        throw new Error("Web Crypto API is required (browser or Node 18+)");
    }
    return c;
}

function toUint8(data: Buffer | Uint8Array | string): Uint8Array {
    if (typeof data === "string") {
        return Buffer.from(data);
    }
    return data instanceof Uint8Array ? data : Buffer.from(data);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 1) {
        return chunks[0];
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
        out.set(c, o);
        o += c.length;
    }
    return out;
}

const SUBTLE_HASH: Record<string, string> = {
    sha1: "SHA-1",
    sha256: "SHA-256",
    sha512: "SHA-512",
};

export function randomBytes(count: number): Buffer {
    const bytes = new Uint8Array(count);
    getWebCrypto().getRandomValues(bytes);
    return Buffer.from(bytes);
}

export function randomFillSync(
    buf: Buffer | Uint8Array,
    offset = 0,
    size = buf.length - offset
): Buffer | Uint8Array {
    const slice = buf.subarray(offset, offset + size);
    getWebCrypto().getRandomValues(slice);
    return buf;
}

export class Hash {
    private readonly algorithm: string;
    private readonly chunks: Uint8Array[] = [];

    constructor(algorithm: string) {
        this.algorithm = algorithm.toLowerCase();
    }

    update(data: Buffer | Uint8Array | string) {
        this.chunks.push(toUint8(data));
        return this;
    }

    async digest(): Promise<Buffer> {
        const name = SUBTLE_HASH[this.algorithm];
        if (!name) {
            throw new Error(`Unsupported hash algorithm: ${this.algorithm}`);
        }
        const data = concatChunks(this.chunks);
        return Buffer.from(
            await getWebCrypto().subtle.digest(name, data as BufferSource)
        );
    }
}

export function createHash(algorithm: string) {
    return new Hash(algorithm);
}

export async function pbkdf2Sync(
    password: Buffer | Uint8Array,
    salt: Buffer | Uint8Array,
    iterations: number,
    keylen: number,
    digest: string
): Promise<Buffer> {
    const hash = digest.toLowerCase() === "sha512" ? "SHA-512" : "SHA-256";
    const passwordKey = await getWebCrypto().subtle.importKey(
        "raw",
        toUint8(password) as BufferSource,
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );
    const bits = await getWebCrypto().subtle.deriveBits(
        {
            name: "PBKDF2",
            hash,
            salt: toUint8(salt) as BufferSource,
            iterations,
        },
        passwordKey,
        keylen * 8
    );
    return Buffer.from(bits);
}

export async function hmacSha256(
    key: Buffer | Uint8Array,
    data: Buffer | Uint8Array
): Promise<Buffer> {
    const cryptoKey = await getWebCrypto().subtle.importKey(
        "raw",
        toUint8(key) as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    return Buffer.from(
        await getWebCrypto().subtle.sign(
            "HMAC",
            cryptoKey,
            toUint8(data) as BufferSource
        )
    );
}

export function createHmac(_algorithm: string, key: Buffer | Uint8Array) {
    const chunks: Uint8Array[] = [];
    return {
        update(data: Buffer | Uint8Array) {
            chunks.push(toUint8(data));
            return this;
        },
        digest() {
            return hmacSha256(key, concatChunks(chunks));
        },
    };
}
