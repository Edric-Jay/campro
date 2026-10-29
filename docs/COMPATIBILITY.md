# Compatibility

This app uses the browser camera only. A control is enabled after the live track reports it. A desktop webcam with empty capabilities is a successful run: the preview and shutter work, and the Pro dials stay unavailable.

## Chrome on Android

The broadest browser surface. `ImageCapture` sometimes exposes shutter (`exposureTime`) and ISO for the still. The track often exposes zoom, torch, focus mode, focus distance, exposure compensation, white balance, color temperature, and tap points. The viewfinder may not match a manual shutter or ISO, and the UI says so. Physical lens names such as 0.5× and 2× are not available. RAW is not available.

## Chrome on desktop

Preview, looks, JPEG capture, and gallery work. Most webcams do not expose shutter, ISO, aperture, torch, or manual focus. Zoom and exposure compensation appear only if the camera reports them. White balance is a labeled preview grade unless the webcam exposes it.

## Safari on iOS

`getUserMedia` preview and `MediaRecorder` can work. `ImageCapture` is absent, so shutter speed and ISO stay unavailable. Torch, focus, and white balance depend on the iOS version and are enabled only when reported. Level needs a device-orientation permission tap.

## Firefox

Preview and capture work. Advanced track constraints and `ImageCapture` are usually missing, so Pro controls stay disabled.

## Not in this app

Android Camera2 / CameraX and iOS AVFoundation are not implemented. A browser build cannot honestly offer sensor controls those native APIs would add, so those paths are omitted rather than simulated.
