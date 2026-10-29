# camLUT Pro

A mobile-first Next.js camera. The viewfinder, shutter, film looks, and gallery run in the browser. Manual controls change the camera only when `MediaStreamTrack` or `ImageCapture` reports them.

Photos and settings stay in IndexedDB on the device. Nothing is uploaded.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The page must be served from localhost or HTTPS, or the browser will block the camera.

```bash
npm test
npm run test:e2e
```

The Playwright test uses Chromium’s fake camera. Install the browser once with `npx playwright install chromium` if the end-to-end run asks for it.

## What this build is

Chrome on Android is the only browser where shutter, ISO, exposure compensation, focus, white balance, zoom, and torch sometimes show up together. Desktop webcams and Firefox keep the preview, looks, shutter, and gallery, and leave unsupported dials disabled. Safari has no `ImageCapture`, so shutter speed and ISO stay unavailable there.

Native Android CameraX and iOS AVFoundation are not part of this web app. See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) and [docs/FEATURES.md](docs/FEATURES.md).
