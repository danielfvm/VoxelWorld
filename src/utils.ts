export const SIM_SPEED = 10;
export const CHUNK_SIZE = 2;
export const CHUNK_COUNT = CHUNK_SIZE * CHUNK_SIZE;

export function range(size: number): number[] {
  return Array.from({ length: size }, (_, k) => k);
}

export function createTexture(gl: WebGL2RenderingContext, data: ArrayBufferView, width: number, height: number, internalFormat: GLint, format: GLenum, type: GLint, texId: WebGLTexture = null): WebGLTexture {
  const tex = texId || gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,                // mip level
    internalFormat,
    width,
    height,
    0,                // border
    format,
    type,             // type
    data,
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

export function createFramebuffer(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return fb;
}

export function measure(): () => [number, number, number] {
  let start = performance.now();
  let timePast = 0;
  let rate = 1;
  let amount = 0;

  return () => {
    const delta = performance.now() - start;
    timePast += delta;
    amount ++;

    start = performance.now();

    if (timePast > 500) {
      rate = timePast / amount;
      timePast = 0;
      amount = 0;
    }

    const fps = 1000 / rate;

    return [rate, fps, delta];
  };
}
