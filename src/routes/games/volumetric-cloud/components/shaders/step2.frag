// BƯỚC 2: Beer's law. Volume hấp thụ ánh sáng nền và có màu riêng.
vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if(!intersectSphere(ro, rd, t0, t1))
    return uBackground;

  float dist = t1 - t0;
  float T = exp(-dist * uSigmaA);              // internal transmittance

  // T phần nền lọt qua, (1 - T) phần còn lại là màu của volume.
  return T * uBackground + (1.0 - T) * uScatterColor;
}
