// BƯỚC 4: mô hình đầy đủ cho volume đồng nhất.
// Thêm hệ số tán xạ, phase function, và hấp thụ trên đường về mắt.

// Henyey-Greenstein: xác suất ánh sáng lệch một góc theta khi tán xạ.
// g = 0: đều mọi hướng. g > 0: ưu tiên đi thẳng. g < 0: ưu tiên dội ngược.
float phaseHG(float cosTheta, float g) {
  float g2 = g * g;
  float denom = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
}

vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if (!intersectSphere(ro, rd, t0, t1)) return uBackground;

  float sigmaT = uSigmaA + uSigmaS;            // hệ số suy giảm (extinction)
  float dx = (t1 - t0) / float(uSteps);
  float phase = phaseHG(dot(rd, uLightDir), uG);

  float T = 1.0;                               // transmittance từ mắt tới x
  vec3 L = vec3(0.0);

  for (int i = 0; i < uSteps; i++) {
    vec3 x = ro + rd * (t0 + (float(i) + 0.5) * dx);

    T *= exp(-sigmaT * dx);                    // câu hỏi 2: hấp thụ trên đường về mắt

    float l0, l1;
    intersectSphere(x, uLightDir, l0, l1);
    float lightAtten = exp(-l1 * sigmaT);

    // câu hỏi 1: chỉ phần sigmaS * phase được tán xạ về phía mắt
    L += T * uLightColor * lightAtten * uSigmaS * phase * dx;
  }

  return T * uBackground + L;
}
