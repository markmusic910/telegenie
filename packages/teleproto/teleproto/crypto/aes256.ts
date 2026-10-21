const Sbox = new Uint8Array(256);
const InvSbox = new Uint8Array(256);
const Td0 = new Uint32Array(256);
const Td1 = new Uint32Array(256);
const Td2 = new Uint32Array(256);
const Td3 = new Uint32Array(256);
const Rcon = [
    0x01000000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000,
    0x40000000, 0x80000000, 0x1b000000, 0x36000000,
];

const AES256_ROUNDS = 14;

(function initTables() {
    const xtime = (a: number) => ((a << 1) ^ (a & 0x80 ? 0x11b : 0)) & 0xff;
    const inv = new Uint8Array(256);
    let p = 1;
    let q = 1;
    do {
        p = (p ^ (p << 1) ^ (p & 0x80 ? 0x11b : 0)) & 0xff;
        q ^= q << 1;
        q ^= q << 2;
        q ^= q << 4;
        q &= 0xff;
        if (q & 0x80) q ^= 0x09;
        inv[p] = q;
    } while (p !== 1);
    inv[0] = 0;
    for (let i = 0; i < 256; i++) {
        const x = inv[i];
        let s =
            x ^
            ((x << 1) | (x >> 7)) ^
            ((x << 2) | (x >> 6)) ^
            ((x << 3) | (x >> 5)) ^
            ((x << 4) | (x >> 4)) ^
            0x63;
        s &= 0xff;
        Sbox[i] = s;
        InvSbox[s] = i;
    }
    for (let i = 0; i < 256; i++) {
        const j = InvSbox[i];
        const m9 = (xtime(xtime(xtime(j))) ^ j) & 0xff;
        const mb = (xtime(xtime(xtime(j))) ^ xtime(j) ^ j) & 0xff;
        const md = (xtime(xtime(xtime(j))) ^ xtime(xtime(j)) ^ j) & 0xff;
        const me = (xtime(xtime(xtime(j))) ^ xtime(xtime(j)) ^ xtime(j)) & 0xff;
        Td0[i] = ((me << 24) | (m9 << 16) | (md << 8) | mb) >>> 0;
        Td1[i] = ((mb << 24) | (me << 16) | (m9 << 8) | md) >>> 0;
        Td2[i] = ((md << 24) | (mb << 16) | (me << 8) | m9) >>> 0;
        Td3[i] = ((m9 << 24) | (md << 16) | (mb << 8) | me) >>> 0;
    }
})();

function expandEncKey(key: Buffer): Uint32Array {
    const Nk = 8;
    const Nr = AES256_ROUNDS;
    const ek = new Uint32Array(4 * (Nr + 1));
    for (let i = 0; i < Nk; i++) {
        ek[i] =
            ((key[4 * i] << 24) |
                (key[4 * i + 1] << 16) |
                (key[4 * i + 2] << 8) |
                key[4 * i + 3]) >>>
            0;
    }
    for (let i = Nk; i < ek.length; i++) {
        let t = ek[i - 1];
        if (i % Nk === 0) {
            t = ((t << 8) | (t >>> 24)) >>> 0;
            t =
                ((Sbox[(t >>> 24) & 255] << 24) |
                    (Sbox[(t >>> 16) & 255] << 16) |
                    (Sbox[(t >>> 8) & 255] << 8) |
                    Sbox[t & 255]) >>>
                0;
            t = (t ^ Rcon[i / Nk - 1]) >>> 0;
        } else if (i % Nk === 4) {
            t =
                ((Sbox[(t >>> 24) & 255] << 24) |
                    (Sbox[(t >>> 16) & 255] << 16) |
                    (Sbox[(t >>> 8) & 255] << 8) |
                    Sbox[t & 255]) >>>
                0;
        }
        ek[i] = (ek[i - Nk] ^ t) >>> 0;
    }
    return ek;
}

function expandDecKey(key: Buffer): Uint32Array {
    const ek = expandEncKey(key);
    const Nr = AES256_ROUNDS;
    const dk = new Uint32Array(ek.length);
    for (let r = 0; r <= Nr; r++) {
        for (let c = 0; c < 4; c++) dk[4 * r + c] = ek[4 * (Nr - r) + c];
    }
    for (let r = 1; r < Nr; r++) {
        for (let c = 0; c < 4; c++) {
            const w = dk[4 * r + c];
            dk[4 * r + c] =
                (Td0[Sbox[(w >>> 24) & 255]] ^
                    Td1[Sbox[(w >>> 16) & 255]] ^
                    Td2[Sbox[(w >>> 8) & 255]] ^
                    Td3[Sbox[w & 255]]) >>>
                0;
        }
    }
    return dk;
}

function xtime(a: number) {
    return ((a << 1) ^ (a & 0x80 ? 0x11b : 0)) & 0xff;
}

function mixColumnBytes(s: Uint8Array, i: number) {
    const a = s[i];
    const b = s[i + 1];
    const c = s[i + 2];
    const d = s[i + 3];
    const a2 = xtime(a);
    const b2 = xtime(b);
    const c2 = xtime(c);
    const d2 = xtime(d);
    s[i] = (a2 ^ b2 ^ b ^ c ^ d) & 0xff;
    s[i + 1] = (a ^ b2 ^ c2 ^ c ^ d) & 0xff;
    s[i + 2] = (a ^ b ^ c2 ^ d2 ^ d) & 0xff;
    s[i + 3] = (a2 ^ a ^ b ^ c ^ d2) & 0xff;
}

export function encryptBlock(
    ek: Uint32Array,
    s0: number,
    s1: number,
    s2: number,
    s3: number,
    out: Uint32Array
): void {
    const s = new Uint8Array(16);
    const writeWord = (off: number, w: number) => {
        s[off] = (w >>> 24) & 255;
        s[off + 1] = (w >>> 16) & 255;
        s[off + 2] = (w >>> 8) & 255;
        s[off + 3] = w & 255;
    };
    writeWord(0, s0 ^ ek[0]);
    writeWord(4, s1 ^ ek[1]);
    writeWord(8, s2 ^ ek[2]);
    writeWord(12, s3 ^ ek[3]);

    for (let r = 1; r < AES256_ROUNDS; r++) {
        for (let i = 0; i < 16; i++) s[i] = Sbox[s[i]];
        const t = s[1];
        s[1] = s[5];
        s[5] = s[9];
        s[9] = s[13];
        s[13] = t;
        const t2a = s[2];
        const t2b = s[6];
        s[2] = s[10];
        s[6] = s[14];
        s[10] = t2a;
        s[14] = t2b;
        const t3 = s[15];
        s[15] = s[11];
        s[11] = s[7];
        s[7] = s[3];
        s[3] = t3;
        mixColumnBytes(s, 0);
        mixColumnBytes(s, 4);
        mixColumnBytes(s, 8);
        mixColumnBytes(s, 12);
        const k = r * 4;
        writeWord(0, ((s[0] << 24) | (s[1] << 16) | (s[2] << 8) | s[3]) ^ ek[k]);
        writeWord(4, ((s[4] << 24) | (s[5] << 16) | (s[6] << 8) | s[7]) ^ ek[k + 1]);
        writeWord(8, ((s[8] << 24) | (s[9] << 16) | (s[10] << 8) | s[11]) ^ ek[k + 2]);
        writeWord(12, ((s[12] << 24) | (s[13] << 16) | (s[14] << 8) | s[15]) ^ ek[k + 3]);
    }

    for (let i = 0; i < 16; i++) s[i] = Sbox[s[i]];
    const t = s[1];
    s[1] = s[5];
    s[5] = s[9];
    s[9] = s[13];
    s[13] = t;
    const t2a = s[2];
    const t2b = s[6];
    s[2] = s[10];
    s[6] = s[14];
    s[10] = t2a;
    s[14] = t2b;
    const t3 = s[15];
    s[15] = s[11];
    s[11] = s[7];
    s[7] = s[3];
    s[3] = t3;
    const k = AES256_ROUNDS * 4;
    out[0] =
        (((s[0] << 24) | (s[1] << 16) | (s[2] << 8) | s[3]) ^ ek[k]) >>> 0;
    out[1] =
        (((s[4] << 24) | (s[5] << 16) | (s[6] << 8) | s[7]) ^ ek[k + 1]) >>> 0;
    out[2] =
        (((s[8] << 24) | (s[9] << 16) | (s[10] << 8) | s[11]) ^ ek[k + 2]) >>> 0;
    out[3] =
        (((s[12] << 24) | (s[13] << 16) | (s[14] << 8) | s[15]) ^ ek[k + 3]) >>> 0;
}

export function decryptBlock(
    dk: Uint32Array,
    s0: number,
    s1: number,
    s2: number,
    s3: number,
    out: Uint32Array
): void {
    s0 = (s0 ^ dk[0]) >>> 0;
    s1 = (s1 ^ dk[1]) >>> 0;
    s2 = (s2 ^ dk[2]) >>> 0;
    s3 = (s3 ^ dk[3]) >>> 0;
    let k = 4;
    for (let r = 1; r < AES256_ROUNDS; r++) {
        const t0 =
            (Td0[(s0 >>> 24) & 255] ^
                Td1[(s3 >>> 16) & 255] ^
                Td2[(s2 >>> 8) & 255] ^
                Td3[s1 & 255] ^
                dk[k++]) >>>
            0;
        const t1 =
            (Td0[(s1 >>> 24) & 255] ^
                Td1[(s0 >>> 16) & 255] ^
                Td2[(s3 >>> 8) & 255] ^
                Td3[s2 & 255] ^
                dk[k++]) >>>
            0;
        const t2 =
            (Td0[(s2 >>> 24) & 255] ^
                Td1[(s1 >>> 16) & 255] ^
                Td2[(s0 >>> 8) & 255] ^
                Td3[s3 & 255] ^
                dk[k++]) >>>
            0;
        const t3 =
            (Td0[(s3 >>> 24) & 255] ^
                Td1[(s2 >>> 16) & 255] ^
                Td2[(s1 >>> 8) & 255] ^
                Td3[s0 & 255] ^
                dk[k++]) >>>
            0;
        s0 = t0;
        s1 = t1;
        s2 = t2;
        s3 = t3;
    }
    out[0] =
        (((InvSbox[(s0 >>> 24) & 255] << 24) |
            (InvSbox[(s3 >>> 16) & 255] << 16) |
            (InvSbox[(s2 >>> 8) & 255] << 8) |
            InvSbox[s1 & 255]) ^
            dk[k++]) >>>
        0;
    out[1] =
        (((InvSbox[(s1 >>> 24) & 255] << 24) |
            (InvSbox[(s0 >>> 16) & 255] << 16) |
            (InvSbox[(s3 >>> 8) & 255] << 8) |
            InvSbox[s2 & 255]) ^
            dk[k++]) >>>
        0;
    out[2] =
        (((InvSbox[(s2 >>> 24) & 255] << 24) |
            (InvSbox[(s1 >>> 16) & 255] << 16) |
            (InvSbox[(s0 >>> 8) & 255] << 8) |
            InvSbox[s3 & 255]) ^
            dk[k++]) >>>
        0;
    out[3] =
        (((InvSbox[(s3 >>> 24) & 255] << 24) |
            (InvSbox[(s2 >>> 16) & 255] << 16) |
            (InvSbox[(s1 >>> 8) & 255] << 8) |
            InvSbox[s0 & 255]) ^
            dk[k++]) >>>
        0;
}

export { expandEncKey, expandDecKey };
