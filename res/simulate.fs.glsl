#version 300 es

precision highp float;
precision highp usampler2D;

uniform bool doTerrainGeneration;
uniform bool doLoadSave;

uniform vec2 scale;
uniform ivec3 chunkPos;
uniform int chunkIdx;
uniform float time;
uniform int frame;
uniform vec3 lightDir;

// edit terrain
uniform int placePosition;
uniform uint placeType;
uniform float brushSize;

// output
out uvec4 outColor;

#defineGlobal

float irand(ivec3 co) {
    return rand(vec2(co.x + co.z + frame, co.y + co.z + frame));
}

uniform usampler2D saveFile;

// list of offsets to neighbors
const ivec3 offsets[6] = ivec3[6](
  ivec3(0, 1, 0),
  ivec3(1, 0, 0),
  ivec3(0, 0, 1),
  ivec3(0, 0, -1),
  ivec3(-1, 0, 0),
  ivec3(0, -1, 0)
);

uint getIntegrity(ivec3 coord) {
  uvec4 bel = getVoxel(coord-ivec3(0, 1, 0));
  uint highestIntegrity = uint(VOXEL_SOLID[bel.r]) * min(15u, uint(DENSITY(bel)) + 1u);
  for (int i = 0; i < 5; i++) {
    uvec4 res = getVoxel(coord + offsets[i]);
    highestIntegrity = max(highestIntegrity, uint(VOXEL_SOLID[res.r]) * uint(max(0, int(DENSITY(res)) - (i == 0 ? 3 : 2))));
  }
  return highestIntegrity;
}

int getTemperature(ivec3 coord, int current) {
  int maxTemp = -1000;
  int minTemp =  1000;

  for (int i = 0; i < 6; i++) {
    uvec4 res = getVoxel(coord + offsets[i]);
    if (res.r == _INVALID) 
      continue;
    int temp = int(TEMPERATURE(res));
    maxTemp = max(maxTemp, temp);
    minTemp = min(minTemp, temp);
  }

  int n = (maxTemp + minTemp) / 2;

  int l = abs(current) > abs(n) ? current - sign(current) : n;

  return l;
}

// 16bit
// 0X YZ
ivec3 getVelocity(uvec4 voxel) {
  int x = (int(voxel.b) & 0x1F) - 16; 
  int y = ((int(voxel.b) >> 5) & 0x1F) - 16; 
  int z = ((int(voxel.b) >> 10) & 0x1F) - 16;
  return ivec3(x, y, z);
}

uint toVelocity(ivec3 vel) {
  int x = int(clamp(vel.x, -15, 15) + 16) & 0x1F;
  int y = int(clamp(vel.y, -15, 15) + 16) & 0x1F;
  int z = int(clamp(vel.z, -15, 15) + 16) & 0x1F;
  return uint(x | (y << 5) | (z << 10));
}

bool move(int motion, int t) {
  return motion != 0 && ((frame / 3 - t) % (4 - int(sqrt(float(abs(motion))))) == 0);
}

ivec3 getVelocityDestination(ivec3 pos, ivec3 vel) {
  int t = frame % 3;
  return pos + ivec3(
    int(move(vel.x, t) && t == 0) * sign(vel.x), 
    int(move(vel.y, t) && t == 1) * sign(vel.y), 
    int(move(vel.z, t) && t == 2) * sign(vel.z)
  );
}

uint getTimeLightLevel() {
  return uint(float(MAX_LIGHTLEVEL) * clamp(lightDir.y + 0.5, 0.0, 1.0));
}

uint getLight(ivec3 coord) {
  if (coord.y == HEIGHT / 2 - 1) {
    return getTimeLightLevel();
  }

  uint highestLightLevel = 0u; 
  for (int i = 0; i < 6; i++) {
    uvec4 res = getVoxel(coord + offsets[i]);
    float passthrough = float(1.0 - VOXEL_COLOR[res.r].a); // TODO: Find out why VOXEL_COLOR alpha doesnt work
    res.a += VOXEL_EMISSION[res.r];
    if (VOXEL_EMISSION[res.r] > 0u) {
      passthrough = 1.0;
    }

    highestLightLevel = max(highestLightLevel, uint(clamp(passthrough * float(res.a) - float(i != 0), 0.0, float(MAX_LIGHTLEVEL))));
  }

  return highestLightLevel;
}

/**
 * r: type 16bit
 * g: density 8bit temperature 8bit
 * b: velocity 15bit
 * a: light level 5bit
 */

ivec3 idxToGlobalCoord(int idx) {
  return chunkPos * SIZE + ivec3(idx % SIZE, idx / (SIZE * SIZE), (idx / SIZE) % SIZE) - ivec3(0, HEIGHT, 0) / 2;
}

void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);
  int idx = pos.x + pos.y * TEXTURE_SIZE;

  // idx to 3d coords
  ivec3 globalCoord = idxToGlobalCoord(idx);

  if (doLoadSave) {
    int pidx = idx / 4;
    outColor.r = texelFetch(saveFile, ivec2(pidx % SAVE_SIZE, pidx / SAVE_SIZE), 0)[idx % 4];
    outColor.g = 15u | uint(4 << 4);
    outColor.b = toVelocity(ivec3(0));
    outColor.a = getTimeLightLevel();
    return;
  } else if (doTerrainGeneration) {
    outColor.r = generateTerrain(globalCoord);
    outColor.g = 15u | uint(128 << 4);
    outColor.b = toVelocity(ivec3(0));
    outColor.a = getTimeLightLevel();
    return;
  }

  uvec4 color = getVoxel(globalCoord);
  ivec3 vel = getVelocity(color);
  uvec4 below = getVoxel(globalCoord-ivec3(0, 1, 0));
  bool moved = false;


  if (placePosition != -1 && distance(vec3(idxToGlobalCoord(placePosition)), vec3(globalCoord)) < brushSize) {
    color.r = placeType;
    color.g = uint(clamp(VOXEL_TEMPERATURE[placeType] + 128, 0, 0xFF)) << 4;
    color.a = getLight(globalCoord);
    vel = ivec3(0);
  }

  if (!VOXEL_SOLID[color.r]) {
    for (int i = 0; i < 6; i++) {
      ivec3 npos = globalCoord + offsets[i];
      uvec4 res = getVoxel(npos);

      if (res.r == _AIR || res.r == _INVALID) {
        continue;
      }

      ivec3 nvel = getVelocity(res);
      ivec3 ndest = getVelocityDestination(npos, nvel);

      if (ndest == globalCoord) {
        color = res;
        vel = nvel;
        moved = true;
        break;
      }
    }
    color.a += uint(clamp(int(getLight(globalCoord)) - int(color.a), -1, 1));
  } 

  if (color.r != _AIR) {
    ivec3 dest = getVelocityDestination(globalCoord, vel);
    if (dest != globalCoord) { // if this voxel is moving
      uvec4 destVoxel = getVoxel(dest); // get the voxel at the dest
      ivec3 destVoxelVel = getVelocityDestination(dest, getVelocity(destVoxel));

      if (!VOXEL_SOLID[destVoxel.r] && (destVoxelVel == dest || destVoxelVel == globalCoord)) { // if the dest voxel is not solid, eg Water, Air,...
        for (int i = 0; i < 6; i++) {
          ivec3 npos = dest + offsets[i];
          uvec4 res = getVoxel(npos);

          // we check the neighbouring voxel of our destination
          if (res.r == _AIR || res.r == _INVALID) {
            continue;
          }

          ivec3 nvel = getVelocity(res);
          ivec3 ndest = getVelocityDestination(npos, nvel);

          if (ndest == dest) {
            if (npos == globalCoord) {
              color = destVoxel;
              vel = nvel;
            }
            break;
          }
        }
      } else {
        vel = ivec3(0);
      }
    }

    if (VOXEL_PHYSICS[color.r] == _PHYSICS_SAND && VOXEL_SOLID[below.r]) {
      for (int i = 1; i < 5; i++) {
        ivec3 npos = globalCoord + offsets[i];
        if (!VOXEL_SOLID[getVoxel(npos).r] && !VOXEL_SOLID[getVoxel(npos - ivec3(0, 1, 0)).r]) {
          vel = offsets[i];
          break;
        }
      }
    }

    if (VOXEL_PHYSICS[color.r] == _PHYSICS_GAS) {
      vel.x = int(float(vel.x) / 1.2);
      vel.z = int(float(vel.z) / 1.2);

      vel.z += irand(globalCoord) > 0.5 ? 1 : -1;
      vel.x += irand(globalCoord + ivec3(1,0,0)) > 0.5 ? 1 : -1;
      //vel.y += irand(globalCoord + ivec3(2,0,0)) > 0.5 ? 2 : 1;
      vel.y = 3;

      int x = int(getVoxel(globalCoord + ivec3(1, 0, 0)).r == _AIR) - int(getVoxel(globalCoord + ivec3(-1, 0, 0)).r == _AIR);
      int z = int(getVoxel(globalCoord + ivec3(0, 0, 1)).r == _AIR) - int(getVoxel(globalCoord + ivec3(0, 0, -1)).r == _AIR);

      vel.x += x;
      vel.z += z;
    }


    if (VOXEL_PHYSICS[color.r] == _PHYSICS_LIQUID) {
      vel.x += irand(globalCoord + ivec3(1,0,0)) > 0.5 ? 1 : -1;
      vel.z += irand(globalCoord) > 0.5 ? 1 : -1;

      int x = int(getVoxel(globalCoord + ivec3(1, 0, 0)).r == _AIR) - int(getVoxel(globalCoord + ivec3(-1, 0, 0)).r == _AIR);
      int z = int(getVoxel(globalCoord + ivec3(0, 0, 1)).r == _AIR) - int(getVoxel(globalCoord + ivec3(0, 0, -1)).r == _AIR);

      vel.x += x;
      vel.z += z;

      if (getVoxel(globalCoord + ivec3(sign(vel.x), 0, 0)).r != _AIR) {
        vel.x = 0;
      }
      if (getVoxel(globalCoord + ivec3(0, 0, sign(vel.z))).r != _AIR) {
        vel.z = 0;
      }
    }
  }

  if (globalCoord.y > HEIGHT / 2 - 20 && (color.r == _AIR || color.r == _CLOUD) && lightDir.y > 0.0) {
    float d = snoise3d(vec3(globalCoord) * vec3(0.002, 0.008, 0.008) + vec3(frame, 0, frame) * 0.001) * snoise3d(vec3(globalCoord) * vec3(0.03) + vec3(frame, 0, frame) * 0.0012) + lightDir.y - 0.8 - float(abs(HEIGHT / 2 - 10 - globalCoord.y)) * 0.04;
    color.r = d > 0.2 ? _CLOUD : _AIR;
  }

  int temperature = getTemperature(globalCoord, TEMPERATURE(color));


  if (irand(globalCoord) > 0.95) {
    if (color.r == _AIR) {
      if (temperature > 100) {
        color.r = _FIRE;
      }
    } else if (temperature > 50 && VOXEL_FLAMABLE[color.r]) {
      color.r = _FIRE;
      temperature = 75;
    } else if (temperature < 50) {
      if (color.r == _FIRE) {
        color.r = _AIR;
      } else if (color.r == _LAVA) {
        color.r = _BASALT;
      }
    }
  }

  color.g = uint(clamp(temperature + 128, 0, 0xFF) << 4);

  if (color.r != _AIR) {

    color.g |= clamp(getIntegrity(globalCoord), 0u, 15u);

    bool integrity = color.r != 0u && DENSITY(color) == 0;
    if (VOXEL_PHYSICS[color.r] != _PHYSICS_GAS && (VOXEL_PHYSICS[color.r] == _PHYSICS_LIQUID || VOXEL_PHYSICS[color.r] == _PHYSICS_SAND || integrity)) {
      vel.y -= 1; // gravity y
    } else if (below.r != _AIR && below.r != _WATER && vel.y < 0) {
      vel.y = 0;
    }

    if (VOXEL_SOLID[color.r] ? VOXEL_SOLID[below.r] : (below.r != _AIR && VOXEL_DENSITY[below.r] >= VOXEL_DENSITY[color.r])) {
      vel.y = 0;
    }

    if (VOXEL_PHYSICS[color.r] == _PHYSICS_OTHER) {
      vel.y = 0;
    }


    // reduce xz
    if (vel.x != 0 && frame % 3 == 0) {
      vel.x -= sign(vel.x);
    }
    if (vel.z != 0 && frame % 3 == 2) {
      vel.z -= sign(vel.z);
    }

    color.a = 0u;
    color.b = toVelocity(vel);
  }

  outColor = color;
}
