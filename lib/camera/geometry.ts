import { coverCrop } from "@/lib/lut/renderer";

export function viewPointToSensor(
  localX: number,
  localY: number,
  viewWidth: number,
  viewHeight: number,
  videoWidth: number,
  videoHeight: number,
  mirror: boolean,
) {
  if (viewWidth < 2 || viewHeight < 2 || videoWidth < 2 || videoHeight < 2) return null;
  const crop = coverCrop(videoWidth, videoHeight, viewWidth, viewHeight);
  const displayed = crop.u0 + (localX / viewWidth) * (crop.u1 - crop.u0);
  const x = mirror ? crop.u0 + crop.u1 - displayed : displayed;
  const y = crop.v0 + (localY / viewHeight) * (crop.v1 - crop.v0);
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
