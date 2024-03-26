#version 300 es

precision highp float;
precision highp sampler2D;

uniform sampler2D tex;
uniform vec2 resolution;
uniform vec2 scale;
uniform vec3 camDir;
uniform vec3 lightDir;

// settings
uniform bool smoothing;
uniform bool godrays;

// output
out vec4 outColor;

bool diff(vec4 a, vec4 b, float t) {
  return abs(a.r - b.r) > t || abs(a.g - b.g) > t || abs(a.b - b.b) > t;
}

vec2 rotate2d(vec2 v, float a) {
  float sinA = sin(a);
  float cosA = cos(a);
  return vec2(v.x * cosA - v.y * sinA, v.y * cosA + v.x * sinA);	
}


void main() {
  vec2 ppos = gl_FragCoord.xy * scale.xy * 0.99;
  ivec2 pos = ivec2(ppos);

  vec4 color = texelFetch(tex, pos, 0);

  if (smoothing) {

    // fake anti aliasing by drawing triangles with the same color
    vec4 a = texelFetch(tex, pos + ivec2( 1, 0), 0);
    vec4 b = texelFetch(tex, pos + ivec2(-1, 0), 0);
    vec4 d = texelFetch(tex, pos + ivec2( 0,-1), 0);
    vec4 c = texelFetch(tex, pos + ivec2( 0, 1), 0);

    float t = 0.04;

    float dx = ppos.x - float(pos.x);
    float dy = ppos.y - float(pos.y);

    if(diff(color, b, t) && diff(color, d, t) && dx < 1.0-dy) {
      color = mix(b, d, 0.5);
    }

    if(diff(color, a, t) && diff(color, d, t) && dx > dy) {
      color = mix(a, d, 0.5);
    }
  }

  if (godrays) {
    vec2 screenPos = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
    vec3 cameraPlaneU = vec3(1.0, 0.0, 0.0);
    vec3 cameraPlaneV = vec3(0.0, 1.0, 0.0) * resolution.y / resolution.x;
    vec3 centerRayDir = vec3(0.0, 0.0, 1.0);
    vec3 rayDir = centerRayDir + screenPos.x * cameraPlaneU + screenPos.y * cameraPlaneV;

    vec3 lray = lightDir;
    lray.xz = rotate2d(lray.xz, -camDir.x);
    lray.yz = rotate2d(lray.yz, -camDir.y);

    vec2 deltaTextCoord = lray.xy - rayDir.xy;

    // Set up illumination decay factor.
    float illuminationDecay = 1.0;
    float decay = 0.9;
    float weight = 0.6;
    int samples = int(20.0 * clamp(1.0 - abs(lightDir.y - 0.7), 0.0, 1.0));
    vec2 textCoo = ppos;
    float godRayFactor = 0.0;

    float angle = max(0.0, dot(lray, rayDir));
    if (angle > 0.0) {
      for(int i = 0; i < samples; i++) {
        textCoo += deltaTextCoord * 3.0;

        // Retrieve sample at new location.  
        vec4 colorSample = texelFetch(tex, ivec2(textCoo), 0);

        // Apply sample attenuation scale/decay factors.
        if (colorSample.a > 0.0) {
          // Accumulate sample color.
          godRayFactor += illuminationDecay * weight / float(i+1) * (angle) * (1.0 - color.a);

          // Update exponential decay factor.
          illuminationDecay *= decay;
        } else if (color.a > 0.1) { // if on edge
          godRayFactor += 0.06;
        }
      }
    }

    vec3 godRayColor = vec3(1.0, 0.7, 0.0);
    vec4 godray = vec4(mix(color.rgb, color.rgb + godRayColor, clamp(godRayFactor * angle * clamp(lightDir.y, 0.3, 1.0), 0.0, 1.0)), 1.0);
    color = mix(color, godray, 0.4);
  }

  color.a = 1.0;
  outColor = color;
}
