// Shared WGSL snippets: hashing, tileable Perlin / Worley noise, remap helpers.
// These are injected into other wgslFn()s through the `includes` argument.
import { wgsl } from 'three/tsl'

export const remapWGSL = wgsl(/* wgsl */ `
const PI : f32 = 3.14159265359;
// Nubis "remap": reposition a value from one range into another (Maya SetRange / Houdini Fit).
fn remap( v : f32, lo : f32, hi : f32, nlo : f32, nhi : f32 ) -> f32 {
	// guard against a degenerate input range (would produce NaN)
	let d = hi - lo;
	let safeD = select( d, 1e-5, abs( d ) < 1e-5 );
	return nlo + ( ( v - lo ) / safeD ) * ( nhi - nlo );
}
fn remapSat( v : f32, lo : f32, hi : f32, nlo : f32, nhi : f32 ) -> f32 {
	return clamp( remap( v, lo, hi, nlo, nhi ), min( nlo, nhi ), max( nlo, nhi ) );
}
`)

// Integer hashing (PCG 3D) — gives us gradient / feature points that tile when the
// lattice coordinate is wrapped with `% period` before hashing.
export const hashWGSL = wgsl(/* wgsl */ `
fn pcg3d( vIn : vec3<u32> ) -> vec3<u32> {
	var v = vIn * 1664525u + 1013904223u;
	v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
	v ^= v >> vec3<u32>( 16u );
	v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
	return v;
}
fn hash33( p : vec3<i32>, period : i32 ) -> vec3<f32> {
	// wrap lattice coordinate so the noise tiles with 'period'
	let w = ( ( p % period ) + period ) % period;
	let h = pcg3d( vec3<u32>( w ) );
	return vec3<f32>( h ) * ( 1.0 / 4294967295.0 );
}
fn hash31( p : vec3<i32>, period : i32 ) -> f32 {
	return hash33( p, period ).x;
}
`)

// Tileable gradient (Perlin) noise, output roughly in [-1, 1].
export const perlinWGSL = wgsl(/* wgsl */ `
fn gradientDir( h : vec3<f32> ) -> vec3<f32> {
	return normalize( h * 2.0 - 1.0 );
}
fn perlin3( p : vec3<f32>, period : f32 ) -> f32 {
	let ip = floor( p );
	let fp = p - ip;
	let u = fp * fp * fp * ( fp * ( fp * 6.0 - 15.0 ) + 10.0 );
	let i = vec3<i32>( ip );
	let per = i32( period );
	var n : array<f32, 8>;
	for ( var c : i32 = 0; c < 8; c++ ) {
		let o = vec3<i32>( c & 1, ( c >> 1 ) & 1, ( c >> 2 ) & 1 );
		let g = gradientDir( hash33( i + o, per ) );
		n[ c ] = dot( g, fp - vec3<f32>( o ) );
	}
	let x0 = mix( n[0], n[1], u.x ); let x1 = mix( n[2], n[3], u.x );
	let x2 = mix( n[4], n[5], u.x ); let x3 = mix( n[6], n[7], u.x );
	let y0 = mix( x0, x1, u.y ); let y1 = mix( x2, x3, u.y );
	return mix( y0, y1, u.z ) * 1.15;
}
// fBm of tileable Perlin, remapped to [0, 1]. 'freq' = number of lattice cells across the unit cube.
fn perlinFbm( p : vec3<f32>, freq : f32, octaves : i32 ) -> f32 {
	var f = freq; var amp = 1.0; var sum = 0.0;
	for ( var o : i32 = 0; o < octaves; o++ ) {
		sum += amp * perlin3( p * f, f );
		f *= 2.0; amp *= 0.5;
	}
	// perlin3 is roughly in [-0.7, 0.7]; stretch so the fBm uses the full [0, 1] range
	return saturate( sum * 0.8 + 0.5 );
}
`)

// Tileable Worley (cellular) noise. Returns distance to nearest feature point in [0, ~1].
export const worleyWGSL = wgsl(/* wgsl */ `
fn worley3( p : vec3<f32>, freq : f32 ) -> f32 {
	let q = p * freq;
	let iq = vec3<i32>( floor( q ) );
	let fq = fract( q );
	let per = i32( freq );
	var minD = 1e9;
	for ( var x : i32 = -1; x <= 1; x++ ) {
		for ( var y : i32 = -1; y <= 1; y++ ) {
			for ( var z : i32 = -1; z <= 1; z++ ) {
				let o = vec3<i32>( x, y, z );
				let fp = hash33( iq + o, per );
				let d = vec3<f32>( o ) + fp - fq;
				minD = min( minD, dot( d, d ) );
			}
		}
	}
	return saturate( sqrt( minD ) );
}
// Inverted Worley fBm, the "billowy" building block of Nubis (GPU Pro 7, Fig. 4.2).
fn worleyFbmInv( p : vec3<f32>, freq : f32 ) -> f32 {
	return ( 1.0 - worley3( p, freq ) ) * 0.625
	     + ( 1.0 - worley3( p, freq * 2.0 ) ) * 0.25
	     + ( 1.0 - worley3( p, freq * 4.0 ) ) * 0.125;
}
fn worleyFbm( p : vec3<f32>, freq : f32 ) -> f32 {
	return worley3( p, freq ) * 0.625
	     + worley3( p, freq * 2.0 ) * 0.25
	     + worley3( p, freq * 4.0 ) * 0.125;
}
`)

export const phaseWGSL = wgsl(/* wgsl */ `
// Henyey-Greenstein phase function (1941). g in (-1, 1): + forward, - backward scattering.
fn henyeyGreenstein( cosTheta : f32, g : f32 ) -> f32 {
	let g2 = g * g;
	return ( 1.0 - g2 ) / ( 4.0 * PI * pow( 1.0 + g2 - 2.0 * g * cosTheta, 1.5 ) );
}
`)

export const COMMON_INCLUDES = [remapWGSL, hashWGSL, perlinWGSL, worleyWGSL]
