import * as THREE from 'three'

/** gia tốc trọng trường bề mặt Titan (m/s²), bằng khoảng 1/7 Trái Đất */
export const TITAN_GRAVITY = 1.352

// [góc lệch so với hướng gió (rad), bước sóng (m), biên độ (m) khi gió = 1]
// hồ Titan gần như phẳng lặng (Cassini đo sóng cỡ cm) nên biên độ rất nhỏ.
// 8 thành phần, hướng toả rộng và bước sóng không chia hết cho nhau để hoa văn khó lặp lại;
// 4 sóng đầu là sóng dài, 4 sóng sau là sóng ngắn (hai nhóm chịu hai trường gió giật khác nhau)
const WAVE_SET = [
	[0.0, 19, 0.045],
	[0.38, 14, 0.04],
	[-0.52, 10.3, 0.028],
	[0.95, 7.1, 0.02],
	[-0.21, 5.2, 0.014],
	[-1.15, 3.7, 0.01],
	[0.67, 2.7, 0.007],
	[1.4, 1.9, 0.005],
] as const

/** hệ số nhân biên độ lớn nhất mà gió giật có thể tạo ra (xem gusts() trong GLSL) */
const GUST_MAX = 1.5
/** hệ số nhân lớn nhất của đường bao nhóm sóng */
const GROUP_MAX = 1.6

/** vận tốc pha nước sâu c = √(g/k) (handbook mục 2.5); g nhỏ nên sóng Titan trôi chậm */
export function phaseSpeed(wavelength: number, gravity = TITAN_GRAVITY) {
	return Math.sqrt((gravity * wavelength) / (2 * Math.PI))
}

// cần GLSL_NOISE (vnoise) đứng trước
export const GLSL_WAVES = /* glsl */ `
uniform float uTime, uAmp;
uniform vec4 uWaves[8]; // hướng.xy, bước sóng, biên độ
// gió giật: hai trường nhiễu tần số thấp trôi theo gió, tạo các mảng gợn sóng xen với mảng lặng
// như mặt hồ thật. x nhân sóng dài, y nhân sóng ngắn (sóng ngắn nhạy với gió hơn nên tương phản mạnh hơn)
vec2 gusts(vec2 p) {
  vec2 q = (p - uWaves[0].xy * uTime * 0.8) * 0.011;
  float a = vnoise(q) * 0.65 + vnoise(q * 2.9 + 13.7) * 0.35;
  float b = vnoise(q * 1.7 + 41.3) * 0.65 + vnoise(q * 4.3 - 7.1) * 0.35;
  return vec2(mix(0.3, 1.3, smoothstep(0.3, 0.7, a)), mix(0.15, ${GUST_MAX.toFixed(1)}, smoothstep(0.3, 0.7, b)));
}
// calm: 0..1, độ che chắn gần bờ. rough: độ gợn cục bộ của sóng ngắn (để shader tô mảng nhám/mảng lặng).
// slope bỏ qua đạo hàm của gió giật và của phép bẻ cong vì chúng biến thiên rất chậm
float waveH(vec2 p, float calm, out vec2 slope, out float rough) {
  vec2 g = gusts(p) * calm;
  rough = g.y;
  // hai trường bẻ cong toạ độ (lớn + nhỏ) để ngọn sóng không thẳng tắp như kẻ thước
  vec2 w1 = vec2(vnoise(p * 0.017 + 5.0), vnoise(p * 0.017 + 23.0)) - 0.5;
  vec2 w2 = vec2(vnoise(p * 0.061 + 11.0), vnoise(p * 0.061 + 47.0)) - 0.5;
  float h = 0.0; slope = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    vec2 d = uWaves[i].xy;
    float fi = float(i), L = uWaves[i].z;
    float k = 6.2831853 / L, c = sqrt(${TITAN_GRAVITY} / k);
    // mỗi sóng bị bẻ cong một kiểu (đổi dấu, đổi độ lớn), nên chỗ các sóng giao nhau không xếp thành ô lưới đều
    vec2 pw = p + w1 * (3.0 + 1.2 * fi) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0) + w2 * 1.6;
    // sóng đi thành từng nhóm: đường bao dài cỡ 3-4 bước sóng, trôi với vận tốc nhóm c/2
    float group = mix(0.3, ${GROUP_MAX.toFixed(1)}, vnoise((pw - d * c * 0.5 * uTime) / (L * 3.5) + fi * 17.3));
    float A = uWaves[i].w * uAmp * (i < 4 ? g.x : g.y) * group;
    float f = k * (dot(d, pw) - c * uTime);
    h += A * sin(f);
    slope += d * (A * k * cos(f));
  }
  return h;
}
`

export function createWaves(windDeg = 205) {
	const state = { amp: 1 }
	const angle = (windDeg * Math.PI) / 180
	const uWaves = WAVE_SET.map(
		([da, L, A]) => new THREE.Vector4(Math.cos(angle + da), Math.sin(angle + da), L, A)
	)

	/** chặn trên của độ cao sóng, dùng để giữ camera khỏi chạm mặt chất lỏng */
	const maxHeight = () => state.amp * GUST_MAX * GROUP_MAX * uWaves.reduce((sum, w) => sum + w.w, 0)

	return { state, uWaves, maxHeight }
}

export type Waves = ReturnType<typeof createWaves>
