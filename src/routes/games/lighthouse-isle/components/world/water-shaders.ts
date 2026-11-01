import { GLSL_NOISE } from './glsl-noise'
import { GLSL_WAVES } from './waves'

const WATER_FRAG_COMMON = /* glsl */ `
#include <packing>
uniform sampler2D tColor, tDepth;
uniform vec2 uRes; uniform float uNear, uFar;
uniform vec3 uCamPos, uCamFwd, uSunDir, uSunCol, uShallow, uDeep, uFoamCol, uSkyCol;
uniform float uClarity, uToon;
${GLSL_NOISE}
float sceneDist(vec2 uv, vec3 rd) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).r, uNear, uFar);
  return z / max(dot(rd, uCamFwd), 1e-3);
}
float bands(float t, float n) {
  float q = t * n;
  return mix(t, (floor(q) + smoothstep(0.4, 0.6, fract(q))) / n, uToon);
}
vec3 waterBody(float t) {
  vec3 mid = mix(uShallow, uDeep, 0.45);
  return t < 0.5 ? mix(uShallow, mid, t * 2.0) : mix(mid, uDeep, t * 2.0 - 1.0);
}
`

export const WATER_SURFACE_VERTEX = /* glsl */ `
    ${GLSL_WAVES}
    varying vec3 vWPos; varying vec3 vNrm; varying float vH;
    void main() {
      vec3 p = position;
      vec3 n; float h;
      vec3 d = waves(p.xz, n, h);
      p += d;
      vWPos = (modelMatrix * vec4(p, 1.0)).xyz;
      vNrm = n; vH = h;
      gl_Position = projectionMatrix * viewMatrix * vec4(vWPos, 1.0);
    }`

export const WATER_SURFACE_FRAGMENT = /* glsl */ `
    uniform float uTime, uAmp, uBigA;
    uniform vec4 uRipples[8];
    ${WATER_FRAG_COMMON}
    varying vec3 vWPos; varying vec3 vNrm; varying float vH;
    void main() {
      vec2 suv = gl_FragCoord.xy / uRes;
      vec3 rd = normalize(vWPos - uCamPos);
      float wd = length(vWPos - uCamPos);
      vec3 n = normalize(vNrm);
      if (!gl_FrontFacing) {
        // nhìn từ dưới lên: trong góc tới hạn (cos ≈ 0.66) thấy trên mặt nước, ngoài đó phản xạ toàn phần
        float cosI = dot(rd, n);
        float window = mix(smoothstep(0.58, 0.74, cosI), step(0.66, cosI), uToon);
        vec3 above = texture2D(tColor, suv + n.xz * 0.05).rgb * 1.15;
        vec3 R = refract(rd, -n, 1.33);
        above += uSunCol * pow(max(dot(R, uSunDir), 0.0), 24.0) * 1.6;
        float sparkle = vnoise(vWPos.xz * 1.3 + uTime * 0.7);
        vec3 mirror = uDeep * (0.85 + 0.35 * sparkle);
        gl_FragColor = vec4(mix(mirror, above, window), 1.0);
        #include <colorspace_fragment>
        return;
      }
      if (dot(n, rd) > 0.0) n = -n;
      float sd = sceneDist(suv, rd);
      float thick = max(sd - wd, 0.0);
      float vdepth = thick * max(-rd.y, 0.08);

      vec2 off = n.xz * 0.03 * clamp(thick * 0.12, 0.0, 1.0);
      vec2 ruv = suv + off;
      float sd2 = sceneDist(ruv, rd);
      if (sd2 < wd) { ruv = suv; sd2 = sd; }
      float th2 = max(sd2 - wd, 0.0);
      vec3 bg = texture2D(tColor, ruv).rgb;

      float path = mix(th2, th2 * max(-rd.y, 0.08) * 1.8, 0.55);
      float t = 1.0 - exp(-path * uClarity);
      float tb = bands(t, 4.0);
      vec3 body = waterBody(tb);
      vec3 col = mix(bg * mix(vec3(1.0), uShallow * 1.25, 0.32), body, clamp(tb * 1.08, 0.0, 1.0));

      float fres = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
      fres = mix(fres, smoothstep(0.18, 0.3, fres) * 0.7, uToon);
      col = mix(col, uSkyCol, fres * 0.55);
      float ndl = dot(n, uSunDir);
      col *= mix(0.9 + 0.12 * ndl, 0.92 + 0.1 * step(0.55, ndl), uToon);

      vec3 R = reflect(rd, n);
      float sp = pow(max(dot(R, uSunDir), 0.0), 140.0);
      float sparkle = vnoise(vWPos.xz * 1.3 + uTime * 0.7);
      float spec = mix(sp * 1.4, step(0.45, sp + sparkle * 0.35) * 0.9, uToon);
      col += uSunCol * spec;

      // foam: where the water meets anything (shore, rocks, stacks, lighthouse)
      float n1 = vnoise(vWPos.xz * 0.32 + vec2(uTime * 0.22, -uTime * 0.17));
      float n2 = vnoise(vWPos.xz * 1.1 - uTime * 0.35);
      float edge = 1.0 - smoothstep(0.0, 1.0 + 1.6 * n1, vdepth);
      float line2 = 1.0 - smoothstep(0.0, 0.18, abs(vdepth - (2.2 + 0.9 * sin(uTime * 1.6 + n1 * 5.0))));
      line2 *= step(0.45, n2) * (1.0 - smoothstep(2.5, 4.0, vdepth));
      // crest foam on the tallest waves
      float hn = vH / max(uAmp * 1.7 + uBigA, 0.05);
      float streak = vnoise(vWPos.xz * vec2(0.6, 0.6) * mat2(0.8, -0.6, 0.6, 0.8) + uTime * 0.3);
      float crest = smoothstep(0.72, 0.86, hn + (n2 - 0.5) * 0.3) * step(0.42, streak) * (1.0 - step(0.62, streak));
      // ripple rings
      float rings = 0.0;
      for (int i = 0; i < 8; i++) {
        vec4 r = uRipples[i];
        float age = uTime - r.z;
        if (r.w <= 0.0 || age < 0.0 || age > 3.5) continue;
        float d = length(vWPos.xz - r.xy);
        rings = max(rings, (1.0 - smoothstep(0.0, 0.5, abs(d - age * 7.0))) * (1.0 - age / 3.5) * step(0.35, n2));
      }
      float foam = max(max(edge, line2 * 0.9), max(crest * 0.9, rings));
      foam = mix(foam, step(0.5, foam), uToon);
      col = mix(col, uFoamCol * (0.92 + 0.08 * ndl), clamp(foam, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`

export const WATER_WALL_VERTEX = /* glsl */ `
    ${GLSL_WAVES}
    attribute float aTop; attribute float aFloor;
    varying vec3 vWPos; varying float vSurf;
    void main() {
      vec3 n; float h;
      vec3 d = waves(position.xz, n, h);
      float surf = h;
      vec3 p = vec3(position.x, mix(aFloor, surf, aTop), position.z);
      vSurf = surf;
      vWPos = (modelMatrix * vec4(p, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vWPos, 1.0);
    }`

export const WATER_WALL_FRAGMENT = /* glsl */ `
    uniform float uTime;
    ${WATER_FRAG_COMMON}
    varying vec3 vWPos; varying float vSurf;
    void main() {
      vec2 suv = gl_FragCoord.xy / uRes;
      vec3 rd = normalize(vWPos - uCamPos);
      float wd = length(vWPos - uCamPos);
      float thick = max(sceneDist(suv, rd) - wd, 0.0);
      vec3 bg = texture2D(tColor, suv).rgb;
      float below = vSurf - vWPos.y;
      float t = 1.0 - exp(-thick * uClarity * 1.1);
      float depthT = bands(clamp(below / 13.0, 0.0, 1.0), 4.0);
      vec3 body = waterBody(0.25 + depthT * 0.75);
      vec3 col = mix(bg * uShallow * 1.2, body, clamp(max(t, 0.35 + depthT * 0.3), 0.0, 1.0));
      float wob = vnoise(vec2(vWPos.x + vWPos.z, uTime * 0.6) * 0.5);
      col = mix(col, uFoamCol, 1.0 - smoothstep(0.25, 0.4 + 0.2 * wob, below));      // foam lip
      col = mix(col, col * 1.18, (1.0 - smoothstep(0.4, 1.3, below)) * 0.6);          // bright band under the lip
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`
