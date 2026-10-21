export class SocksClient {
    static createConnection(..._args: unknown[]): Promise<{ socket: import("./net").Socket }> {
        return Promise.reject(new Error("SOCKS is not available in the browser"));
    }
}
