// Crepuscular rays: sunlight scattered by the air below the cloud base, shadowed by the clouds.
//   1. cloud shadow map: per texel on the cloud-base shell, transmittance up through the layer
//      along the sun direction (cheap density, like the scene cloud shadows)
//   2. march: each view ray through the air below the cloud base, one shadow-map fetch per step,
//      accumulating in-scattered sunlight (single scattering, HG phase)
//   3. upsample: blur only along the beams (screen lines through the sun's projection), so the
//      march noise is smoothed while the beam sides stay sharp; added onto the HDR image
import { wgslFn } from 'three/tsl'
import { cloudHelpersWGSL } from './cloud-march'
import { COMMON_INCLUDES, phaseWGSL } from './common'
import { skyWGSL } from './sky'

export const shaftShadowMapFn = wgslFn(
	/* wgsl */ `
fn shaftShadowMap( uv : vec2<f32>, mapOrigin : vec2<f32>, mapExtent : f32,
	sunDir : vec3<f32>, windDir : vec3<f32>,
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	weatherTex : texture_2d<f32>, weatherSampler : sampler,
	uLayer : vec4<f32>, uScale : vec4<f32>, uShape : vec4<f32>, uProfile : vec4<f32>,
	uAnim : vec4<f32>, uLight : vec4<f32>, uLight2 : vec4<f32> ) -> vec4<f32> {
	let planetR = uLayer.z;
	let planetCenter = vec3<f32>( 0.0, -planetR, 0.0 );
	// texel on the cloud-base shell (not a flat plane: at city scale the planet curves noticeably)
	let xz = mapOrigin + uv * mapExtent;
	let rb = planetR + uLayer.x;
	let y = sqrt( max( rb * rb - dot( xz, xz ), 0.0 ) ) - planetR;
	let q = vec3<f32>( xz.x, y, xz.y );
	let t1 = raySphere( q, sunDir, planetCenter, planetR + uLayer.y ).y;
	if ( t1 <= 0.0 || sunDir.y <= 0.0 ) { return vec4<f32>( 1.0, 0.0, 0.0, 1.0 ); }
	let seg = t1 / 12.0;
	var depth = 0.0;
	for ( var i : i32 = 0; i < 12; i++ ) {
		let sp = q + sunDir * ( seg * ( f32( i ) + 0.5 ) );
		let hf = heightFraction( sp, planetCenter, planetR, uLayer.x, uLayer.y );
		let w = sampleWeather( weatherTex, weatherSampler, sp, uScale.x );
		depth += sampleCloudDensity( sp, w, hf, true, windDir, shapeTex, shapeSampler,
			detailTex, detailSampler, curlTex, curlSampler, uScale, uShape, uProfile, uAnim, uLight2 );
	}
	// full optical depth: thick cloud must reach ~0 so gaps stand out (the march sharpens it further)
	return vec4<f32>( exp( -depth * uLight.x * seg ), 0.0, 0.0, 1.0 );
}
`,
	// phaseWGSL: cloudHelpersWGSL (lightEnergy) gọi henyeyGreenstein
	[...COMMON_INCLUDES, phaseWGSL, cloudHelpersWGSL]
)

export const shaftMarchFn = wgslFn(
	/* wgsl */ `
fn shaftMarch( uv : vec2<f32>, fragCoord : vec2<f32>, sceneDepth : f32, cloudIn : vec4<f32>,
	camPos : vec3<f32>, camTan : vec2<f32>, camWorld : mat4x4<f32>, camNear : f32, camFar : f32,
	sunDir : vec3<f32>, sunIntensity : f32, uLayer : vec4<f32>,
	shadowTex : texture_2d<f32>, shadowSampler : sampler, mapOrigin : vec2<f32>, mapExtent : f32,
	density : f32, steps : f32, anisotropy : f32, intensity : f32, maxDist : f32,
	gapThreshold : f32, sharpness : f32 ) -> vec4<f32> {
	let sunFade = smoothstep( 0.02, 0.15, sunDir.y );
	if ( sunFade <= 0.0 || intensity <= 0.0 ) { return vec4<f32>( 0.0, 0.0, 0.0, 1.0 ); }

	let ndc = vec2<f32>( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0 );
	let rd = normalize( ( camWorld * vec4<f32>( ndc * camTan, -1.0, 0.0 ) ).xyz );
	let camFwd = normalize( ( camWorld * vec4<f32>( 0.0, 0.0, -1.0, 0.0 ) ).xyz );
	let ro = camPos;
	var tScene = 1e30;
	if ( sceneDepth < 1.0 ) {
		let viewZ = ( camNear * camFar ) / ( ( camFar - camNear ) * sceneDepth - camFar );
		tScene = -viewZ / max( dot( rd, camFwd ), 1e-4 );
	}

	// segment of the ray inside the air below the cloud base (sphere of radius R + base)
	let planetR = uLayer.z;
	let planetCenter = vec3<f32>( 0.0, -planetR, 0.0 );
	let base = raySphere( ro, rd, planetCenter, planetR + uLayer.x );
	let ground = raySphere( ro, rd, planetCenter, planetR );
	let camH = length( ro - planetCenter ) - planetR;
	let above = camH >= uLayer.x;
	var tStart = 0.0;
	if ( above ) { tStart = base.x; }
	var tEnd = base.y;
	if ( ground.x > 0.0 ) { tEnd = min( tEnd, ground.x ); }
	tEnd = min( min( tEnd, tScene ), tStart + maxDist );
	if ( base.y <= 0.0 || tEnd <= tStart || tStart < 0.0 ) { return vec4<f32>( 0.0, 0.0, 0.0, 1.0 ); }

	let n = max( steps, 1.0 );
	let dt = ( tEnd - tStart ) / n;
	let jitter = fract( 52.9829189 * fract( 0.06711056 * fragCoord.x + 0.00583715 * fragCoord.y ) );
	// sharpen the cloud transmittance into near-binary gaps -> beams with crisp sides
	let edge = mix( 0.3, 0.01, saturate( sharpness ) );
	var lit = 0.0;
	for ( var i : i32 = 0; i < 64; i++ ) {
		if ( f32( i ) >= n ) { break; }
		let t = tStart + ( f32( i ) + jitter ) * dt;
		let p = ro + rd * t;
		// project the point along the sun direction onto the cloud-base shell -> shadow map
		let up = raySphere( p, sunDir, planetCenter, planetR + uLayer.x ).y;
		let q = p + sunDir * max( up, 0.0 );
		let suv = ( q.xz - mapOrigin ) / mapExtent;
		var sunT = 1.0;
		if ( all( suv >= vec2<f32>( 0.0 ) ) && all( suv <= vec2<f32>( 1.0 ) ) ) {
			let raw = textureSampleLevel( shadowTex, shadowSampler, suv, 0.0 ).r;
			sunT = smoothstep( gapThreshold - edge, gapThreshold + edge, raw );
		}
		// view extinction of the haze between the start of the segment and this point
		lit += sunT * exp( -density * ( t - tStart ) ) * dt;
	}

	// forward scattering concentrates the beams toward the sun; a small isotropic floor only
	let cosTheta = dot( rd, sunDir );
	let phase = henyeyGreenstein( cosTheta, anisotropy ) * 0.95 + 0.05 / ( 4.0 * PI );
	let sunColor = sunLightColor( sunDir.y ) * sunIntensity;
	var col = sunColor * phase * density * lit * intensity * sunFade;
	// seen from above, the air below the layer is behind the clouds -> cloud transmittance
	if ( above ) { col *= cloudIn.a; }
	return vec4<f32>( col, 1.0 );
}
`,
	[...COMMON_INCLUDES, phaseWGSL, skyWGSL, cloudHelpersWGSL]
)

// Blur along the beams only. In screen space every sunbeam lies on a line through the projection
// of the sun (or of the anti-sun point when the sun is behind the camera). With the sun in
// homogeneous view coordinates sv = (x / tanX, y / tanY, w), the line direction at ndc p is
// sv.xy - p * sv.w: this covers sun in front, behind, and exactly sideways (w = 0, parallel lines).
export const shaftUpsampleFn = wgslFn(/* wgsl */ `
fn shaftUpsample( uv : vec2<f32>, shaftTex : texture_2d<f32>, shaftSampler : sampler,
	shaftSize : vec2<f32>, camWorld : mat4x4<f32>, camTan : vec2<f32>, sunDir : vec3<f32>,
	blurLength : f32 ) -> vec4<f32> {
	let right = camWorld[ 0 ].xyz;
	let up = camWorld[ 1 ].xyz;
	let back = camWorld[ 2 ].xyz;
	let sv = vec3<f32>( dot( sunDir, right ) / camTan.x, dot( sunDir, up ) / camTan.y, -dot( sunDir, back ) );
	let ndc = vec2<f32>( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0 );
	// ndc -> pixels (y flipped: uv v grows downward)
	var dir = ( sv.xy - ndc * sv.z ) * vec2<f32>( 0.5, -0.5 ) * shaftSize;
	let len = length( dir );
	if ( len < 1e-5 || blurLength <= 0.0 ) {
		return vec4<f32>( textureSampleLevel( shaftTex, shaftSampler, uv, 0.0 ).rgb, 1.0 );
	}
	let stepUv = dir / len * ( blurLength / 8.0 ) / shaftSize;
	var sum = vec3<f32>( 0.0 );
	var wsum = 0.0;
	for ( var i : i32 = -4; i <= 4; i++ ) {
		let w = 1.0 - abs( f32( i ) ) / 5.0;
		sum += textureSampleLevel( shaftTex, shaftSampler, uv + stepUv * f32( i ), 0.0 ).rgb * w;
		wsum += w;
	}
	return vec4<f32>( sum / wsum, 1.0 );
}
`)
