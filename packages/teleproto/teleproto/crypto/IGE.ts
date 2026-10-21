import * as Helpers from "../Helpers";
import {
    decryptBlock,
    encryptBlock,
    expandDecKey,
    expandEncKey,
} from "./aes256";

class IGE {
    private key: Buffer;
    private iv: Buffer;

    constructor(key: Buffer, iv: Buffer) {
        if (key.length !== 32) throw new Error("Key must be 32 bytes (AES-256)");
        if (iv.length !== 32)
            throw new Error("IV must be 32 bytes (2 * block size)");
        this.key = key;
        this.iv = iv;
    }

    private xorBlock(
        dst: Buffer,
        di: number,
        a: Buffer,
        ai: number,
        b: Buffer,
        bi: number
    ): void {
        for (let j = 0; j < 16; j++) dst[di + j] = a[ai + j] ^ b[bi + j];
    }

    encryptIge(plainText: Buffer): Buffer {
        const blockSize = 16;
        const padding = plainText.length % blockSize;
        if (padding !== 0) {
            plainText = Buffer.concat([
                plainText,
                Helpers.generateRandomBytes(blockSize - padding),
            ]);
        }

        const n = plainText.length;
        const iv1 = this.iv.subarray(0, blockSize);
        const iv2 = this.iv.subarray(blockSize, 2 * blockSize);

        const m = Buffer.allocUnsafe(n);
        for (let j = 0, o = 0; o < n; j++, o += blockSize) {
            if (j === 0) plainText.copy(m, 0, 0, blockSize);
            else if (j === 1)
                this.xorBlock(m, blockSize, plainText, blockSize, iv2, 0);
            else this.xorBlock(m, o, plainText, o, plainText, o - 2 * blockSize);
        }

        const ek = expandEncKey(this.key);
        const d = Buffer.allocUnsafe(n);
        const tmp = new Uint32Array(4);
        let prev0 = iv1.readUInt32BE(0);
        let prev1 = iv1.readUInt32BE(4);
        let prev2 = iv1.readUInt32BE(8);
        let prev3 = iv1.readUInt32BE(12);
        for (let o = 0; o < n; o += blockSize) {
            encryptBlock(
                ek,
                (m.readUInt32BE(o) ^ prev0) >>> 0,
                (m.readUInt32BE(o + 4) ^ prev1) >>> 0,
                (m.readUInt32BE(o + 8) ^ prev2) >>> 0,
                (m.readUInt32BE(o + 12) ^ prev3) >>> 0,
                tmp
            );
            d.writeUInt32BE(tmp[0], o);
            d.writeUInt32BE(tmp[1], o + 4);
            d.writeUInt32BE(tmp[2], o + 8);
            d.writeUInt32BE(tmp[3], o + 12);
            prev0 = tmp[0];
            prev1 = tmp[1];
            prev2 = tmp[2];
            prev3 = tmp[3];
        }

        const output = Buffer.allocUnsafe(n);
        for (let j = 0, o = 0; o < n; j++, o += blockSize) {
            if (j === 0) this.xorBlock(output, 0, d, 0, iv2, 0);
            else this.xorBlock(output, o, d, o, plainText, o - blockSize);
        }
        return output;
    }

    decryptIge(cipherText: Buffer): Buffer {
        const blockSize = 16;
        const n = cipherText.length;
        if (n % blockSize !== 0) {
            throw new Error("Cipher text must be multiple of 16 bytes");
        }

        const dk = expandDecKey(this.key);
        const output = Buffer.allocUnsafe(n);
        const cv = new DataView(
            cipherText.buffer,
            cipherText.byteOffset,
            n
        );
        const ov = new DataView(output.buffer, output.byteOffset, n);

        let pc0 = this.iv.readUInt32BE(0);
        let pc1 = this.iv.readUInt32BE(4);
        let pc2 = this.iv.readUInt32BE(8);
        let pc3 = this.iv.readUInt32BE(12);
        let pp0 = this.iv.readUInt32BE(16);
        let pp1 = this.iv.readUInt32BE(20);
        let pp2 = this.iv.readUInt32BE(24);
        let pp3 = this.iv.readUInt32BE(28);

        const tmp = new Uint32Array(4);
        for (let i = 0; i < n; i += blockSize) {
            const c0 = cv.getUint32(i);
            const c1 = cv.getUint32(i + 4);
            const c2 = cv.getUint32(i + 8);
            const c3 = cv.getUint32(i + 12);
            decryptBlock(
                dk,
                (c0 ^ pp0) >>> 0,
                (c1 ^ pp1) >>> 0,
                (c2 ^ pp2) >>> 0,
                (c3 ^ pp3) >>> 0,
                tmp
            );
            const p0 = (tmp[0] ^ pc0) >>> 0;
            const p1 = (tmp[1] ^ pc1) >>> 0;
            const p2 = (tmp[2] ^ pc2) >>> 0;
            const p3 = (tmp[3] ^ pc3) >>> 0;
            ov.setUint32(i, p0);
            ov.setUint32(i + 4, p1);
            ov.setUint32(i + 8, p2);
            ov.setUint32(i + 12, p3);
            pc0 = c0;
            pc1 = c1;
            pc2 = c2;
            pc3 = c3;
            pp0 = p0;
            pp1 = p1;
            pp2 = p2;
            pp3 = p3;
        }
        return output;
    }
}

export { IGE };
