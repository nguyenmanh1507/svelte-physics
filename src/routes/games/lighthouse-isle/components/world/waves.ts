import * as THREE from 'three'

const BIG_SPEED = 13,
	BIG_W = 7

const waveSet = [
	// relative angle, wavelength, steepness, amplitude
	[0.0, 30, 0.55, 0.85],
	[0.5, 17, 0.5, 0.45],
	[-0.6, 11, 0.45, 0.28],
	[1.25, 6.5, 0.3, 0.12],
]

// bản GLSL của waveHeight bên dưới, hai bên phải giữ cùng công thức
export const GLSL_WAVES = /* glsl */ `
uniform float uTime, uAmp, uBigT, uBigA;
uniform vec4 uWaves[4];
uniform float uWaveA[4];
uniform vec4 uRipples[8];
float bigFront() { return -78.0 + ${BIG_SPEED.toFixed(1)} * (uTime - uBigT); }
float rippleH(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 6.0) continue;
    float d = length(p - r.xy);
    float front = age * 7.0;
    float env = exp(-pow((d - front) / 2.2, 2.0)) * exp(-age * 0.7) * r.w;
    h += env * sin((d - front) * 1.6) * 0.9;
  }
  return h;
}
vec3 waves(vec2 p, out vec3 nrm, out float hOut) {
  vec3 o = vec3(0.0);
  vec3 tx = vec3(1.0, 0.0, 0.0), tz = vec3(0.0, 0.0, 1.0);
  float edge = smoothstep(50.0, 42.0, max(abs(p.x), abs(p.y)));
  for (int i = 0; i < 4; i++) {
    vec2 d = uWaves[i].xy; float L = uWaves[i].z, Q = uWaves[i].w;
    float k = 6.2831853 / L, c = sqrt(9.8 / k), A = uWaveA[i] * uAmp;
    float f = k * (dot(d, p) - c * uTime);
    float s = sin(f), co = cos(f);
    o.x += Q * A * d.x * co * edge; o.z += Q * A * d.y * co * edge; o.y += A * s;
    tx += vec3(-Q * d.x * d.x * A * k * s * edge, d.x * A * k * co, -Q * d.x * d.y * A * k * s * edge);
    tz += vec3(-Q * d.x * d.y * A * k * s * edge, d.y * A * k * co, -Q * d.y * d.y * A * k * s * edge);
  }
  if (uBigA > 0.0) {
    vec2 bd = uWaves[0].xy;
    float s = dot(bd, p) - bigFront();
    float g = uBigA * exp(-(s * s) / ${(BIG_W * BIG_W).toFixed(1)});
    o.y += g;
    float dg = g * (-2.0 * s / ${(BIG_W * BIG_W).toFixed(1)});
    tx.y += dg * bd.x; tz.y += dg * bd.y;
  }
  float r0 = rippleH(p);
  float rx = rippleH(p + vec2(0.35, 0.0)) - r0, rz = rippleH(p + vec2(0.0, 0.35)) - r0;
  o.y += r0;
  tx.y += rx / 0.35; tz.y += rz / 0.35;
  nrm = normalize(cross(tz, tx));
  hOut = o.y;
  return o;
}
`

export function createWaves() {
	const W = { amp: 1.0, angle: (220 * Math.PI) / 180, bigT: -100, bigA: 0 }
	const uWaves = Array.from({ length: 4 }, () => new THREE.Vector4())
	const uWaveA = [0, 0, 0, 0]
	function updateWaveUniforms() {
		waveSet.forEach(([da, L, Q, A], i) => {
			const a = W.angle + da
			uWaves[i].set(Math.cos(a), Math.sin(a), L, Q)
			uWaveA[i] = A
		})
	}
	updateWaveUniforms()

	const windDir = () => new THREE.Vector2(Math.cos(W.angle), Math.sin(W.angle))
	const bigFront = (t: number) => -78 + BIG_SPEED * (t - W.bigT)
	function waveHeight(x: number, z: number, t: number) {
		let y = 0
		for (let i = 0; i < 4; i++) {
			const d = uWaves[i],
				L = d.z,
				k = (2 * Math.PI) / L,
				c = Math.sqrt(9.8 / k)
			y += uWaveA[i] * W.amp * Math.sin(k * (d.x * x + d.y * z - c * t))
		}
		if (W.bigA > 0) {
			const wd = windDir()
			const s = wd.x * x + wd.y * z - bigFront(t)
			y += W.bigA * Math.exp(-(s * s) / (BIG_W * BIG_W))
		}
		return y
	}

	function setWind(amp: number, degrees: number) {
		W.amp = amp
		W.angle = (degrees * Math.PI) / 180
		updateWaveUniforms()
	}

	function sendBigWave(t: number) {
		W.bigT = t
		W.bigA = 2.6 + W.amp * 0.8
	}

	function update(t: number) {
		if (W.bigA > 0 && bigFront(t) > 90) W.bigA = 0
	}

	return { W, uWaves, uWaveA, windDir, waveHeight, setWind, sendBigWave, update }
}

export type Waves = ReturnType<typeof createWaves>
