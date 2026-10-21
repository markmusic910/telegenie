export function join(...parts: string[]) {
    return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}
export function basename(p: string) {
    const parts = String(p).split(/[\\/]/);
    return parts.pop() || p;
}
export function dirname(p: string) {
    const i = String(p).lastIndexOf("/");
    return i === -1 ? "." : p.slice(0, i);
}
export function extname(p: string) {
    const base = basename(p);
    const i = base.lastIndexOf(".");
    return i === -1 ? "" : base.slice(i);
}
export function resolve(...parts: string[]) {
    return join(...parts);
}

const path = { join, basename, dirname, extname, resolve };
export default path;
