# Features

## Implemented

- Camera permission, live preview, front and rear switch, and release of the camera when leaving the page or hiding the tab.
- Shutter that saves a JPEG plus the original still blob in IndexedDB.
- Gallery and a capture review screen with favorite, delete, download, and share when the browser allows sharing.
- Twelve original film looks, intensity from 0% to 100%, favorites, recents, and `.cube` import up to size 64 and 5 MB. 1D LUTs are expanded to a 33³ lattice for the GPU.
- WebGL2 3D LUT preview, with a WebGL1 atlas fallback. If WebGL is missing, the ungraded video stays up and looks are disabled.
- Capability probe from `getCapabilities()`, `getSettings()`, and `ImageCapture` when it exists. Each control is marked supported, partial, preview-only, or unavailable.
- Pro dials for the controls the active track actually exposes: exposure compensation, zoom, torch, focus mode, focus distance, white balance, color temperature, and still-only shutter and ISO through `takePhoto`.
- Histogram, zebra, focus peaking, preview meter, clipping readout, false color, thirds, golden ratio, crosshair, safe frame, and horizon level when the device orientation sensor is available.
- Timer (2s, 5s, 10s) and rapid sequential stills.
- Video mode that records the graded viewfinder canvas, with microphone permission requested only when recording starts.
- Settings, presets, import and export of configuration, and restore defaults.

## Partial

- Shutter speed and ISO, when present, are sent with the still. The live viewfinder often does not follow them.
- Focus and exposure points use `pointsOfInterest` when the track lists it. A green mark means the browser accepted the request, not that the sensor confirmed focus.
- Focus peaking and the exposure meter measure the viewfinder image. They are not sensor confirmation.
- White balance falls back to a preview grade, clearly labeled, when the sensor does not expose it. That grade is in the viewfinder and the saved JPEG. It is not sensor white balance.
- Zoom is digital zoom on the camera track. It does not switch physical lenses. When the camera reports zoom starting at 100, that value is 1×, and the dial shows the magnification beside the reported range.
- Shutter speeds on the dial are seconds. Chrome on Windows reports `exposureTime` in 100-microsecond units; those ranges are converted before a stop is enabled, and the constraint is sent back in the camera's units.
- Video is a re-encoded graded preview, not the camera’s original stream. Frame rate and size are whatever the device accepts.
- Rapid stills are several shutter presses in a row, not a hardware burst.
- Aperture is shown only when the camera reports a number, and it cannot be changed.
- Preview magnify is a digital crop of the viewfinder, not focus.

## Unavailable in this web app

- Bulb exposure.
- Shutter priority and ISO priority.
- Hardware matrix, center-weighted, and spot metering modes.
- Aperture control on fixed lenses.
- RAW, DNG, and HEIF.
- Tint.
- Volume-button shutter, Bluetooth remote, and headphone trigger.
- Battery and disk space on browsers that do not report them. Storage is shown as the browser quota when `navigator.storage.estimate()` exists.
- Android CameraX / Camera2 and iOS AVFoundation. This repository is the Next.js app only.
