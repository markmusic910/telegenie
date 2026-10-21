import { encryptBlock, expandEncKey } from "./aes256";

class Counter {
    _counter: Buffer;

    constructor(initialValue: Buffer | Uint8Array) {
        this._counter = Buffer.from(initialValue);
    }

    increment() {
        for (let i = 15; i >= 0; i--) {
            if (this._counter[i] === 255) {
                this._counter[i] = 0;
            } else {
                this._counter[i]++;
                break;
            }
        }
    }
}

export class CTR {
    private _counter: Counter;
    private _remainingCounter?: Buffer;
    private _remainingCounterIndex: number;
    private _ek: Uint32Array;

    constructor(key: Buffer | Uint8Array, iv: Buffer | Uint8Array) {
        const keyBuf = Buffer.from(key);
        const ivBuf = Buffer.from(iv);
        if (keyBuf.length !== 32 || ivBuf.length !== 16) {
            throw new Error("Key and iv need to be a buffer");
        }

        this._counter = new Counter(ivBuf);
        this._remainingCounter = undefined;
        this._remainingCounterIndex = 16;
        this._ek = expandEncKey(keyBuf);
    }

    update(plainText: Buffer | Uint8Array) {
        return this.encrypt(plainText);
    }

    encrypt(plainText: Buffer | Uint8Array) {
        const encrypted = Buffer.from(plainText);
        const tmp = new Uint32Array(4);

        for (let i = 0; i < encrypted.length; i++) {
            if (this._remainingCounterIndex === 16) {
                const c = this._counter._counter;
                encryptBlock(
                    this._ek,
                    c.readUInt32BE(0),
                    c.readUInt32BE(4),
                    c.readUInt32BE(8),
                    c.readUInt32BE(12),
                    tmp
                );
                this._remainingCounter = Buffer.alloc(16);
                this._remainingCounter.writeUInt32BE(tmp[0], 0);
                this._remainingCounter.writeUInt32BE(tmp[1], 4);
                this._remainingCounter.writeUInt32BE(tmp[2], 8);
                this._remainingCounter.writeUInt32BE(tmp[3], 12);
                this._remainingCounterIndex = 0;
                this._counter.increment();
            }
            if (this._remainingCounter) {
                encrypted[i] ^=
                    this._remainingCounter[this._remainingCounterIndex++];
            }
        }

        return encrypted;
    }
}
