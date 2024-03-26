#define SIZE 100
#define HEIGHT 196
#define PLAYER_RANGE 30
#define MAX_LIGHTLEVEL 31u

#define TEXTURE_SIZE 1400 // sqrt(SIZE*SIZE*HEIGHT)
#define SAVE_SIZE (TEXTURE_SIZE/2)

#define CHUNK_COUNT 2
#define _INVALID 255u

#defineVoxel

#define DENSITY(color) (int(color.g) & 0xF)
#define TEMPERATURE(color) (int(color.g >> 4) - 128)

uniform usampler2D chunks[4];
uniform ivec3 centerChunk;

uvec4 readChunks(int idx, ivec2 pos) {
  switch(idx) {
    case 0: return texelFetch(chunks[0], pos, 0);
    case 1: return texelFetch(chunks[1], pos, 0);
    case 2: return texelFetch(chunks[2], pos, 0);
    case 3: return texelFetch(chunks[3], pos, 0);
  }
  return uvec4(0);
}

uvec4 getVoxel(ivec3 coord) {
  int ss = SIZE * CHUNK_COUNT;

  coord += ivec3(ss / 2, HEIGHT / 2, ss / 2);
  coord -= centerChunk * SIZE;

  if (coord.x < 0 || coord.x >= ss || coord.y < 0 || coord.y >= HEIGHT || coord.z < 0 || coord.z >= ss) {
    return uvec4(255);
  }

  ivec3 chunkCoord = ivec3(coord.x / SIZE, 0, coord.z / SIZE);
  ivec3 localCoord = ivec3(coord.x % SIZE, coord.y % HEIGHT, coord.z % SIZE);

  int chunkIdx = chunkCoord.x + chunkCoord.z * CHUNK_COUNT;
  int localIdx = localCoord.x + localCoord.y * SIZE * SIZE + localCoord.z * SIZE;

  // calculate chunk index
  return readChunks(chunkIdx, ivec2(localIdx % TEXTURE_SIZE, localIdx / TEXTURE_SIZE));
}

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float rand(ivec3 co) {
    return rand(vec2(co.x + co.z, co.y + co.z));
}


uvec4 traceRay(vec3 ro, vec3 rd, int maxSteps, inout vec3 normal, inout ivec3 cell, inout vec3 pos) {
  pos = ro;
  cell = ivec3(floor(ro));
  
  vec3 nextEdge = vec3(greaterThan(rd, vec3(0)));
  vec3 steps = (nextEdge - fract(pos)) / rd;
  vec3 originalStepSizes = abs(1.0 / rd);
  vec3 rdSign = sign(rd);
  uvec4 voxelId = uvec4(0);
  
  for (int i = 0; i < maxSteps; i++) {
    float stepSize = min(steps.x, min(steps.y, steps.z));
    pos += rd * stepSize;
    vec3 stepAxis = vec3(lessThanEqual(steps, vec3(stepSize)));
    cell += ivec3(stepAxis * rdSign);
    steps += originalStepSizes * stepAxis - stepSize;

    if ((voxelId = getVoxel(cell)).r > 0u) {
      normal = stepAxis * rdSign;
      break;
    }
  }

  return voxelId.r == 255u ? uvec4(0u) : voxelId;
}



// Simplex 2D noise
//
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise2d(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}


float snoise3d(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

vec2 rotate2d(vec2 v, float a) {
  float sinA = sin(a);
  float cosA = cos(a);
  return vec2(v.x * cosA - v.y * sinA, v.y * cosA + v.x * sinA);	
}

// All components are in the range [0…1], including hue.
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// All components are in the range [0…1], including hue.
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}



// All components are in the range [0…1], including hue.
float rgb2hue(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return abs(q.z + (q.w - q.y) / (6.0 * d + e));
}

// All components are in the range [0…1], including hue.
vec3 hue2rgb(float c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c + K.xyz) * 6.0 - K.www);
  return clamp(p - K.xxx, 0.0, 1.0);
}



vec4 getVoxelColor(uint id, ivec3 coord) {
  return VOXEL_COLOR[id] + vec4(vec3(VOXEL_RANDOMCOLOR[id] * rand(coord)), 0.0);
}

uint generateTerrain(ivec3 coord) {
  float height = snoise2d(vec2(coord.xz) * vec2(0.05)) * 10.0 + snoise2d(vec2(coord.xz) * vec2(0.01)) * 40.0 + snoise2d(vec2(coord.xz) * vec2(0.002)) * 50.0;
  float density = snoise3d(vec3(coord) * vec3(0.01)) + snoise3d(vec3(coord) * vec3(0.02)) - float(coord.y) * 0.04;

  bool solid = height > float(coord.y) && density > 1.2;

  if (solid && density > 2.2) {
    return _SAND;
  }
  if (height > float(coord.y) + 40.0) {
    return _STONE;
  }


  float snowheight = snoise2d(vec2(coord.xz) * vec2(0.03)) * 10.0 + 40.0;
  if (height > float(coord.y) + 37.0 && height > snowheight) {
    return _SNOW;
  }

  if (!solid && coord.y < -40) {
    return _WATER;
  }


  return solid ? _GRASS : _AIR;
}

