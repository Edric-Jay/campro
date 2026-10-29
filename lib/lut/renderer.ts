import { BUILTIN_LOOK_INDEX } from "./builtin";
import type { Lut3D } from "./grade";
import type { Rgb } from "./color";

export type WebGlKind = "webgl2" | "webgl1" | "none";

export interface DrawState {
  intensity: number;
  mirror: boolean;
  wbGains: Rgb;
  crop: { u0: number; v0: number; u1: number; v1: number };
}

const VERT_1 = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG_1 = `
precision mediump float;
uniform sampler2D uVideo;
uniform sampler2D uLut;
uniform vec4 uCrop;
uniform float uIntensity;
uniform vec3 uWbGains;
uniform float uLutSize;
uniform float uLook;
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
vec3 grade(vec3 c, float look) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 result = c;
  if (look < 0.5) {
    result = (c - 0.5) * 1.06 + 0.5;
  } else if (look < 1.5) {
    result = c * vec3(1.08, 1.02, 0.94);
    result = (result - 0.5) * 1.08 + 0.5;
  } else if (look < 2.5) {
    result = c * vec3(1.14, 1.02, 0.84);
    result += vec3(0.045, 0.012, -0.03) * l;
    result += vec3(-0.03, 0.02, 0.06) * (1.0 - l);
  } else if (look < 3.5) {
    result = c * vec3(0.9, 0.98, 1.16);
    result = (result - 0.5) * 1.16 + 0.48;
  } else if (look < 4.5) {
    result = c * vec3(0.92, 1.0, 1.12);
    result += vec3(-0.01, 0.01, 0.03);
  } else if (look < 5.5) {
    result = (c - 0.5) * 0.75 + 0.56;
    result = mix(result, vec3(l), 0.28);
  } else if (look < 6.5) {
    result = c * vec3(1.12, 1.03, 0.86);
    result = (result - 0.5) * 0.9 + 0.52;
  } else if (look < 7.5) {
    result = c * vec3(0.94, 1.1, 0.9);
    result = (result - 0.5) * 0.88 + 0.53;
  } else if (look < 8.5) {
    result = c * vec3(1.08, 1.0, 0.92);
    result = (result - 0.5) * 0.92 + 0.51;
  } else if (look < 9.5) {
    result = (c * vec3(1.05, 1.01, 0.95) - 0.5) * 0.86 + 0.52;
  } else if (look < 10.5) {
    result = (c - 0.5) * 1.32 + 0.5;
    result = mix(vec3(l), result, 0.4);
  } else if (look < 11.5) {
    float g = clamp((l - 0.5) * 1.15 + 0.5, 0.0, 1.0);
    result = vec3(g);
  } else if (look < 12.5) {
    result = c * vec3(0.91, 1.01, 1.10);
    result += vec3(0.035, 0.012, -0.008) * l;
  } else if (look < 13.5) {
    result = (c * vec3(1.09, 1.015, 0.91) - 0.5) * 0.88 + 0.53;
  } else if (look < 14.5) {
    float g = (l - 0.5) * 1.13 + 0.5;
    result = vec3(g);
  } else if (look < 15.5) {
    result = c * vec3(1.12, 1.02, 0.86);
    result += vec3(0.045, 0.018, -0.025) * l;
  } else if (look < 16.5) {
    result = (c - 0.5) * 1.18 + 0.5;
    result = mix(vec3(l), result * vec3(1.04, 1.0, 0.96), 0.8);
  } else if (look < 17.5) {
    result = c * vec3(0.96, 1.08, 0.91);
    result.g += 0.025 * (1.0 - l);
  } else if (look < 18.5) {
    result = c + vec3(0.0, 0.025, 0.045) * (1.0 - l);
    result.r += 0.055 * l;
    result.b *= 0.94;
  } else if (look < 19.5) {
    result = (c - 0.5) * 0.78 + 0.55;
    result = mix(result, vec3(l) * 0.8 + 0.15, 0.15);
  } else if (look < 20.5) {
    float g = clamp((l - 0.5) * 1.45 + 0.5, 0.0, 1.0);
    result = vec3(g);
  } else if (look < 21.5) {
    result = c * vec3(0.88, 1.04, 1.15);
    result += vec3(-0.015, 0.015, 0.035);
  } else if (look < 22.5) {
    result = c * vec3(1.10, 1.02, 0.88);
    result = (result - 0.5) * 0.85 + 0.55;
  } else if (look < 23.5) {
    result = mix(c, vec3(l), 0.18);
    result = result * 0.88 + 0.08;
    result += vec3(0.045, 0.015, 0.035);
  } else {
    result = (c - 0.5) * 1.16 + 0.46;
    result += vec3(-0.03, 0.02, 0.04) * (1.0 - l);
    result += vec3(0.06, 0.025, -0.03) * l;
    result.r *= 1.08;
    result.g += 0.015;
    result = mix(result, vec3(1.0), smoothstep(0.72, 0.98, l) * 0.35);
  }
  return clamp(result, 0.0, 1.0);
}
void main() {
  vec2 uv = mix(uCrop.xy, uCrop.zw, vUv);
  vec3 color = texture2D(uVideo, uv).rgb;
  if (uLook > 23.5 && uLook < 24.5) {
    vec2 o = vec2(0.0022, 0.0030);
    color = color * 0.36
      + texture2D(uVideo, uv + vec2(o.x, 0.0)).rgb * 0.16
      + texture2D(uVideo, uv - vec2(o.x, 0.0)).rgb * 0.16
      + texture2D(uVideo, uv + vec2(0.0, o.y)).rgb * 0.16
      + texture2D(uVideo, uv - vec2(0.0, o.y)).rgb * 0.16;
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    color += (n - 0.5) * 0.04;
  }
  color = clamp(color * uWbGains, 0.0, 1.0);
  vec3 graded = uLook < 0.0 ? lookup(color, max(uLutSize, 2.0)) : grade(color, uLook);
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

function lookIndex(lut: Lut3D) {
  return BUILTIN_LOOK_INDEX[lut.id] ?? -1;
}

function createPass(canvas: HTMLCanvasElement): Pass {
  const gl = (canvas.getContext("webgl", GL_ATTRIBUTES) ??
    canvas.getContext("experimental-webgl", GL_ATTRIBUTES)) as GL | null;
  if (!gl) throw new Error("WebGL is unavailable.");
  const vertex = compile(gl, gl.VERTEX_SHADER, VERT_1);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAG_1);
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
  gl.bindTexture(gl.TEXTURE_2D, lutTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(16).fill(255));
  const names = ["uVideo", "uLut", "uCrop", "uIntensity", "uWbGains", "uLutSize", "uLook"];
  const loc: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) loc[name] = gl.getUniformLocation(program, name);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return { gl, canvas, program, videoTexture, lutTexture, buffer, is2: false, loc };
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
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const rgba = rgbaFromLut(lut);
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
  look: number,
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
  gl.bindTexture(gl.TEXTURE_2D, pass.lutTexture);
  const u0 = state.mirror ? state.crop.u1 : state.crop.u0;
  const u1 = state.mirror ? state.crop.u0 : state.crop.u1;
  gl.uniform1i(pass.loc.uVideo, 0);
  gl.uniform1i(pass.loc.uLut, 1);
  gl.uniform4f(pass.loc.uCrop, u0, state.crop.v0, u1, state.crop.v1);
  gl.uniform1f(pass.loc.uIntensity, state.intensity);
  gl.uniform3f(pass.loc.uWbGains, state.wbGains[0], state.wbGains[1], state.wbGains[2]);
  gl.uniform1f(pass.loc.uLutSize, lutSize);
  gl.uniform1f(pass.loc.uLook, look);
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
    this.view = createPass(canvas);
    this.kind = "webgl1";
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
    drawPass(this.view, video, width, height, state, this.lut.size, lookIndex(this.lut));
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
      this.exporter = createPass(document.createElement("canvas"));
      uploadLut(this.exporter, this.lut);
    }
    // ImageBitmap uploads ignore UNPACK_FLIP_Y_WEBGL, which turns the still upside down.
    // Drawing it onto a canvas first uses the same path as the live preview.
    let upload: CanvasImageSource = source;
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      const scratch = document.createElement("canvas");
      scratch.width = width;
      scratch.height = height;
      const context = scratch.getContext("2d");
      if (!context) throw new Error("Could not prepare the still.");
      context.drawImage(source, 0, 0, width, height);
      upload = scratch;
    }
    drawPass(
      this.exporter,
      upload,
      width,
      height,
      { ...state, mirror: false, crop: { u0: 0, v0: 0, u1: 1, v1: 1 } },
      this.lut.size,
      lookIndex(this.lut),
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
