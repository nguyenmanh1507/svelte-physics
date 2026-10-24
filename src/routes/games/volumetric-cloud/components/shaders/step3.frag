// BƯỚC 3: ray-marching. Cộng dồn ánh sáng đèn tán xạ về phía mắt
// bằng tổng Riemann dọc đoạn [t0, t1].
vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if(!intersectSphere(ro, rd, t0, t1))
    return uBackground;

  float dx = (t1 - t0) / float(uSteps);        // bề rộng mỗi hình chữ nhật
  vec3 L = vec3(0.0);                          // ánh sáng in-scattering tích luỹ

  for(int i = 0; i < uSteps; i++) {
    // x nằm ở GIỮA đoạn con thứ i
    vec3 x = ro + rd * (t0 + (float(i) + 0.5) * dx);

    // Bắn tia từ x về phía đèn: ánh sáng đã đi bao xa trong volume?
    float l0, l1;
    intersectSphere(x, uLightDir, l0, l1);     // x ở trong cầu nên luôn trúng
    float lightAtten = exp(-l1 * uSigmaA);     // Beer's law trên tia sáng

    // Li(x) * dx
    L += uLightColor * lightAtten * dx;
  }

  float T = exp(-(t1 - t0) * uSigmaA);         // nền vẫn bị hấp thụ như bước 2
  return T * uBackground + L * uScatterColor;
}
