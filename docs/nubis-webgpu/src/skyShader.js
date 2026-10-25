// A compact analytic sky (not part of Nubis, which relies on Decima's atmosphere).
// It only needs to provide: a plausible gradient that reacts to sun elevation, a sun disc with
// Mie glow, and zenith/horizon colours the cloud shader can use for ambient light.
import { wgsl, wgslFn } from 'three/tsl';
import { remapWGSL, phaseWGSL } from './wgsl/common.js';

export const skyWGSL = wgsl( /* wgsl */ `
// Colour of direct sunlight for a given sun elevation (y component of the sun direction).
fn sunLightColor( sunY : f32 ) -> vec3<f32> {
	let day = smoothstep( -0.05, 0.35, sunY );
	let sunset = vec3<f32>( 1.0, 0.45, 0.15 );
	let noon = vec3<f32>( 1.0, 0.97, 0.92 );
	let col = mix( sunset, noon, smoothstep( 0.0, 0.3, sunY ) );
	return col * day;
}
fn skyZenithColor( sunY : f32 ) -> vec3<f32> {
	let day = smoothstep( -0.15, 0.3, sunY );
	let night = vec3<f32>( 0.01, 0.015, 0.03 );
	let dayCol = vec3<f32>( 0.12, 0.30, 0.75 );
	let duskCol = vec3<f32>( 0.08, 0.12, 0.35 );
	return mix( night, mix( duskCol, dayCol, smoothstep( 0.0, 0.3, sunY ) ), day );
}
fn skyHorizonColor( sunY : f32 ) -> vec3<f32> {
	let day = smoothstep( -0.15, 0.3, sunY );
	let night = vec3<f32>( 0.02, 0.025, 0.04 );
	let dayCol = vec3<f32>( 0.62, 0.76, 0.95 );
	let duskCol = vec3<f32>( 0.85, 0.45, 0.30 );
	return mix( night, mix( duskCol, dayCol, smoothstep( 0.0, 0.35, sunY ) ), day );
}
// Full sky radiance for a view direction (includes sun disc + glow).
fn skyRadiance( dir : vec3<f32>, sunDir : vec3<f32>, sunIntensity : f32 ) -> vec3<f32> {
	let up = max( dir.y, 0.0 );
	let zenith = skyZenithColor( sunDir.y );
	let horizon = skyHorizonColor( sunDir.y );
	var col = mix( horizon, zenith, pow( up, 0.5 ) );
	let cosT = dot( dir, sunDir );
	// warm tint around the sun near the horizon
	let warm = sunLightColor( sunDir.y ) * pow( max( cosT, 0.0 ), 8.0 ) * ( 1.0 - smoothstep( 0.0, 0.4, sunDir.y ) ) * 0.6;
	col += warm;
	// Mie glow + sun disc
	let mie = henyeyGreenstein( cosT, 0.80 ) * 0.04;
	col += sunLightColor( sunDir.y ) * mie * sunIntensity;
	let disc = smoothstep( 0.99985, 0.99995, cosT );
	col += sunLightColor( sunDir.y ) * disc * sunIntensity * 4.0;
	// below the horizon: dark ground haze (the real ground comes from the scene pass)
	let below = smoothstep( 0.0, -0.1, dir.y );
	col = mix( col, horizon * 0.35, below );
	return col;
}
` );

// Stand‑alone node: sky colour for a direction. Used by the composite pass as background.
export const skyColorFn = wgslFn( /* wgsl */ `
fn skyColor( dir : vec3<f32>, sunDir : vec3<f32>, sunIntensity : f32 ) -> vec3<f32> {
	return skyRadiance( normalize( dir ), sunDir, sunIntensity );
}
`, [ remapWGSL, phaseWGSL, skyWGSL ] );
