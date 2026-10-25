import { wgsl } from 'three/tsl'

// Cloud shadows on the scene: from a scene point, 3 cheap density samples along the sun ray
// through the cloud layer -> Beer-Lambert transmittance. Same density function as the march,
// so shadows sit under the clouds and drift with the wind. Soft by design (no detail erosion).
export const cloudShadowWGSL = wgsl(/* wgsl */ `
fn cloudShadowFactor(
	p : vec3<f32>, sunDir : vec3<f32>, windDir : vec3<f32>, strength : f32,
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	weatherTex : texture_2d<f32>, weatherSampler : sampler,
	uLayer : vec4<f32>, uScale : vec4<f32>, uShape : vec4<f32>, uProfile : vec4<f32>,
	uAnim : vec4<f32>, uLight : vec4<f32>, uLight2 : vec4<f32>
) -> f32 {
	// low sun: shadows would stretch to infinity -> fade them out at sunrise / sunset
	let sunFade = smoothstep( 0.02, 0.15, sunDir.y );
	if ( strength <= 0.0 || sunFade <= 0.0 ) { return 1.0; }
	let planetR = uLayer.z;
	let planetCenter = vec3<f32>( 0.0, -planetR, 0.0 );
	let inner = raySphere( p, sunDir, planetCenter, planetR + uLayer.x );
	let outer = raySphere( p, sunDir, planetCenter, planetR + uLayer.y );
	let t0 = max( inner.y, 0.0 );
	let t1 = outer.y;
	if ( t1 <= t0 ) { return 1.0; }
	let segLen = ( t1 - t0 ) / 3.0;
	var depth = 0.0;
	for ( var i : i32 = 0; i < 3; i++ ) {
		let sp = p + sunDir * ( t0 + segLen * ( f32( i ) + 0.5 ) );
		let hf = heightFraction( sp, planetCenter, planetR, uLayer.x, uLayer.y );
		let w = sampleWeather( weatherTex, weatherSampler, sp, uScale.x );
		depth += sampleCloudDensity( sp, w, hf, true, windDir, shapeTex, shapeSampler,
			detailTex, detailSampler, curlTex, curlSampler, uScale, uShape, uProfile, uAnim, uLight2 );
	}
	// cheap density has no erosion and overestimates -> halve the optical depth
	let transmittance = exp( -depth * uLight.x * segLen * 0.5 );
	return mix( 1.0, transmittance, strength * sunFade );
}
`)
