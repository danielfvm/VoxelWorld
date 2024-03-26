import ResourceHandler from "./ResourceHandler";
import {generateVoxelProperty, generateVoxelIds, getVoxelProperties, generatePhyicsId} from "./VoxelData";

function createShader(gl: WebGLRenderingContext, sourceCode: string, type: number): WebGLShader {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    throw `Could not compile WebGL program. \n\n${info}`;
  }
  return shader;
}


export default class Shader {
  public pid: WebGLProgram;
  protected shaders: Map<GLenum, WebGLShader>;
  protected uniforms: Map<string, WebGLUniformLocation>;
  protected attributes: Map<string, GLuint>;
  protected gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.uniforms = new Map();
    this.attributes = new Map();
    this.shaders = new Map();
  }

  private format(code: string): string {
    if (code.includes("#defineGlobal")) {
      code = code.replace("#defineGlobal", this.format(ResourceHandler.getSynced("../res/global.glsl")));
    }

    if (code.includes("#defineVoxel")) {
      let prop = getVoxelProperties().map(name => generateVoxelProperty(name)).join('\n');
      prop = generateVoxelIds() + '\n' + prop;
      prop = generatePhyicsId() + '\n' + prop;
      code = code.replace("#defineVoxel", prop);
    }

    return code;
  }

  public create(shaders: Map<GLenum, string>, transformFeedbackVaryings: string[] = []): Shader {
    // Create shader program
    this.pid = this.gl.createProgram();

    // loop through all shaders and create and attach them to pid
    for (const [type, code] of shaders.entries()) {
      this.shaders[type] = createShader(this.gl, this.format(code), type);
      this.gl.attachShader(this.pid, this.shaders[type]);
    }

    if (transformFeedbackVaryings.length > 0) {
      this.gl.transformFeedbackVaryings(this.pid, transformFeedbackVaryings, this.gl.SEPARATE_ATTRIBS);
    }

    this.gl.linkProgram(this.pid);
    this.gl.useProgram(this.pid);

    // check compile status and print which shader had an error
    if (!this.gl.getProgramParameter(this.pid, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(this.pid);
      throw `Could not link WebGL program. \n\n${info}`;
    }

    return this;
  }

  public use() {
    this.gl.useProgram(this.pid);
  }

  public unuse() {
    this.gl.useProgram(null);
  }

  public uniform(name: string): WebGLUniformLocation {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.pid, name));
    }
    return this.uniforms.get(name)!;
  }

  public attribute(name: string): GLuint {
    if (!this.attributes.has(name)) {
      this.attributes.set(name, this.gl.getAttribLocation(this.pid, name));
    }
    return this.attributes.get(name)!;
  }

  public destroy() {
    for (const shader of this.shaders.values()) {
      this.gl.detachShader(this.pid, shader);
      this.gl.deleteShader(shader);
    }

    this.gl.deleteProgram(this.pid);
  }
}
