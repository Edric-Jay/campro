import type { Lut3D } from "./grade";
import type { Rgb } from "./color";

export type WebGlKind = "webgl2" | "webgl1" | "none";

export interface DrawState {
  intensity: number;
  mirror: boolean;
  wbGains: Rgb;
  crop: { u0: number; v0: number; u1: number; v1: number };
}

const VERT_2 = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG_2 = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uVideo;
uniform sampler3D uLut;
uniform vec4 uCrop;
uniform float uIntensity;
uniform vec3 uWbGains;
uniform float uLutSize;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 uv = mix(uCrop.xy, uCrop.zw, vUv);
  vec3 color = texture(uVideo, uv).rgb;
  color = clamp(color * uWbGains, 0.0, 1.0);
  float size = max(uLutSize, 2.0);
  vec3 coord = (color * (size - 1.0) + 0.5) / size;
  vec3 graded = texture(uLut, coord).rgb;
  color = mix(color, graded, clamp(uIntensity, 0.0, 1.0));
  outColor = vec4(color, 1.0);
}`;

const VERT_1 = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG_1 = `
precision highp float;
uniform sampler2D uVideo;
uniform sampler2D uLut;
uniform vec4 uCrop;
uniform float uIntensity;
uniform vec3 uWbGains;
uniform float uLutSize;
varying vec2 vUv;
vec3 lookup(vec3 color, float size) {
  float z = clamp(color.b, 0.0, 1.0) * (size - 1.0);
  float z0 = floor(z);
  float z1 = min(z0 + 1.0, size - 1.0);
  float f = z - z0;
  float x0 = (z0 * size + color.r * (size - 1.0) + 0.5) / (size * size);
  float x1 = (z1 * size + color.r * (size - 1.0) + 0.5) / (size * size);
  float y = (color.g * (size - 1.0) + 0.5) / size;
  vec3 a = texture2D(uLut, vec2(x0, y)).rgb;
  vec3 b = texture2D(uLut, vec2(x1, y)).rgb;
  return mix(a, b, f);
}
void main() {
  vec2 uv = mix(uCrop.xy, uCrop.zw, vUv);
  vec3 color = texture2D(uVideo, uv).rgb;
  color = clamp(color * uWbGains, 0.0, 1.0);
  vec3 graded = lookup(color, max(uLutSize, 2.0));
  color = mix(color, graded, clamp(uIntensity, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);
}`;

type GL = WebGL2RenderingContext | WebGLRenderingContext;

interface Pass {
  gl: GL;
  canvas: HTMLCanvasElement;
  program: WebGLProgram;
  videoTexture: WebGLTexture;
  lutTexture: WebGLTexture;
  buffer: WebGLBuffer;
  is2: boolean;
  loc: Record<string, WebGLUniformLocation | null>;
}

function compile(gl: GL, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Shader compile failed.";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

const GL_ATTRIBUTES = {
  alpha: false,
  antialias: false,
  depth: false,
  preserveDrawingBuffer: true,
  premultipliedAlpha: false,
} as const;

function createPass(canvas: HTMLCanvasElement, is2: boolean): Pass {
  const gl = (
    is2 ? canvas.getContext("webgl2", GL_ATTRIBUTES) : canvas.getContext("webgl", GL_ATTRIBUTES)
  ) as GL | null;
  if (!gl) throw new Error("WebGL is unavailable.");
  const vertex = compile(gl, gl.VERTEX_SHADER, is2 ? VERT_2 : VERT_1);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, is2 ? FRAG_2 : FRAG_1);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed.");
  }
  const buffer = gl.createBuffer();
  const videoTexture = gl.createTexture();
  const lutTexture = gl.createTexture();
  if (!buffer || !videoTexture || !lutTexture) throw new Error("Could not allocate WebGL resources.");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const names = ["uVideo", "uLut", "uCrop", "uIntensity", "uWbGains", "uLutSize"];
  const loc: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) loc[name] = gl.getUniformLocation(program, name);
  return { gl, canvas, program, videoTexture, lutTexture, buffer, is2, loc };
}

function rgbaFromLut(lut: Lut3D) {
  const rgba = new Uint8Array(lut.size * lut.size * lut.size * 4);
  for (let index = 0, pixel = 0; index < lut.data.length; index += 3, pixel += 4) {
    rgba[pixel] = Math.round(Math.min(1, Math.max(0, lut.data[index])) * 255);
    rgba[pixel + 1] = Math.round(Math.min(1, Math.max(0, lut.data[index + 1])) * 255);
    rgba[pixel + 2] = Math.round(Math.min(1, Math.max(0, lut.data[index + 2])) * 255);
    rgba[pixel + 3] = 255;
  }
  return rgba;
}

function uploadLut(pass: Pass, lut: Lut3D) {
  const { gl } = pass;
  const rgba = rgbaFromLut(lut);
  if (pass.is2) {
    const gl2 = gl as WebGL2RenderingContext;
    gl2.bindTexture(gl2.TEXTURE_3D, pass.lutTexture);
    gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_MIN_FILTER, gl2.LINEAR);
    gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_MAG_FILTER, gl2.LINEAR);
    gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
    gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
    gl2.texParameteri(gl2.TEXTURE_3D, gl2.TEXTURE_WRAP_R, gl2.CLAMP_TO_EDGE);
    gl2.texImage3D(
      gl2.TEXTURE_3D,
      0,
      gl2.RGBA,
      lut.size,
      lut.size,
      lut.size,
      0,
      gl2.RGBA,
      gl2.UNSIGNED_BYTE,
      rgba,
    );
    return;
  }
  const size = lut.size;
  const atlas = new Uint8Array(size * size * size * 4);
  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        const source = ((blue * size + green) * size + red) * 4;
        const x = blue * size + red;
        const dest = (green * size * size + x) * 4;
        atlas[dest] = rgba[source];
        atlas[dest + 1] = rgba[source + 1];
        atlas[dest + 2] = rgba[source + 2];
        atlas[dest + 3] = 255;
      }
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, pass.lutTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size * size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
}

function drawPass(
  pass: Pass,
  source: CanvasImageSource,
  width: number,
  height: number,
  state: DrawState,
  lutSize: number,
) {
  const { gl } = pass;
  if (pass.canvas.width !== width || pass.canvas.height !== height) {
    pass.canvas.width = width;
    pass.canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.useProgram(pass.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, pass.buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, pass.videoTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
  gl.activeTexture(gl.TEXTURE1);
  if (pass.is2) gl.bindTexture((gl as WebGL2RenderingContext).TEXTURE_3D, pass.lutTexture);
  else gl.bindTexture(gl.TEXTURE_2D, pass.lutTexture);
  const u0 = state.mirror ? state.crop.u1 : state.crop.u0;
  const u1 = state.mirror ? state.crop.u0 : state.crop.u1;
  gl.uniform1i(pass.loc.uVideo, 0);
  gl.uniform1i(pass.loc.uLut, 1);
  gl.uniform4f(pass.loc.uCrop, u0, state.crop.v0, u1, state.crop.v1);
  gl.uniform1f(pass.loc.uIntensity, state.intensity);
  gl.uniform3f(pass.loc.uWbGains, state.wbGains[0], state.wbGains[1], state.wbGains[2]);
  gl.uniform1f(pass.loc.uLutSize, lutSize);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function destroyPass(pass: Pass | null) {
  if (!pass) return;
  pass.gl.deleteProgram(pass.program);
  pass.gl.deleteTexture(pass.videoTexture);
  pass.gl.deleteTexture(pass.lutTexture);
  pass.gl.deleteBuffer(pass.buffer);
}

export function coverCrop(videoWidth: number, videoHeight: number, viewWidth: number, viewHeight: number) {
  const videoAspect = videoWidth / Math.max(1, videoHeight);
  const viewAspect = viewWidth / Math.max(1, viewHeight);
  if (videoAspect > viewAspect) {
    const visible = viewAspect / videoAspect;
    const pad = (1 - visible) / 2;
    return { u0: pad, v0: 0, u1: 1 - pad, v1: 1 };
  }
  const visible = videoAspect / viewAspect;
  const pad = (1 - visible) / 2;
  return { u0: 0, v0: pad, u1: 1, v1: 1 - pad };
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0) reject(new Error("Could not encode JPEG."));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

export class LutRenderer {
  readonly kind: WebGlKind;
  private view: Pass | null = null;
  private exporter: Pass | null = null;
  private lut: Lut3D | null = null;
  private sampleCanvas: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl2 = canvas.getContext("webgl2", GL_ATTRIBUTES);
    if (gl2) {
      try {
        this.view = createPass(canvas, true);
        this.kind = "webgl2";
      } catch {
        this.view = null;
        this.kind = "none";
      }
      return;
    }
    try {
      this.view = createPass(canvas, false);
      this.kind = this.view ? "webgl1" : "none";
    } catch {
      this.view = null;
      this.kind = "none";
    }
  }

  setLut(lut: Lut3D) {
    this.lut = lut;
    if (this.view) uploadLut(this.view, lut);
    if (this.exporter) uploadLut(this.exporter, lut);
  }

  draw(video: HTMLVideoElement, state: DrawState) {
    if (!this.view || !this.lut || video.readyState < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.round(this.view.canvas.clientWidth * dpr));
    const height = Math.max(2, Math.round(this.view.canvas.clientHeight * dpr));
    if (this.view.canvas.clientWidth < 2 || this.view.canvas.clientHeight < 2) return;
    drawPass(this.view, video, width, height, state, this.lut.size);
  }

  readAnalysis() {
    if (!this.view || this.view.canvas.width < 2) return null;
    const width = 160;
    const height = Math.max(
      2,
      Math.min(120, Math.round((width * this.view.canvas.height) / this.view.canvas.width)),
    );
    if (!this.sampleCanvas) this.sampleCanvas = document.createElement("canvas");
    this.sampleCanvas.width = width;
    this.sampleCanvas.height = height;
    const context = this.sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(this.view.canvas, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return { pixels: image.data, width, height };
  }

  async snapshot() {
    if (!this.view || this.view.canvas.width < 2) throw new Error("The viewfinder frame is not ready.");
    return canvasToJpeg(this.view.canvas, 0.86);
  }

  async gradeSource(source: CanvasImageSource, width: number, height: number, state: DrawState) {
    if (!this.view || !this.lut) throw new Error("The look could not be applied.");
    if (!this.exporter) {
      this.exporter = createPass(document.createElement("canvas"), this.view.is2);
      uploadLut(this.exporter, this.lut);
    }
    drawPass(
      this.exporter,
      source,
      width,
      height,
      { ...state, mirror: false, crop: { u0: 0, v0: 0, u1: 1, v1: 1 } },
      this.lut.size,
    );
    return canvasToJpeg(this.exporter.canvas, 0.92);
  }

  destroy() {
    destroyPass(this.view);
    destroyPass(this.exporter);
    this.view = null;
    this.exporter = null;
  }
}
