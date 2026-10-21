/** Stub — TeleGenie uses WebSockets, not TCP. */
export class Socket {
    destroyed = false;
    destroy() {
        this.destroyed = true;
    }
    setNoDelay(_noDelay?: boolean) {}
    setKeepAlive(_enable?: boolean, _initialDelay?: number) {}
    connect(_port: number, _host?: string, _cb?: () => void) {
        return this;
    }
    on(_event: string, _handler: (...args: any[]) => void) {
        return this;
    }
    once(_event: string, _handler: (...args: any[]) => void) {
        return this;
    }
    write(_data: Buffer) {
        return true;
    }
    unref() {
        return this;
    }
}

const net = { Socket };
export default net;
