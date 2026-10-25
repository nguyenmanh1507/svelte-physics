// Phần dùng chung cho mọi bước: uniforms, giao tia-cầu, và main().
// Mỗi file stepN.frag chỉ cần định nghĩa hàm shade().

uniform vec3 uBackground;    // màu nền (bức tường xanh trong bài viết)
uniform vec3 uScatterColor;  // màu "phản xạ" của volume (bước 2, 3)
uniform vec3 uLightDir;      // hướng TỚI nguồn sáng, đã chuẩn hoá
uniform vec3 uLightColor;    // màu x cường độ của đèn
uniform float uSigmaA;       // hệ số hấp thụ
uniform float uSigmaS;       // hệ số tán xạ
uniform float uG;            // độ bất đối xứng của phase function (-1..1)
uniform float uNoiseScale;   // tần số noise (bước 5)
uniform float uTime;
uniform int uSteps;          // số bước march dọc tia camera
uniform int uLightSteps;     // số bước march về phía đèn (bước 5)

varying vec3 vWorldPos;

const float PI = 3.14159265359;
const vec3 SPHERE_CENTER = vec3(0.0);
const float SPHERE_RADIUS = 1.0;

// Giao tia với hình cầu. Trả về false nếu trượt.
// t0, t1 là khoảng cách dọc tia tới điểm vào và điểm ra.
bool intersectSphere(vec3 ro, vec3 rd, out float t0, out float t1) {
  vec3 oc = ro - SPHERE_CENTER;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - SPHERE_RADIUS * SPHERE_RADIUS;
  float h = b * b - c;
  if(h < 0.0)
    return false;
  h = sqrt(h);
  t0 = -b - h;
  t1 = -b + h;
  if(t1 < 0.0)
    return false; // cả quả cầu nằm sau lưng camera
  t0 = max(t0, 0.0);          // camera nằm trong quả cầu
  return true;
}

// Mỗi bước tự định nghĩa hàm này.
vec3 shade(vec3 ro, vec3 rd);

void main() {
  vec3 ro = cameraPosition;                        // gốc tia = vị trí camera
  vec3 rd = normalize(vWorldPos - cameraPosition); // hướng tia qua pixel này
  gl_FragColor = vec4(shade(ro, rd), 1.0);
  #include <colorspace_fragment>
}
