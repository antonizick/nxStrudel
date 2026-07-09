import { atom } from 'nanostores';

// Live webcam bubble rendered over the code editor. The MediaStream itself is never
// persisted (there's nothing to save between reloads) — this module just wraps
// getUserMedia with a reactive atom so Code.jsx can render whatever's currently live.
export const webcamStream = atom(null);
export const webcamError = atom('');

let activeStream = null;

export async function startWebcam() {
  if (activeStream) return;
  webcamError.set('');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    activeStream = stream;
    webcamStream.set(stream);
  } catch (err) {
    webcamError.set(err.message || 'could not access camera');
  }
}

export function stopWebcam() {
  activeStream?.getTracks().forEach((track) => track.stop());
  activeStream = null;
  webcamStream.set(null);
}
