import Shader from "./shader";
import ResourceHandler from "./ResourceHandler";

export interface Data {
  name: string;
  size: number;
  bytes: number;
  type: GLenum;
}

export default class Compute {
  private gl: WebGL2RenderingContext;
  public shader: Shader;
  private inputBuffers: {[name: string]: WebGLBuffer} = {};
  private outputBuffers: WebGLBuffer[] = [];
  private vao: WebGLVertexArrayObject;
  private size: number;
  private tf: WebGLTransformFeedback;
  private output: Data[];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  private makeBuffer(size: number) {
    const buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, size, this.gl.STATIC_DRAW);
    return buf;
  }

  private setAttribute(loc: number, type: GLenum) {
    // setup our attributes to tell WebGL how to pull
    // the data from the buffer above to the attribute
    this.gl.enableVertexAttribArray(loc);
    this.gl.vertexAttribPointer(
      loc,
      1,         // size (num components)
      type,  // type of data in buffer
      false,     // normalize
      0,         // stride (0 = auto)
      0,         // offset
    );
  }

  public async setup(shaderPath: string, size: number, input: Data[], output: Data[]) {
    this.size = size;
    this.output = output;

    // Create a vertex array object (attribute state)
    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    // Create and fill out a transform feedback
    this.tf = this.gl.createTransformFeedback();
    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, this.tf);

    this.shader = new Shader(this.gl).create(new Map([
      [this.gl.VERTEX_SHADER, await ResourceHandler.get(shaderPath)], // TODO: edit this
      [this.gl.FRAGMENT_SHADER, await ResourceHandler.get("../res/compute.fs.glsl")],
    ]), output.map(data => data.name));

    input.forEach(data => {
      const loc = this.shader.attribute(data.name);
      const buf = this.makeBuffer(size * data.size);
      this.setAttribute(loc, data.type);
      this.inputBuffers[data.name] = buf;
    });

    this.outputBuffers = output.map((data, i) => {
      const buf = this.makeBuffer(size * data.size * data.size * data.bytes);
      this.gl.bindBufferBase(this.gl.TRANSFORM_FEEDBACK_BUFFER, i, buf);
      return buf;
    });

    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, null);

    // buffer's we are writing to can not be bound else where
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindVertexArray(null);
  }

  public compute(data: {[name: string]: BufferSource}, uniformCallback: (shader: Shader) => void = null): BufferSource[] {
    this.shader.use();

    // bind our input attribute state for the a and b buffers
    this.gl.bindVertexArray(this.vao);

    Object.keys(data).forEach(name => {
      const value = data[name];
      const buffer = this.inputBuffers[name];

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, value);
    });

    uniformCallback?.(this.shader);

    // no need to call the fragment shader
    this.gl.enable(this.gl.RASTERIZER_DISCARD);

    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, this.tf);
    this.gl.beginTransformFeedback(this.gl.POINTS);
    this.gl.drawArrays(this.gl.POINTS, 0, this.size);
    this.gl.endTransformFeedback();
    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, null);

    // turn on using fragment shaders again
    this.gl.disable(this.gl.RASTERIZER_DISCARD);

    const result = this.outputBuffers.map((buffer, i) => {
      const type = this.output[i].type == this.gl.INT ? Int32Array : Float32Array;
      const data = new type(this.size * this.output[i].size);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.getBufferSubData(this.gl.ARRAY_BUFFER, 0, data);

      return data;
    });

    // unbind
    this.gl.bindVertexArray(null);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    this.shader.unuse();

    return result;
  }

  public destroy() {
    this.shader && this.shader.destroy();
    this.tf && this.gl.deleteTransformFeedback(this.tf);
    this.vao && this.gl.deleteVertexArray(this.vao);
    Object.values(this.inputBuffers).forEach(buf => this.gl.deleteBuffer(buf));
    this.outputBuffers.forEach(buf => this.gl.deleteBuffer(buf));
  }
}
