#version 300 es

precision highp float;
precision highp usampler2D;

flat out uint voxelId;
flat out ivec3 pos;
out vec3 normal;

uniform vec3 camPos;
uniform vec3 camDir;

#defineGlobal

void main() {
  vec3 rayDir = vec3(0.0, 0.0, 1.0);
  rayDir.yz = rotate2d(rayDir.yz, camDir.y);
  rayDir.xz = rotate2d(rayDir.xz, camDir.x);

  vec3 worldPos;
  voxelId = traceRay(camPos, rayDir, PLAYER_RANGE, normal, pos, worldPos);
}
