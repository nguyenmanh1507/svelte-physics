// Hash + Perlin/Worley TILEABLE (để texture lặp không lộ đường nối)
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 hash33(vec3 cell, float seed) {
  uint s = uint(seed);
  uvec3 u = uvec3(ivec3(cell)) + uvec3(s * 7919u, s * 104729u, s * 1299709u);
  return vec3(pcg3d(u)) * (1.0 / 4294967295.0);
}

// Worley đảo ngược → khối "billowy" tròn [slide 31]
float worley(vec3 p, float freq, float seed) {
  vec3 q = p * freq;
  vec3 id = floor(q);
  vec3 f = q - id;
  float md = 1.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z);
    vec3 c = mod(id + o, freq);                 // wrap → tileable
    vec3 d = o + hash33(c, seed) - f;
    md = min(md, dot(d, d));
  }
  return 1.0 - sqrt(md);
}

float worleyFbm(vec3 p, float freq, float seed) {
  return worley(p, freq, seed)              * 0.625
       + worley(p, freq * 2.0, seed + 1.0)  * 0.25
       + worley(p, freq * 4.0, seed + 2.0)  * 0.125;
}

vec3 grad3(vec3 c, float seed) { return normalize(hash33(c, seed) * 2.0 - 1.0 + 1e-5); }

float perlin(vec3 p, float freq, float seed) {
  vec3 q = p * freq;
  vec3 i = floor(q);
  vec3 f = q - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  #define G(o) dot(grad3(mod(i + o, freq), seed), f - o)
  float n000 = G(vec3(0,0,0)), n100 = G(vec3(1,0,0)), n010 = G(vec3(0,1,0)), n110 = G(vec3(1,1,0));
  float n001 = G(vec3(0,0,1)), n101 = G(vec3(1,0,1)), n011 = G(vec3(0,1,1)), n111 = G(vec3(1,1,1));
  #undef G
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

float perlinFbm(vec3 p, float freq, int octaves, float seed) {
  float s = 0.0, a = 1.0, norm = 0.0;
  for (int k = 0; k < 8; k++) {
    if (k >= octaves) break;
    s += perlin(p, freq, seed + float(k)) * a;
    norm += a; a *= 0.5; freq *= 2.0;
  }
  return s / norm;   // ~[-0.6, 0.6]
}
