// The Nubis cloud ray-marcher, written in WGSL and wrapped as a TSL node.
//
// Structure follows "Nubis – Realtime Volumetric Cloudscapes In A Nutshell" (Schneider, 2018):
//   DENSITY MODEL   weather map (coverage / type) × height gradient × Perlin‑Worley base
//                   eroded by high‑frequency Worley detail (remap, not multiply)
//   LIGHTING MODEL  Energy = Attenuation (Beer–Lambert) × Phase (Henyey‑Greenstein)
//                                       × In‑scattering probability (1 − exp(−d), "powder")
//   RENDERER        spherical atmosphere shells, cheap big steps until density > 0, step back,
//                   full samples + 6 cone light samples, early exit when transmittance ≈ 0.
import { wgsl, wgslFn } from 'three/tsl'
import { COMMON_INCLUDES, phaseWGSL } from './common'
import { skyWGSL } from './sky'

const cloudHelpersWGSL = wgsl(/* wgsl */ `
// ray / sphere → (tNear, tFar), (-1,-1) on miss
fn raySphere( ro : vec3<f32>, rd : vec3<f32>, c : vec3<f32>, r : f32 ) -> vec2<f32> {
	let oc = ro - c;
	let b = dot( oc, rd );
	let cc = dot( oc, oc ) - r * r;
	let h = b * b - cc;
	if ( h < 0.0 ) { return vec2<f32>( -1.0, -1.0 ); }
	let s = sqrt( h );
	return vec2<f32>( -b - s, -b + s );
}

fn heat( x : f32 ) -> vec3<f32> {
	return clamp( vec3<f32>( x * 3.0 - 1.0, x * 3.0 - 0.5, 1.0 - abs( x * 3.0 - 0.5 ) * 2.0 ) , vec3<f32>( 0.0 ), vec3<f32>( 1.0 ) ) ;
}

// 0 at the bottom of the cloud layer, 1 at the top (spherical shells)
fn heightFraction( p : vec3<f32>, planetCenter : vec3<f32>, planetR : f32, bottom : f32, top : f32 ) -> f32 {
	let h = length( p - planetCenter ) - planetR;
	return saturate( ( h - bottom ) / ( top - bottom ) );
}

// weather map (R coverage, G precipitation, B type) is mapped top-down onto world XZ
fn sampleWeather( tex : texture_2d<f32>, s : sampler, p : vec3<f32>, weatherScale : f32 ) -> vec4<f32> {
	let uv = p.xz / weatherScale + 0.5;
	return textureSampleLevel( tex, s, uv, 0.0 );
}

// Height gradients for the three low-altitude cloud types, blended by cloud type (slide 7-8).
// (a,b) ramp in, (c,d) ramp out.
fn densityHeightGradient( hf : f32, cloudType : f32 ) -> f32 {
	let stratus = vec4<f32>( 0.0, 0.07, 0.15, 0.3 );
	let stratocumulus = vec4<f32>( 0.02, 0.15, 0.45, 0.65 );
	let cumulus = vec4<f32>( 0.0, 0.12, 0.6, 0.95 );
	let g = mix( mix( stratus, stratocumulus, saturate( cloudType * 2.0 ) ), cumulus, saturate( ( cloudType - 0.5 ) * 2.0 ) );
	return smoothstep( g.x, g.y, hf ) * ( 1.0 - smoothstep( g.z, g.w, hf ) );
}

// ---------------------------------------------------------------- DENSITY MODEL
fn sampleCloudDensity(
	pIn : vec3<f32>, weather : vec4<f32>, hf : f32, cheap : bool, windDir : vec3<f32>,
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	uScale : vec4<f32>, uShape : vec4<f32>, uProfile : vec4<f32>, uAnim : vec4<f32>, uLight2 : vec4<f32>
) -> f32 {
	var p = pIn;
	// shear cloud tops in the wind direction, and animate: sample_pos += wind_direction * time_offset
	p += hf * windDir * uShape.z;
	p += ( windDir + vec3<f32>( 0.0, 0.1, 0.0 ) ) * uAnim.w * uAnim.z;

	// low frequency Perlin-Worley + Worley fBm
	let lowFreq = textureSampleLevel( shapeTex, shapeSampler, p / uScale.y, 0.0 );
	let lowFbm = lowFreq.g * 0.625 + lowFreq.b * 0.25 + lowFreq.a * 0.125;
	// base_cloud = remap(low_freq_noise, high_freq_fbm, 1.0, 0.0, 1.0)
	var base = remapSat( lowFreq.r, lowFbm - 1.0, 1.0, 0.0, 1.0 );

	// height gradient by cloud type
	var cloudType = weather.b;
	if ( uAnim.y >= 0.0 ) { cloudType = uAnim.y; }
	// Per-column profile (Nubis Evolved cloud-map "height"): each column gets its own top between
	// (1 - topVariation) and 1, and a base lifted by up to baseVariation, so cloud tops do not all
	// line up at layerTop and bases do not all sit on one plane.
	let top = mix( 1.0 - uProfile.x, 1.0, weather.a );
	let bottom = uProfile.y * ( 1.0 - weather.a );
	let hp = saturate( ( hf - bottom ) / max( top - bottom, 0.05 ) );
	let gradient = densityHeightGradient( hp, cloudType );
	base *= gradient;

	// coverage erosion:  cloud_with_coverage = remap(base * gradient, coverage, 1, 0, 1)
	var coverage = saturate( weather.r * uAnim.x );
	// Erode coverage with the gradient as well (topErosion): the remap threshold rises toward the
	// top so only noise peaks survive there -> domed, cauliflower tops instead of a flat lid.
	coverage *= mix( 1.0, gradient, uProfile.z );
	// anvil shape: flatten the top of big clouds (SIGGRAPH 2017)
	coverage = pow( coverage, remapSat( hp, 0.7, 0.8, 1.0, mix( 1.0, 0.5, uShape.w ) ) );
	if ( coverage <= 0.001 || base <= 0.0 ) { return 0.0; }
	var cloud = remapSat( base, 1.0 - coverage, 1.0, 0.0, 1.0 );
	cloud *= coverage;

	if ( cheap || cloud <= 0.0 ) { return cloud; }

	// curl distortion suggests turbulence at the base of the cloud
	let curl = textureSampleLevel( curlTex, curlSampler, p.xz / uScale.w, 0.0 ).rg * 2.0 - 1.0;
	p += vec3<f32>( curl.x, 0.0, curl.y ) * ( 1.0 - hf ) * uShape.x;

	// high frequency Worley fBm: wispy at the bottom, billowy at the top
	let high = textureSampleLevel( detailTex, detailSampler, p / uScale.z, 0.0 ).rgb;
	let highFbm = high.r * 0.625 + high.g * 0.25 + high.b * 0.125;
	let modifier = mix( highFbm, 1.0 - highFbm, saturate( hf * 10.0 ) );
	// erode: final = remap(cloud, modifier * erosion, 1.0, 0.0, 1.0)
	cloud = remapSat( cloud, modifier * uShape.y, 1.0, 0.0, 1.0 );
	// density scale: pushes cores to 1 and sharpens the edges (GPU Pro 7 "cloud_density_scale")
	return saturate( cloud * uLight2.w );
}

// ---------------------------------------------------------------- LIGHT MARCH
// 6 samples in a cone toward the sun; the last one is placed far away for distant shadows.
// Quality decreases along the cone (cheap samples once the depth is already significant).
fn lightMarch(
	p : vec3<f32>, sunDir : vec3<f32>, windDir : vec3<f32>, planetCenter : vec3<f32>, planetR : f32,
	bottom : f32, top : f32, stepLen : f32,
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	weatherTex : texture_2d<f32>, weatherSampler : sampler,
	uScale : vec4<f32>, uShape : vec4<f32>, uProfile : vec4<f32>, uAnim : vec4<f32>, uLight2 : vec4<f32>
) -> f32 {
	var kernel = array<vec3<f32>, 6>(
		vec3<f32>(  0.38051305,  0.92453449, -0.02111345 ),
		vec3<f32>( -0.50625799, -0.03590792, -0.86163418 ),
		vec3<f32>( -0.32509218, -0.94557439,  0.01428793 ),
		vec3<f32>(  0.09026238, -0.27376545,  0.95755165 ),
		vec3<f32>(  0.28128598,  0.42443639, -0.86065785 ),
		vec3<f32>( -0.16852403,  0.14748697,  0.97460106 )
	);
	var depth = 0.0;
	var lenAcc = 0.0;
	for ( var i : i32 = 0; i < 6; i++ ) {
		var lp : vec3<f32>;
		var segLen = stepLen;
		if ( i == 5 ) {
			// far sample for shadows cast by distant clouds
			lp = p + sunDir * stepLen * 12.0;
			segLen = stepLen * 3.0;
		} else {
			let coneRadius = stepLen * f32( i + 1 ) * 0.35;
			lp = p + sunDir * stepLen * f32( i + 1 ) + kernel[ i ] * coneRadius;
		}
		let hf = heightFraction( lp, planetCenter, planetR, bottom, top );
		if ( hf >= 1.0 ) { break; }
		let w = sampleWeather( weatherTex, weatherSampler, lp, uScale.x );
		let cheap = ( depth > 0.3 * stepLen * 3.0 ) || ( i >= 3 );
		let d = sampleCloudDensity( lp, w, hf, cheap, windDir, shapeTex, shapeSampler, detailTex, detailSampler, curlTex, curlSampler, uScale, uShape, uProfile, uAnim, uLight2 );
		depth += d * segLen;
	}
	return depth;
}

// ---------------------------------------------------------------- LIGHTING MODEL
// Energy = Attenuation * Phase * InScattering
fn lightEnergy( opticalDepth : f32, cosTheta : f32, hf : f32, density : f32, sunY : f32,
	eccentricity : f32, silverIntensity : f32, silverSpread : f32, inScatterStrength : f32, msOctaves : i32 ) -> f32 {

	// In-scattering probability (SIGGRAPH 2017 "Nubis"): the inverse of Beer's law,
	// darker edges, brighter cores, and less in-scattering at the cloud bottom.
	let depthProb = 0.05 + pow( max( density, 0.0001 ), remapSat( hf, 0.3, 0.85, 0.5, 2.0 ) );
	// (the vertical term assumes the sun is above the cloud; fade it out at sunrise/sunset so bases can glow)
	let vertProb = mix( 1.0, pow( remapSat( hf, 0.07, 0.14, 0.1, 1.0 ), 0.8 ), smoothstep( 0.0, 0.35, sunY ) );
	let inScatter = mix( 1.0, depthProb * vertProb, inScatterStrength );

	// Multiple scattering approximation as octaves of (attenuation, contribution, phase)
	// — the "Beer's-Powder" of 2015 generalised (Hillaire 2016 / Nubis Evolved).
	var a = 1.0; var b = 1.0; var c = 1.0;
	var energy = 0.0;
	for ( var o : i32 = 0; o < 4; o++ ) {
		if ( o >= msOctaves ) { break; }
		let beer = exp( -opticalDepth * a );
		// dual-lobe HG with an art-directable silver lining
		let phase = max( henyeyGreenstein( cosTheta, eccentricity * c ), silverIntensity * henyeyGreenstein( cosTheta, ( 0.99 - silverSpread ) * c ) );
		energy += b * beer * phase;
		a *= 0.5; b *= 0.5; c *= 0.5;
	}
	return energy * inScatter;
}
`)

export const cloudMarchFn = wgslFn(
	/* wgsl */ `
fn cloudMarch(
	/* screen */
	uv : vec2<f32>, fragCoord : vec2<f32>, sceneDepth : f32,
	/* camera */
	camPos : vec3<f32>, camTan : vec2<f32>, camWorld : mat4x4<f32>, camNear : f32, camFar : f32,
	/* textures */
	shapeTex : texture_3d<f32>, shapeSampler : sampler,
	detailTex : texture_3d<f32>, detailSampler : sampler,
	curlTex : texture_2d<f32>, curlSampler : sampler,
	weatherTex : texture_2d<f32>, weatherSampler : sampler,
	/* lighting */
	sunDir : vec3<f32>, sunIntensity : f32, windDir : vec3<f32>,
	/* packed parameters, see main.js */
	uLayer : vec4<f32>,   /* bottom, top, planetRadius, maxDistance */
	uScale : vec4<f32>,   /* weatherScale, shapeScale, detailScale, curlScale */
	uShape : vec4<f32>,   /* curlStrength, erosion, cloudTopOffset, anvilBias */
	uProfile : vec4<f32>, /* topVariation, baseVariation, topErosion, unused */
	uAnim : vec4<f32>,    /* coverageMul, typeOverride [-1 = map], windSpeed, time */
	uLight : vec4<f32>,   /* extinction, ambientStrength, eccentricity, silverIntensity */
	uLight2 : vec4<f32>,  /* silverSpread, lightStepLen, inScatterStrength, densityScale */
	uMarch : vec4<f32>,   /* maxSteps, jitter, debugMode, msOctaves */
	fogDensity : f32
) -> vec4<f32> {

	// ---------------------------------------------------------------- texture debug views
	let debugMode = i32( uMarch.z );
	if ( debugMode == 3 ) {
		let v = textureSampleLevel( shapeTex, shapeSampler, vec3<f32>( uv, fract( uAnim.w * 0.05 ) ), 0.0 );
		return vec4<f32>( select( v.rgb, vec3<f32>( v.r ), uv.x < 0.5 ), 0.0 );
	}
	if ( debugMode == 4 ) {
		let v = textureSampleLevel( detailTex, detailSampler, vec3<f32>( uv, fract( uAnim.w * 0.05 ) ), 0.0 );
		return vec4<f32>( v.rgb, 0.0 );
	}
	if ( debugMode == 5 ) {
		let v = textureSampleLevel( curlTex, curlSampler, uv, 0.0 );
		return vec4<f32>( v.rgb, 0.0 );
	}

	// ---------------------------------------------------------------- ray
	// QuadMesh uv has v = 0 at the TOP (WebGPU texture convention) → flip for NDC
	let ndc = vec2<f32>( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0 );
	// view-space direction from the camera's half-FOV tangents (avoids the precision loss of
	// un-projecting through the inverse projection matrix with a 200 km far plane)
	let viewDir = vec3<f32>( ndc * camTan, -1.0 );
	let rd = normalize( ( camWorld * vec4<f32>( viewDir, 0.0 ) ).xyz );
	let camFwd = normalize( ( camWorld * vec4<f32>( 0.0, 0.0, -1.0, 0.0 ) ).xyz );
	let ro = camPos;

	let layerBottom = uLayer.x;
	let layerTop = uLayer.y;
	let planetR = uLayer.z;
	let maxDist = uLayer.w;
	let planetCenter = vec3<f32>( 0.0, -planetR, 0.0 );

	// scene depth → distance along this ray (perspective, non reversed depth)
	var tScene = 1e30;
	if ( sceneDepth < 1.0 ) {
		let viewZ = ( camNear * camFar ) / ( ( camFar - camNear ) * sceneDepth - camFar );
		tScene = -viewZ / max( dot( rd, camFwd ), 1e-4 );
	}

	// ----------------------------------------------- atmosphere shell intersection
	let camH = length( ro - planetCenter ) - planetR;
	let inner = raySphere( ro, rd, planetCenter, planetR + layerBottom );
	let outer = raySphere( ro, rd, planetCenter, planetR + layerTop );
	let ground = raySphere( ro, rd, planetCenter, planetR );

	var tStart = 0.0;
	var tEnd = 0.0;
	var skip = 0.0;
	if ( camH < layerBottom ) {
		// below the clouds: march from the inner shell to the outer shell
		if ( inner.y < 0.0 ) { skip = 1.0; }
		tStart = inner.y;
		tEnd = outer.y;
		// looking at the ground: nothing to do (Nubis: "do I need to render this pixel?")
		if ( ground.x > 0.0 && ground.x < tStart ) { skip = 2.0; }
	} else if ( camH < layerTop ) {
		// inside the layer
		tStart = 0.0;
		tEnd = outer.y;
		if ( inner.x > 0.0 ) { tEnd = min( tEnd, inner.x ); }
	} else {
		// above the clouds
		if ( outer.x < 0.0 ) { skip = 3.0; }
		tStart = outer.x;
		tEnd = select( outer.y, inner.x, inner.x > 0.0 );
	}
	tEnd = min( tEnd, tScene );
	tEnd = min( tEnd, tStart + maxDist );
	if ( tEnd <= tStart || tStart > maxDist ) { skip = 4.0; }
	if ( skip > 0.0 ) { return vec4<f32>( 0.0, 0.0, 0.0, 1.0 ); }

	// ------------------------------------------------------------ debug views
	if ( debugMode == 1 ) {
		// weather map projected onto the layer bottom
		let p = ro + rd * tStart;
		let w = sampleWeather( weatherTex, weatherSampler, p, uScale.x );
		return vec4<f32>( w.r, w.b, w.g, 0.0 );
	}

	// ------------------------------------------------------------ march setup
	let cosTheta = dot( rd, sunDir );
	let sunColor = sunLightColor( sunDir.y ) * sunIntensity;
	// sky light from above is bluish, but the surroundings of a cloud top are mostly other sunlit clouds
	let ambientTop = mix( skyZenithColor( sunDir.y ), skyHorizonColor( sunDir.y ), 0.5 ) * 1.2;
	let ambientBottom = skyHorizonColor( sunDir.y ) * 0.35;

	// 64 samples straight up → 128 towards the horizon (Nubis)
	let maxSteps = uMarch.x;
	let steps = i32( mix( maxSteps * 0.5, maxSteps, 1.0 - abs( rd.y ) ) );
	let stepLen = ( tEnd - tStart ) / f32( steps );

	// interleaved gradient noise to break up banding
	let jitter = fract( 52.9829189 * fract( 0.06711056 * fragCoord.x + 0.00583715 * fragCoord.y ) ) * uMarch.y;

	var t = tStart + stepLen * jitter;
	var transmittance = 1.0;
	var color = vec3<f32>( 0.0 );
	var inCloud = false;
	var zeroCount = 0;
	var samplesTaken = 0;
	var weightedDist = 0.0;
	var weightSum = 0.0;
	var dbgMaxCheap = 0.0;
	var dbgMaxFull = 0.0;

	let extinction = uLight.x;
	let cheapMul = 2.0;

	for ( var i : i32 = 0; i < 256; i++ ) {
		if ( i >= steps || t > tEnd || transmittance < 0.01 ) { break; }
		let p = ro + rd * t;
		let hf = heightFraction( p, planetCenter, planetR, layerBottom, layerTop );
		let weather = sampleWeather( weatherTex, weatherSampler, p, uScale.x );
		samplesTaken++;

		if ( !inCloud ) {
			// CHEAP: coverage + height gradient + low-frequency shape only, double step
			let d = sampleCloudDensity( p, weather, hf, true, windDir,
				shapeTex, shapeSampler, detailTex, detailSampler, curlTex, curlSampler,
				uScale, uShape, uProfile, uAnim, uLight2 );
			dbgMaxCheap = max( dbgMaxCheap, d );
			if ( d > 0.0 ) {
				// found the outline of a cloud: step back and switch to full samples
				inCloud = true;
				zeroCount = 0;
				t -= stepLen * ( cheapMul - 1.0 );
				continue;
			}
			t += stepLen * cheapMul;
			continue;
		}

		// EXPENSIVE: full density with high‑frequency erosion
		let density = sampleCloudDensity( p, weather, hf, false, windDir,
			shapeTex, shapeSampler, detailTex, detailSampler, curlTex, curlSampler,
			uScale, uShape, uProfile, uAnim, uLight2 );

		dbgMaxFull = max( dbgMaxFull, density );
		if ( density > 0.0 ) {
			zeroCount = 0;
			// rain clouds absorb more light (weather.g = precipitation)
			let sigma = density * extinction * ( 1.0 + weather.g * 2.0 );

			// 6 cone samples toward the sun (density·length along the light ray)
			let lightDepth = lightMarch( p, sunDir, windDir, planetCenter, planetR, layerBottom, layerTop,
				uLight2.y, shapeTex, shapeSampler, detailTex, detailSampler, curlTex, curlSampler,
				weatherTex, weatherSampler, uScale, uShape, uProfile, uAnim, uLight2 );

			let energy = lightEnergy( lightDepth * extinction * ( 1.0 + weather.g * 2.0 ), cosTheta, hf, density, sunDir.y,
				uLight.z, uLight.w, uLight2.x, uLight2.z, i32( uMarch.w ) );

			let ambient = mix( ambientBottom, ambientTop, hf ) * uLight.y;
			let radiance = sunColor * energy + ambient;

			// energy-conserving integration (Frostbite / Hillaire 2015)
			let stepT = exp( -sigma * stepLen );
			let S = radiance * sigma;
			let Sint = ( S - S * stepT ) / max( sigma, 1e-6 );
			color += transmittance * Sint;

			let dT = transmittance * ( 1.0 - stepT );
			weightedDist += t * dT;
			weightSum += dT;

			transmittance *= stepT;
		} else {
			zeroCount++;
			// exited the cloud: go back to cheap, big steps
			if ( zeroCount > 4 ) { inCloud = false; }
		}
		t += stepLen;
	}

	if ( debugMode == 7 ) { return vec4<f32>( dbgMaxCheap, dbgMaxFull, 1.0 - transmittance, 0.0 ); }
	if ( debugMode == 2 ) {
		// heat map of samples taken
		let x = f32( samplesTaken ) / maxSteps;
		return vec4<f32>( heat( x ), 0.0 );
	}

	// fade the layer out before the hard maxDistance cut
	let distFade = 1.0 - smoothstep( maxDist * 0.7, maxDist, tStart );
	color *= distFade;
	transmittance = mix( 1.0, transmittance, distFade );

	// aerial perspective: distant clouds fade into the horizon haze
	let alpha = 1.0 - transmittance;
	if ( weightSum > 0.0 ) {
		let dist = weightedDist / weightSum;
		let fog = 1.0 - exp( -dist * fogDensity );
		let haze = skyRadiance( rd, sunDir, 0.0 );
		color = mix( color, haze * alpha, fog );
	}

	return vec4<f32>( color, transmittance );
}
`,
	[...COMMON_INCLUDES, phaseWGSL, skyWGSL, cloudHelpersWGSL]
)
