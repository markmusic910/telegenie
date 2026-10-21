import { Buffer } from "buffer";

export class WriteStream {
    path: string;
    constructor(filePath = "") {
        this.path = filePath;
    }
    write(..._args: unknown[]) {
        return true;
    }
    end(..._args: unknown[]) {}
    close() {}
    once(_event: string, _handler: (...args: unknown[]) => void) {
        return this;
    }
    removeListener(_event: string, _handler: (...args: unknown[]) => void) {
        return this;
    }
}

function unavailable(): never {
    throw new Error("fs is not available in the browser");
}

export function createWriteStream(filePath?: string) {
    return new WriteStream(filePath);
}

export function existsSync(_path?: string) {
    return false;
}

export function lstatSync(_path?: string) {
    return {
        isDirectory() {
            return false;
        },
        isFile() {
            return false;
        },
    };
}

export const promises = {
    open: async (..._args: unknown[]) => ({
        read: async (..._args: unknown[]) => 0,
        close: async () => undefined,
    }),
    readFile: async (..._args: unknown[]) => Buffer.alloc(0),
    writeFile: async (..._args: unknown[]) => unavailable(),
    stat: async (..._args: unknown[]) => ({
        size: 0,
        isFile() {
            return false;
        },
        isDirectory() {
            return false;
        },
    }),
    lstat: async (..._args: unknown[]) => ({
        isFile() {
            return false;
        },
        isDirectory() {
            return false;
        },
    }),
};

const fs = {
    WriteStream,
    createWriteStream,
    existsSync,
    lstatSync,
    promises,
};

export default fs;
