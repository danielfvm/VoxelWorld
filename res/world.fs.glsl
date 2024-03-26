#version 300 es

precision highp float;
precision highp sampler2D;
precision highp usampler2D;

uniform vec2 resolution;
uniform float time;
uniform vec3 camPos;
uniform vec3 camDir;
uniform vec3 lightDir;

// settings
uniform bool debugReflections;
uniform bool debugShadows;
uniform int debugVisualize;
uniform int renderDistance;
uniform float brushSize;

#define SHADOW_INTENSITY 0.5

// output
out vec4 outColor;

#defineGlobal
#define cGetVoxel(voxelPos) (getVoxel((voxelPos) + centerChunk * SIZE))
#define cCamPos (camPos - vec3(centerChunk * SIZE))


uvec4 cTraceRay(vec3 ro, vec3 rd, int maxSteps, inout vec3 normal, inout ivec3 cell, inout vec3 pos) {
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

    if ((voxelId = cGetVoxel(cell)).r > 0u) {
      normal = stepAxis * rdSign;
      break;
    }
  }

  return voxelId.r == 255u ? uvec4(0u) : voxelId;
}

float getFogRamp(float dis) {
  return clamp(pow(dis/float(renderDistance)*2.1, 5.0), 0.0, 1.0);
}

vec3 getCloudsColor(vec3 rayDir) {
  const float speed = 0.1;

  // sky height 
  float skyHeight = 100.0;
  float heightDiff = skyHeight - cCamPos.y;
  vec3 skyPos = cCamPos + vec3(rayDir.x / rayDir.y, 1, rayDir.z / rayDir.y) * heightDiff;

  float noise = clamp(
    snoise3d(vec3(skyPos.xz / 80.0 + time * speed, time * 0.05)) * 2.0 - 
    snoise3d(vec3(skyPos.xz / 40.0 + time * speed, time * 0.15)) * 3.4,
    0.0,
    1.0
  );

  return vec3(clamp(noise * 0.5 + rayDir.y - 0.5, 0.0, 1.0)) * 0.8 / getFogRamp(distance(skyPos, cCamPos) * 5.0);
}

vec3 getSkyColor(vec3 rayDir) {
  //vec3 top = vec3(0.94, 0.88, 0.8);
  //vec3 bottom = vec3(0.8, 0.5, 0.4);
  float sunPos = clamp(lightDir.y, 0.0, 1.0);
  vec3 top = mix(vec3(1.4, 1.08, 0.8), vec3(0.5, 0.78, 0.94), sunPos);
  vec3 bottom = mix(vec3(1.0, 0.6, 0.4), vec3(0.4, 0.5, 0.8), sunPos);
  vec3 color = mix(bottom, top, clamp(rayDir.y/2.0+0.5, 0.0, 1.0));
  color *= clamp(lightDir.y+0.6, 0.0, 1.0);

  return color;
}

vec3 getNightSky(vec3 rayDir) {
  return vec3(rayDir.y > 0.8 && int(rayDir.x * 10.0) % 2 < 1 && int(rayDir.z * 10.0) % 2 < 1 ? 0.0 : 1.0);
}

vec3 getSkyColorSun(vec3 rayDir) {
  vec3 color = getSkyColor(rayDir);
  float disToSun = distance(lightDir, normalize(rayDir));

  if (disToSun < 0.1 * (1.5 - lightDir.y)) {
    color = vec3(1.5);
  }

  return color;
}

vec3 getNormalColor(vec3 normal) {
  if (normal.x != 0.0) {
      return vec3(0.8);
  }
  if (normal.z != 0.0) {
      return vec3(0.9);
  }
  return vec3(1.0);
}

vec3 getLightlevel(ivec3 pos, vec3 normal) {
  uint light = cGetVoxel(pos - ivec3(normal)).a;
  float baseLevel = float(int(light) & 0x1F);
  //float hue = float(int(light >> 4) & 0xFF) / 255.0;
  return vec3(clamp(baseLevel / float(MAX_LIGHTLEVEL), 0.2, 1.0));// * hue2rgb(hue);
}


vec4 traceRayTransparent(vec4 color, vec3 ro, vec3 rd, int maxSteps, inout ivec3 cell, inout vec3 pos) {
  pos = ro;
  cell = ivec3(floor(ro));
  
  vec3 nextEdge = vec3(greaterThan(rd, vec3(0)));
  vec3 steps = (nextEdge - fract(pos)) / rd;
  vec3 originalStepSizes = abs(1.0 / rd);
  vec3 rdSign = sign(rd);
  uint voxelId = 0u;
  
  for (int i = 0; i < maxSteps; i++) {
    float stepSize = min(steps.x, min(steps.y, steps.z));
    pos += rd * stepSize;
    vec3 stepAxis = vec3(lessThanEqual(steps, vec3(stepSize)));
    cell += ivec3(stepAxis * rdSign);
    steps += originalStepSizes * stepAxis - stepSize;

    if ((voxelId = cGetVoxel(cell).r) > 0u) {
      vec4 ncolor = voxelId == 255u ? vec4(getSkyColorSun(rd), 1.0) : getVoxelColor(voxelId, cell);
      color = mix(color, ncolor, 0.5 / pow(float(i+1), 0.3));

      if (color.a > 0.95 || ncolor.a > 0.99)
        break;
    }
  }

  return color;
}


uvec4 traceRaySelected(vec3 ro, vec3 rd, int maxSteps, inout vec3 normal, inout ivec3 cell, inout vec3 pos, ivec3 selectedVoxel, float size, inout int hitCount) {
  pos = ro;
  cell = ivec3(floor(ro));
  
  vec3 nextEdge = vec3(greaterThan(rd, vec3(0)));
  vec3 steps = (nextEdge - fract(pos)) / rd;
  vec3 originalStepSizes = abs(1.0 / rd);
  vec3 rdSign = sign(rd);
  uvec4 voxelId = uvec4(0);

  hitCount = 0;
  
  for (int i = 0; i < maxSteps; i++) {
    float stepSize = min(steps.x, min(steps.y, steps.z));
    pos += rd * stepSize;
    vec3 stepAxis = vec3(lessThanEqual(steps, vec3(stepSize)));
    cell += ivec3(stepAxis * rdSign);
    steps += originalStepSizes * stepAxis - stepSize;

    if (distance(vec3(cell), vec3(selectedVoxel)) < size)
      hitCount ++;


    if ((voxelId = cGetVoxel(cell)).r > 0u) {
      normal = stepAxis * rdSign;
      break;
    }
  }

  return voxelId.r == 255u ? uvec4(0u) : voxelId;
}




bool lightRay(vec3 ro, vec3 rd, int maxSteps) {
  vec3 _normal;
  ivec3 _mapPos;
  vec3 _worldPos;

  return cTraceRay(ro, rd, maxSteps, _normal, _mapPos, _worldPos).r == 0u;
}

bool getSelected(vec3 rayDir, int dis, inout ivec3 mapPos, inout vec3 normal) {
  vec3 worldPos;

  return cTraceRay(cCamPos, rayDir, dis, normal, mapPos, worldPos).r != 0u;
}

vec4 colorAt(uvec4 voxel, vec3 rayDir, ivec3 mapPos, vec3 worldPos, vec3 normal) {
  uint voxelId = voxel.r;

  vec3 temp = vec3(max(0.0, float(TEMPERATURE(voxel))) / 32.0, 0.0, max(0.0, -float(TEMPERATURE(voxel))) / 32.0);

  // different visualizations
  vec4 colors[4] = vec4[4](
    /* Normal      */ getVoxelColor(voxelId, mapPos) + vec4(temp * 0.1, 0),
    /* Integrity   */ vec4(float(15 - DENSITY(voxel)) / 15.0, float(DENSITY(voxel)) / 15.0, 0, 1),
    /* Temperature */ vec4(temp * 0.5 + 0.5, 1),
    /* Velocity    */ vec4(vec3(float(abs(int(voxel.b) & 0x1F - 16)), float(abs((int(voxel.b >> 5) & 0x1F) - 16)), float(abs((int(voxel.b >> 10) & 0x1F) - 16))) / 32.0 + 0.5, 1)
  );

  if (voxelId == _FIRE) {
    colors[0] = mix(vec4(0.1,0.1,0.1,1.0), colors[0], clamp(float(TEMPERATURE(voxel)) / 20.0 - 0.4, 0.1, 1.0));
  }

  // different voxel specific properties
  vec4 voxelColor = colors[debugVisualize];
  float specular = VOXEL_SPECULAR[voxelId];
  float reflection = VOXEL_REFLECTION[voxelId];
  bool distortion = VOXEL_DISTORTION[voxelId];

  vec3 color = voxelColor.rgb * getNormalColor(normal); 

  if (VOXEL_EMISSION[voxelId] == 0u)
    color *= getLightlevel(mapPos, normal);

  // transparency
  if (voxelColor.a < 0.99) {
    ivec3 _mapPos;
    vec3 _worldPos;

    // water distortion by worldPos and time
    vec3 refRayDir = rayDir;
    if (distortion) {
      refRayDir.xy = rotate2d(rayDir.xy, sin(time*0.5+worldPos.x*0.1)*0.1);
      refRayDir.zy = rotate2d(rayDir.zy, cos(time*0.4+worldPos.z*0.1)*0.1);
    }

    color = traceRayTransparent(voxelColor, worldPos, refRayDir, 100, _mapPos, _worldPos).rgb;

    // water effects
    if (voxelId == 3u) {
      float waterDepth = distance(worldPos, _worldPos);
      float foam = snoise3d(vec3(worldPos.xz * 0.8, time * 0.4)) - (waterDepth - 6.0) * 0.1;
      float foam2 = snoise3d(vec3(worldPos.xz * 0.3, time * 0.3)) - (waterDepth - 6.0) * 0.1;

      if (foam > 0.2 && foam < max(0.1, 0.5 * (1.0 - waterDepth * waterDepth * 0.04))) {
        color = mix(vec3(1.0), color, 0.7);
      }

      if (foam2 > 0.2 && foam2 < max(0.3, 0.5 * (1.0 - waterDepth * waterDepth * 0.04))) {
        color = mix(vec3(1.0), color, 0.5);
      }

      color = mix(color, vec3(0.0, 0.0, 0.7), clamp(waterDepth * 0.1, 0.0, 0.5));
    }

    color *= getLightlevel(mapPos, normal);
  }

  // Reflections
  if (debugVisualize == 0 && debugReflections && reflection > 0.0) {
    vec3 _normal;
    ivec3 _mapPos;
    vec3 _worldPos;

    vec3 refRayDir = rayDir;

    if (distortion) {
      float n = snoise3d(vec3(vec2(worldPos.xz) * 0.2, time));
      refRayDir.xy = rotate2d(refRayDir.xy, sin(n)*0.05);
      refRayDir.zy = rotate2d(refRayDir.zy, cos(n)*0.05);
    }

    vec3 _rayDir = refRayDir * (vec3(1.0) - abs(normal) * 2.0);
    uint _voxelId = cTraceRay(vec3(worldPos)-rayDir*0.0001, _rayDir, 100, _normal, _mapPos, _worldPos).r;
    vec3 ncolor = getSkyColorSun(_rayDir);

    if (_voxelId > 0u) {
      ncolor = getVoxelColor(_voxelId, _mapPos).rgb * getNormalColor(_normal) * getLightlevel(_mapPos, _normal);

      if (debugShadows && !lightRay(vec3(_worldPos)-_rayDir*0.0001, lightDir, 100)) {
        ncolor *= vec3(SHADOW_INTENSITY);
      }
    }

    //color = mix(ncolor, color, clamp(dot(normal, refRayDir)*1.5, 0.1, 0.95) * reflection);
    color = mix(color, ncolor, reflection);//clamp(dot(normal, refRayDir)*reflection*4.0, 0.0, 1.0));
  }

  // Shadows
  if (debugShadows && VOXEL_EMISSION[voxelId] == 0u && !lightRay(vec3(worldPos)-rayDir*0.001, lightDir, 200)) {
    color *= mix(vec3(SHADOW_INTENSITY), vec3(1), reflection);
  }

  // Specular
  else if (specular > 0.0) {
    vec3 refRayDir = rayDir;

    if (distortion) {
      float n = snoise3d(vec3(vec2(worldPos.xz) * 0.2, time));
      refRayDir.xy = rotate2d(refRayDir.xy, sin(n)*0.1);
      refRayDir.zy = rotate2d(refRayDir.zy, cos(n)*0.1);
    }

    vec3 _rayDir = refRayDir * (vec3(1.0) - abs(normal) * 2.0);
    float spec = pow(max(0.0, dot(normalize(_rayDir), lightDir)), 100.0);
    color = mix(color, vec3(1.0), clamp(spec, 0.0, 1.0) * specular);
  }

  // Emission
  color *= 1.0 + float(VOXEL_EMISSION[voxelId]) * 0.05;

  return vec4(color, voxelColor.a);
}

void main() {
  vec2 screenPos = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
  vec3 cameraPlaneU = vec3(1.0, 0.0, 0.0);
  vec3 cameraPlaneV = vec3(0.0, 1.0, 0.0) * resolution.y / resolution.x;
  vec3 centerRayDir = vec3(0.0, 0.0, 1.0);
  vec3 rayDir = centerRayDir + screenPos.x * cameraPlaneU + screenPos.y * cameraPlaneV;

  // rotate ray by pitch and yaw
  rayDir.yz = rotate2d(rayDir.yz, camDir.y);
  rayDir.xz = rotate2d(rayDir.xz, camDir.x);
  centerRayDir.yz = rotate2d(centerRayDir.yz, camDir.y);
  centerRayDir.xz = rotate2d(centerRayDir.xz, camDir.x);

  ivec3 selectedMapPos;
  vec3 selectedNormal;
  bool selected = getSelected(centerRayDir, PLAYER_RANGE, selectedMapPos, selectedNormal);

  vec3 normal;
  ivec3 mapPos;
  vec3 worldPos;
  int selectionHitCount = 0;
  uvec4 voxel = traceRaySelected(cCamPos, rayDir, renderDistance, normal, mapPos, worldPos, selectedMapPos - ivec3(selectedNormal), brushSize, selectionHitCount);


  // Get sky color
  vec3 fogColor = getSkyColor(rayDir);
  vec3 skyColor = getSkyColorSun(rayDir);
  //color = mix(vec3(1.0), color, getCloudsColor(rayDir));

  uint voxelId = voxel.r;
  vec3 color = skyColor;

  // Ground color
  if ((cCamPos + rayDir * float(renderDistance) * 0.5).y < -float(HEIGHT) / 2.0) {
    color = vec3(0.1);
  }

  // Depth buffer distance
  float dis = voxelId == 0u ? float(renderDistance) : distance(cCamPos, worldPos); //distance(cCamPos.xz, worldPos.xz);

  // color by voxelId
  if (voxelId > 0u) {
    color = colorAt(voxel, rayDir, mapPos, worldPos, normal).rgb;
    color = mix(color, fogColor, getFogRamp(dis));
  }

  // Selection
  if (selected && selectionHitCount > 0)
    color += 0.05 * (1.0 + float(selectionHitCount) * 0.1);
  if (selected && selectedNormal == normal && selectedMapPos == mapPos)
    color += 0.2 + sin(time * 5.0) * 0.1;


  float depth = 1.0 - clamp(dis / float(renderDistance), 0.0, 1.0);

  outColor = vec4(color, depth);
}
