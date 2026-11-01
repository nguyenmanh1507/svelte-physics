// Dùng chung cho mọi pass (RawShaderMaterial + GLSL3, three.js tự thêm #version)
precision highp float;
precision highp sampler3D;

// Bán kính trái đất thu nhỏ để mây "cong" xuống chân trời rõ hơn [slide 76]
const float EARTH_R = 600000.0;

float saturate(float x) { return clamp(x, 0.0, 1.0); }

// remap có kẹp [0,1] (bản sửa lỗi của pseudo-code cũ)
float remap01(float v, float lo, float hi, float a, float b) {
  return saturate(a + (v - lo) / (hi - lo) * (b - a));
}
