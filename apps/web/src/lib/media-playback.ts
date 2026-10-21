type StopPlayback = () => void;

let activeStop: StopPlayback | undefined;

/** Only one voice note or round video plays with sound. The previous one is stopped. */
export function claimMediaPlayback(stop: StopPlayback) {
  if (activeStop && activeStop !== stop) {
    const previous = activeStop;
    activeStop = stop;
    previous();
    return;
  }
  activeStop = stop;
}

export function releaseMediaPlayback(stop: StopPlayback) {
  if (activeStop === stop) activeStop = undefined;
}
