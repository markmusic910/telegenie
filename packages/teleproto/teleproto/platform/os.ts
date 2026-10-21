/** Browser-safe os stub (deviceModel / systemVersion). */
export function type() {
    return "Web";
}
export function release() {
    return "1.0";
}
export function platform() {
    return "browser";
}
export function homedir() {
    return "/";
}
export function hostname() {
    return "localhost";
}
export function arch() {
    return "wasm";
}
export function cpus() {
    return [];
}
export function endianness() {
    return "LE";
}
export function tmpdir() {
    return "/tmp";
}

const os = {
    type,
    release,
    platform,
    homedir,
    hostname,
    arch,
    cpus,
    endianness,
    tmpdir,
};

export default os;
