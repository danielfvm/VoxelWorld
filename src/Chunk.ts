import {createTexture, createFramebuffer} from "./utils";
import Shader from "./shader";
import Vector from "./Vector";

class ChunkBufferContext {
  public texture: WebGLTexture;
  public framebuffer: WebGLFramebuffer;
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, chunkData: Uint16Array) {
    this.gl = gl;
    this.load(chunkData);
    this.framebuffer = createFramebuffer(gl, this.texture);
  }

  public load(chunkData: Uint16Array) {
    this.texture = createTexture(this.gl, chunkData, Chunk.IMAGE_SIZE, Chunk.IMAGE_SIZE, this.gl.RGBA16UI, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_SHORT, this.texture);
  }
}

export default class Chunk {
  public static readonly SIZE = 100;
  public static readonly HEIGHT = 196;
  public static readonly TOTAL_SIZE = Chunk.SIZE * Chunk.SIZE * Chunk.HEIGHT;
  public static readonly IMAGE_SIZE = Math.sqrt(Chunk.TOTAL_SIZE);
  public static readonly SAVE_SIZE = this.IMAGE_SIZE / 2;

  private gl: WebGL2RenderingContext;
  private buffer0: ChunkBufferContext;
  private buffer1: ChunkBufferContext;

  private loadSave: WebGLTexture;

  private chunkData: Uint16Array;
  public readonly pos: Vector;
  public doTerrainGeneration = true;
  private data = new Uint32Array(Chunk.TOTAL_SIZE * 4);

  // edit terrain
  public hasEdit = false;
  private placePosition: number;
  private placeType: number;

  constructor(gl: WebGL2RenderingContext, idx: number) {
    this.gl = gl;
    this.pos = Chunk.idxToPos(idx);
    this.chunkData = new Uint16Array(Chunk.TOTAL_SIZE * 4);
    this.buffer0 = new ChunkBufferContext(gl, this.chunkData);
    this.buffer1 = new ChunkBufferContext(gl, this.chunkData);
  }

  public static posToIdx(coord: Vector): number {
    return (((coord.z + 2048) & 0xFFF) << 12) | ((coord.x + 2048) & 0xFFF);
  }

  public static idxToPos(idx: number): Vector {
    return new Vector((idx & 0xFFF) - 2048, 0, ((idx >> 12) & 0xFFF) - 2048);
  }

  public simulate(shader: Shader, idx: number) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.buffer0.framebuffer);
    this.gl.viewport(0, 0, Chunk.IMAGE_SIZE, Chunk.IMAGE_SIZE);

    // If not null we are loading a save file
    if (this.loadSave != null) {
      this.gl.activeTexture(this.gl.TEXTURE4);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.loadSave);
      this.gl.uniform1i(shader.uniform("saveFile"), 4);
    }

    this.gl.uniform1i(shader.uniform("doLoadSave"), this.loadSave != null ? 1 : 0);
    this.gl.uniform1i(shader.uniform("doTerrainGeneration"), this.doTerrainGeneration ? 1 : 0);
    this.gl.uniform3i(shader.uniform("chunkPos"), ...this.pos.toXYZ());
    this.gl.uniform1i(shader.uniform("chunkIdx"), idx);
    this.gl.uniform1i(shader.uniform("placePosition"), this.placePosition);
    this.gl.uniform1ui(shader.uniform("placeType"), this.placeType);
    this.placePosition = -1;

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.doTerrainGeneration = false;

    // swap buffers
    [this.buffer0, this.buffer1] = [this.buffer1, this.buffer0];

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    if (this.loadSave != null) {
      this.gl.deleteTexture(this.loadSave);
      this.loadSave = null;
    }
  }

  public requestChunkData(): Uint32Array {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.buffer0.framebuffer);
    this.gl.viewport(0, 0, Chunk.IMAGE_SIZE, Chunk.IMAGE_SIZE);
    this.gl.readPixels(0, 0, Chunk.IMAGE_SIZE, Chunk.IMAGE_SIZE, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, this.data);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    return this.data;
  }

  public destroy() {
    console.log("Unload");
    this.buffer0.texture && this.gl.deleteTexture(this.buffer0.texture);
    this.buffer1.texture && this.gl.deleteTexture(this.buffer1.texture);
    this.buffer0.framebuffer && this.gl.deleteFramebuffer(this.buffer0.framebuffer);
    this.buffer1.framebuffer && this.gl.deleteFramebuffer(this.buffer1.framebuffer);
  }

  public getTexture(): WebGLTexture {
    return this.buffer1.texture;
  }

  public placeBlock(pos: Vector, type: number) {
    this.placePosition = this.localChunkPosToIndex(this.toLocalChunkPosition(pos));
    this.placeType = type;
    this.hasEdit = true; // TODO: set flag in neighbouring chunks as well
  }

  public isInChunk(globalPos: Vector): boolean {
    const chunkPos = Vector.sub(Vector.mul(this.pos, Vector.all(Chunk.SIZE)), new Vector(0, Chunk.HEIGHT / 2, 0));
    return chunkPos.x <= globalPos.x && chunkPos.y <= globalPos.y && chunkPos.z <= globalPos.z &&
      chunkPos.x + Chunk.SIZE >= globalPos.x && chunkPos.y + Chunk.HEIGHT >= globalPos.y && chunkPos.z + Chunk.SIZE >= globalPos.z;
  }

  public toLocalChunkPosition(globalPos: Vector): Vector {
    const chunkPos = Vector.mul(this.pos, Vector.all(Chunk.SIZE));
    return Vector.floor(Vector.add(Vector.sub(globalPos, chunkPos), new Vector(0, Chunk.HEIGHT / 2, 0)));
  }

  public localChunkPosToIndex(localPos: Vector): number {
    return localPos.x + localPos.y * Chunk.SIZE * Chunk.SIZE + localPos.z * Chunk.SIZE;
  }

  public saveData(): Uint16Array {
    this.requestChunkData();
    const data = new Uint16Array(Chunk.TOTAL_SIZE);
    for (let i = 0; i < Chunk.TOTAL_SIZE; i++) {
      data[i] = this.data[i * 4];
    }
    return data;
  }

  public loadData(data: Uint16Array) {
    this.loadSave = createTexture(this.gl, data, Chunk.SAVE_SIZE, Chunk.SAVE_SIZE, this.gl.RGBA16UI, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_SHORT);
  }
}

