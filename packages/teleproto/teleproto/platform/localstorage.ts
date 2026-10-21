/** Stub — TeleGenie uses StringSession, not node-localstorage. */
export class LocalStorage implements Storage {
    length = 0;
    constructor(_path?: string) {}
    getItem(_key: string) {
        return null;
    }
    setItem(_key: string, _value: string) {}
    removeItem(_key: string) {}
    clear() {}
    key(_index: number) {
        return null;
    }
}