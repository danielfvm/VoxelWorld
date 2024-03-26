#version 300 es

#define FRICTION_AIR 0.85
#define FRICTION_GROUND 0.8
#define PLAYER_HEIGHT 4.0
#define PLAYER_SIZE 1.0
#define GRAVITY -32.0

precision highp float;
precision highp usampler2D;

out vec3 nextCamPos;
out vec3 nextCamVel;
flat out uint onground;

uniform vec3 camPos;
uniform vec3 camVel;
uniform vec3 camDir;
uniform float delta;

#defineGlobal

void main() {
  vec3 vel = camVel;
  vec3 pos = camPos;
  bool ground = false;
  bool collision = false;
  vec3 collisionDir = vec3(0.0);

  vec3 offsetFix = vec3(-int(pos.x < 0.0), 0,0 -int(pos.z < 0.0));

  for (float z = -PLAYER_SIZE; z <= PLAYER_SIZE; z += 1.0) {
    for (float y = -PLAYER_HEIGHT + 0.1; y <= 0.0; y += 1.0) {
      if (VOXEL_SOLID[getVoxel(ivec3(pos + vec3(vel.x * delta + sign(vel.x) * PLAYER_SIZE, y, 0) + offsetFix + vec3(0, 0, z) * 0.5)).r]) {
        vel.x = 0.0;
        collision = true;
        collisionDir.x = vel.x;
      }
      if (VOXEL_SOLID[getVoxel(ivec3(pos + vec3(0, y, vel.z * delta + sign(vel.z) * PLAYER_SIZE) + offsetFix + vec3(z, 0, 0) * 0.5)).r]) {
        vel.z = 0.0;
        collision = true;
        collisionDir.z = vel.z;
      }
    }
  }

  float vY = vel.y < 0.0 ? -1.0 : 0.0;

  for (float x = -PLAYER_SIZE; x <= PLAYER_SIZE; x += 1.0) {
    for (float z = -PLAYER_SIZE; z <= PLAYER_SIZE; z += 1.0) {
      if (VOXEL_SOLID[getVoxel(ivec3(pos + vec3(x * 0.5, vel.y * delta + vY * PLAYER_HEIGHT, z * 0.5) + offsetFix)).r]) {
        vel.y = 0.0;
        pos.y = floor(pos.y + float(vY == 0.0) * 0.5);
        ground = true;
      }
    }
  }

  /*if (collision && ground) {
    vel.y += 0.2;
  }*/


  float friction = ground ? FRICTION_GROUND : FRICTION_AIR;

  vel.xz *= friction;

  onground = ground ? 1u : 0u;
  nextCamPos = pos + vel * delta;
  nextCamVel = vel + vec3(0.0, GRAVITY, 0.0) * delta;
}
