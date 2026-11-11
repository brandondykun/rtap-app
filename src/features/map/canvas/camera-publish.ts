import { useOp } from '@/stores/op';

/**
 * At an OP the camera is published to the readouts at most this often. Turning moves the camera every frame, and
 * redrawing the readouts each time took about a third of the JS thread; ten updates a second still reads as live.
 */
export const OP_CAMERA_PUBLISH_MS = 100;

/** Schedules a camera publish (for createLatestThrottle): the next frame on the map, OP_CAMERA_PUBLISH_MS at an OP. */
export function scheduleCameraPublish(cb: () => void): unknown {
  return useOp.getState().phase === 'on' ? setTimeout(cb, OP_CAMERA_PUBLISH_MS) : requestAnimationFrame(cb);
}
