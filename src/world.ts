import {createTexture, createFramebuffer, SIM_SPEED, CHUNK_SIZE, range, CHUNK_COUNT} from "./utils";
import ResourceHandler from "./ResourceHandler";
import Compute from "./Compute";
import Shader from "./shader";
import Vector from "./Vector";
import Chunk from "./Chunk";
import { SaveSystem } from "./SaveSystem";

interface WorldSaveData {
  name: string;
  seed: number;
  chunks: {[key: number]: Uint16Array}
  frame: number;
}

export default class World {
  public chunks: Map<number, Chunk>;

  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  private simulateShader: Shader;
  private screenShader: Shader;
  private worldShader: Shader;
  private raycastCompute: Compute;
  private collisionCompute: Compute;

  private width: number;
  private height: number;

  private screenTex: WebGLTexture;
  private screenFb: WebGLFramebuffer;

  private simTime: number;

  private chunkTextureSamples: Int32Array;

  private sun = Vector.zero();

  private chunkIndecies: number[];

  public frame: number = 0;

  private seed: number;

  // settings
  private _pixelScale: number = 0.3;
  public smoothing: boolean = true;
  public godrays: boolean = true;
  public renderDistance: number = 200;
  public debugReflections: boolean = true;
  public debugShadows: boolean = true;
  public debugVisualize: number = 0;
  public brushSize: number = 1;


  constructor(gl: WebGL2RenderingContext) {
    this.simTime = performance.now();
    this.chunks = new Map();
    this.chunkIndecies = [];
    this.gl = gl;
    this.seed = Math.floor(Math.random() * 1000000);

    this.resize();
  }

  public resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.screenTex = createTexture(
      this.gl, null,
      this.width * this.pixelScale,
      this.height * this.pixelScale,
      this.gl.RGBA, this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.screenTex
    );
  }

  public async init() {
    // create all chunks size*size
    console.log("Generate chunks");
    this.chunkTextureSamples = new Int32Array(range(CHUNK_COUNT));
    console.log("Finished chunks");

    this.simulateShader = new Shader(this.gl).create(new Map([
      [this.gl.VERTEX_SHADER, await ResourceHandler.get("../res/simulate.vs.glsl")],
      [this.gl.FRAGMENT_SHADER, await ResourceHandler.get("../res/simulate.fs.glsl")],
    ]));

    this.worldShader = new Shader(this.gl).create(new Map([
      [this.gl.VERTEX_SHADER, await ResourceHandler.get("../res/world.vs.glsl")],
      [this.gl.FRAGMENT_SHADER, await ResourceHandler.get("../res/world.fs.glsl")],
    ]));

    this.screenShader = new Shader(this.gl).create(new Map([
      [this.gl.VERTEX_SHADER, await ResourceHandler.get("../res/screen.vs.glsl")],
      [this.gl.FRAGMENT_SHADER, await ResourceHandler.get("../res/screen.fs.glsl")],
    ]));

    this.raycastCompute = new Compute(this.gl);
    await this.raycastCompute.setup("../res/raycast.vs.glsl", 1, [], [
      { name: "voxelId", bytes: 4, size: 1, type: this.gl.INT   },
      { name: "pos",     bytes: 4, size: 3, type: this.gl.INT   },
      { name: "normal",  bytes: 4, size: 3, type: this.gl.FLOAT },
    ]);

    this.collisionCompute = new Compute(this.gl);
    await this.collisionCompute.setup("../res/collision.vs.glsl", 1, [], [
      { name: "nextCamPos", bytes: 4, size: 3, type: this.gl.FLOAT },
      { name: "nextCamVel", bytes: 4, size: 3, type: this.gl.FLOAT },
      { name: "onground", bytes: 4, size: 1, type: this.gl.INT },
    ]);


    // setup a full canvas clip space quad
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), this.gl.STATIC_DRAW);

    // Create a vertex array object (attribute state)
    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    // setup our attributes to tell WebGL how to pull
    // the data from the buffer above to the position attribute
    this.gl.enableVertexAttribArray(this.simulateShader.attribute("position"));
    this.gl.vertexAttribPointer(this.simulateShader.attribute("position"), 2, this.gl.FLOAT, false, 0, 0);

    // Create framebuffer for screen anti-aliasing, screenTex generated in resize()
    this.screenFb = createFramebuffer(this.gl, this.screenTex);
  }

  public getChunkIndeciesAt(centerChunk: Vector): number[] {
    return range(CHUNK_COUNT).map((i) => Chunk.posToIdx(Vector.add(centerChunk, new Vector(
      (i % CHUNK_SIZE) - 1,
      0,
      Math.floor(i / CHUNK_SIZE) - 1
    ))));
  }

  public getCenterChunk(camPos: Vector): Vector {
    return new Vector(
      Math.floor(camPos.x / Chunk.SIZE + 0.5),
      0,
      Math.floor(camPos.z / Chunk.SIZE + 0.5)
    );
  }

  public simulate(centerChunk: Vector, camPos: Vector, camDir: Vector): boolean {
    if (performance.now() < this.simTime + SIM_SPEED)
      return false;

    this.simTime = performance.now();

    this.gl.bindVertexArray(this.vao);

    // loop through all chunks
    this.bindChunks();

    this.simulateShader.use();
    this.gl.uniform1iv(this.simulateShader.uniform("chunks"), this.chunkTextureSamples);
    this.gl.uniform3i(this.simulateShader.uniform("centerChunk"), ...centerChunk.toXYZ());
    this.gl.uniform1f(this.simulateShader.uniform("time"), performance.now() / 1000);
    this.gl.uniform1i(this.simulateShader.uniform("frame"), this.frame++);
    this.gl.uniform1f(this.simulateShader.uniform("brushSize"), this.brushSize / 1.5);
    this.gl.uniform3f(this.simulateShader.uniform("lightDir"), ...this.sun.toXYZ());

    this.chunkIndecies.forEach((v, i) => {
      this.chunks.get(v).simulate(this.simulateShader, i);
    });

    this.simulateShader.unuse();

    return true;
  }

  private updateSun() {
    const time = this.getTime();
    this.sun.set(Math.sin(time) * 0.5, Math.cos(time), Math.cos(time) * 0.5).normalize();
  }

  public getTime(): number {
    return (this.frame / 10000 - 1.2);
  }

  /**
   * Returns a number between -1 (night) and 1 (day)
   **/
  public getDayNight(): number {
    return Math.cos(this.getTime());
  }

  private updateChunkIndecies(centerChunk: Vector) {
    const newChunkIndecies = this.getChunkIndeciesAt(centerChunk);
    this.chunkIndecies.forEach(v => {
      const chunk = this.chunks.get(v);
      if (!newChunkIndecies.includes(v) && !chunk.hasEdit) {
        chunk.destroy();
        this.chunks.delete(v);
      }
    });
    this.chunkIndecies = newChunkIndecies;
  }

  public render(camPos: Vector, camDir: Vector) {
    const centerChunk = this.getCenterChunk(camPos);
    this.updateChunkIndecies(centerChunk);

    // Update chunks
    this.chunkIndecies.forEach((v) => {
      if (!this.chunks.has(v))
        this.chunks.set(v, new Chunk(this.gl, v));
    });

    this.updateSun();
    this.simulate(centerChunk, camPos, camDir);

    this.gl.bindVertexArray(this.vao);

    // render scene in temp framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.screenFb);
    this.gl.viewport(0, 0, this.width * this.pixelScale, this.height * this.pixelScale);

    this.bindChunks();

    this.worldShader.use();
    this.gl.uniform1iv(this.worldShader.uniform("chunks"), this.chunkTextureSamples);
    this.gl.uniform1f(this.worldShader.uniform("time"), performance.now() / 1000);
    this.gl.uniform2f(this.worldShader.uniform("resolution"), this.width * this.pixelScale, this.height * this.pixelScale);
    this.gl.uniform3f(this.worldShader.uniform("camPos"), ...camPos.toXYZ());
    this.gl.uniform3f(this.worldShader.uniform("camDir"), ...camDir.toXYZ());
    this.gl.uniform3f(this.worldShader.uniform("lightDir"), ...this.sun.toXYZ());
    this.gl.uniform3i(this.worldShader.uniform("centerChunk"), ...centerChunk.toXYZ());
    this.gl.uniform1i(this.worldShader.uniform("debugReflections"), this.debugReflections ? 1 : 0);
    this.gl.uniform1i(this.worldShader.uniform("debugShadows"), this.debugShadows ? 1 : 0);
    this.gl.uniform1i(this.worldShader.uniform("debugVisualize"), this.debugVisualize);
    this.gl.uniform1i(this.worldShader.uniform("renderDistance"), this.renderDistance);
    this.gl.uniform1f(this.worldShader.uniform("brushSize"), this.brushSize / 1.5);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.worldShader.unuse();


    // bind default framebuffer and render anti-aliased screen
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.width, this.height);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.screenTex);

    this.screenShader.use();
    this.gl.uniform1i(this.screenShader.uniform("tex"), 0);
    this.gl.uniform2f(this.screenShader.uniform("scale"), this.pixelScale, this.pixelScale);
    this.gl.uniform2f(this.screenShader.uniform("resolution"), this.width, this.height);
    this.gl.uniform3f(this.screenShader.uniform("camDir"), ...camDir.toXYZ());
    this.gl.uniform3f(this.screenShader.uniform("lightDir"), ...this.sun.toXYZ());
    this.gl.uniform1i(this.screenShader.uniform("smoothing"), this.smoothing ? 1 : 0);
    this.gl.uniform1i(this.screenShader.uniform("godrays"), this.godrays ? 1 : 0);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.screenShader.unuse();
  }

  public updateCam(delta: number, camPos: Vector, camDir: Vector, camVel: Vector): boolean {
    this.bindChunks();

    const [_nextCamPos, _nextCamVel, _ground] = this.collisionCompute.compute({}, (shader) => {
      this.gl.uniform1iv(shader.uniform("chunks"), this.chunkTextureSamples);
      this.gl.uniform3i(shader.uniform("centerChunk"), ...this.getCenterChunk(camPos).toXYZ());
      this.gl.uniform3f(shader.uniform("camPos"), ...camPos.toXYZ());
      this.gl.uniform3f(shader.uniform("camVel"), ...camVel.toXYZ());
      this.gl.uniform3f(shader.uniform("camDir"), ...camDir.toXYZ());
      this.gl.uniform1f(shader.uniform("delta"), delta);
    });

    camPos.set(_nextCamPos[0], _nextCamPos[1], _nextCamPos[2]);
    camVel.set(_nextCamVel[0], _nextCamVel[1], _nextCamVel[2]);

    return _ground[0];
  }

  public set pixelScale(scale: number) {
    this._pixelScale = scale;
    this.resize();
  }

  public get pixelScale() {
    return this._pixelScale;
  }

  private bindChunks() {
    this.chunkIndecies.forEach((v, i) => {
      this.gl.activeTexture(this.gl.TEXTURE0 + i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.chunks.get(v).getTexture());
    });
  }

  public rayCast(camPos: Vector, camDir: Vector): { id: number, pos: Vector, normal: Vector } {
    this.bindChunks();

    const [_id, _pos, _normal] = this.raycastCompute.compute({}, (shader) => {
      this.gl.uniform1iv(shader.uniform("chunks"), this.chunkTextureSamples);
      this.gl.uniform3i(shader.uniform("centerChunk"), ...this.getCenterChunk(camPos).toXYZ());
      this.gl.uniform3f(shader.uniform("camPos"), ...camPos.toXYZ());
      this.gl.uniform3f(shader.uniform("camDir"), ...camDir.toXYZ());
    });

    return { 
      id: _id[0], 
      pos: new Vector(_pos[0], _pos[1], _pos[2]), 
      normal: new Vector(_normal[0], _normal[1], _normal[2]) 
    };
  }

  public playerPlace(camPos: Vector, camDir: Vector, voxelId: number): Vector {
    const { pos, normal } = this.rayCast(camPos, camDir);

    const destroy = voxelId == 0;
    const placePos = destroy ? pos : Vector.sub(pos, normal);

    const chunkPos = Vector.div(Vector.add(placePos, Vector.all(0)), Vector.all(Chunk.SIZE));
    const chunk = this.chunks.get(Chunk.posToIdx(chunkPos));

    chunk.placeBlock(placePos, voxelId);

    return pos;
  }

  public destroy() {
    this.worldShader.destroy();
    this.simulateShader.destroy();
    this.screenShader.destroy();
    this.raycastCompute.destroy();
    this.gl.deleteFramebuffer(this.screenFb);
    this.gl.deleteTexture(this.screenTex);
    this.gl.deleteVertexArray(this.vao);
    this.chunks.forEach((chunk) => chunk.destroy());
  }

  public save(name: string) {
    if (!name)
      return;

    const chunkData = {};

    for (const [key, chunk] of this.chunks.entries()) {
      if (!chunk.hasEdit) continue;

      chunkData[key] = chunk.saveData();
      console.log(`Chunk ${Chunk.idxToPos(key)} saved`);
    }

    const saveData: WorldSaveData = {
      name: name,
      seed: this.seed,
      chunks: chunkData,
      frame: this.frame,
    };
    
    SaveSystem.save(name, saveData);
  }

  public async load(name: string): Promise<boolean> {
    if (!name)
      return false;

    const saveData = await SaveSystem.load(name) as WorldSaveData;
    if (!saveData) 
      return false;

    this.seed = saveData.seed;
    this.frame = saveData.frame;

    for (const [key, chunk] of this.chunks.entries()) {
      if (!saveData.chunks[key]) {
        console.log(`Regenerate chunk ${Chunk.idxToPos(key)}`);
        chunk.doTerrainGeneration = true;
      }
    }

    for (const key of Object.keys(saveData.chunks)) {
      const ikey = parseInt(key);
      const chunk = this.chunks.has(ikey) ? this.chunks.get(ikey) : new Chunk(this.gl, ikey);
      chunk.loadData(saveData.chunks[key]);
      chunk.hasEdit = true;

      this.chunks.set(ikey, chunk);
      console.log(`Chunk ${Chunk.idxToPos(ikey)} loaded`);
    }

    return true;
  }
}
