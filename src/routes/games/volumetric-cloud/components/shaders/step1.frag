// BƯỚC 1: tia camera có đi qua quả cầu không, và đi bao xa bên trong?
vec3 shade(vec3 ro, vec3 rd) {
  float t0, t1;
  if(!intersectSphere(ro, rd, t0, t1))
    return uBackground;

  float dist = t1 - t0;                        // quãng đường trong volume
  return vec3(dist / (2.0 * SPHERE_RADIUS));   // 0 = rìa, 1 = xuyên tâm
}
