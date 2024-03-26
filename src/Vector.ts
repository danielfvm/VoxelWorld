export default class Vector {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public clone(): Vector {
    return new Vector(this.x, this.y, this.z);
  }

  public static all(n: number): Vector {
    return new Vector(n, n, n);
  }

  public static zero(): Vector {
    return new Vector(0, 0, 0);
  }

  public static add(a: Vector, b: Vector): Vector {
    return new Vector(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  public static sub(a: Vector, b: Vector): Vector {
    return new Vector(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  public static mul(a: Vector, b: Vector): Vector {
    return new Vector(a.x * b.x, a.y * b.y, a.z * b.z);
  }

  public static div(a: Vector, b: Vector): Vector {
    return new Vector(a.x / b.x, a.y / b.y, a.z / b.z);
  }

  public static normalize(vec: Vector): Vector {
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    return new Vector(vec.x / len, vec.y / len, vec.z / len);
  }

  public static floor(vec: Vector): Vector {
    return new Vector(Math.floor(vec.x), Math.floor(vec.y), Math.floor(vec.z));
  }

  public set(vec: Vector|number, y: number = null, z: number = null): this {
    if (vec instanceof Vector) {
      this.x = vec.x;
      this.y = vec.y;
      this.z = vec.z;
    } else if (y !== null && z !== null) {
      this.x = vec;
      this.y = y;
      this.z = z;
    } else {
      this.x = vec;
      this.y = vec;
      this.z = vec;
    }

    return this;
  }

  public add(vec: Vector|number): this {
    if (vec instanceof Vector) {
      this.x += vec.x;
      this.y += vec.y;
      this.z += vec.z;
    } else {
      this.x += vec;
      this.y += vec;
      this.z += vec;
    }
    return this;
  }

  public sub(vec: Vector|number): this {
    if (vec instanceof Vector) {
      this.x -= vec.x;
      this.y -= vec.y;
      this.z -= vec.z;
    } else {
      this.x -= vec;
      this.y -= vec;
      this.z -= vec;
    }
    return this;
  }

  public mul(vec: Vector|number): this {
    if (vec instanceof Vector) {
      this.x *= vec.x;
      this.y *= vec.y;
      this.z *= vec.z;
    } else {
      this.x *= vec;
      this.y *= vec;
      this.z *= vec;
    }
    return this;
  }

  public div(vec: Vector|number): this {
    if (vec instanceof Vector) {
      this.x /= vec.x;
      this.y /= vec.y;
      this.z /= vec.z;
    } else {
      this.x /= vec;
      this.y /= vec;
      this.z /= vec;
    }
    return this;
  }

  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  public normalize(): this {
    let len = this.length();
    len = len === 0 ? 1 : len;
    this.x /= len;
    this.y /= len;
    this.z /= len;
    return this;
  }

  public get xy(): Vector {
    return new Vector(this.x, this.y);
  }

  public get xz(): Vector {
    return new Vector(this.x, this.z);
  }

  public get yz(): Vector {
    return new Vector(this.y, this.z);
  }

  public get xyz(): Vector {
    return new Vector(this.x, this.y, this.z);
  }

  public get xzy(): Vector {
    return new Vector(this.x, this.z, this.y);
  }

  public get yxz(): Vector {
    return new Vector(this.y, this.x, this.z);
  }

  public get yzx(): Vector {
    return new Vector(this.y, this.z, this.x);
  }

  public get zxy(): Vector {
    return new Vector(this.z, this.x, this.y);
  }

  public get zyx(): Vector {
    return new Vector(this.z, this.y, this.x);
  }

  public toXYZ(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  public toXY(): [number, number] {
    return [this.x, this.y];
  }

  public toXZ(): [number, number] {
    return [this.x, this.z];
  }

  toString(): string {
    return `${this.x}, ${this.y}, ${this.z}`;
  }
}

