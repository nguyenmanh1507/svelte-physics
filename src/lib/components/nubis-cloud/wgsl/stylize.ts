// Stylized post-process (Breath of the Wild-like look), applied in linear HDR before tone mapping:
//   • ink outline from scene depth, fading with distance
//   • saturation / contrast boost
//   • split toning: cool shadows, warm highlights
//   • vignette
// Bloom is added before this pass (three's BloomNode), so glow gets graded too.
import { wgsl, wgslFn } from 'three/tsl'

// perspective depth (0..1, not reversed) -> distance along the view axis
const viewDistanceWGSL = wgsl(/* wgsl */ `
fn viewDistance( d : f32, n : f32, f : f32 ) -> f32 {
	return ( n * f ) / ( f - ( f - n ) * d );
}
`)

export const stylizeFn = wgslFn(
	/* wgsl */ `
fn stylize( uv : vec2<f32>, color : vec4<f32>,
	dC : f32, dL : f32, dR : f32, dU : f32, dD : f32,
	camNear : f32, camFar : f32, fogDensity : f32,
	outline : f32, saturation : f32, contrast : f32, warmth : f32, vignette : f32 ) -> vec4<f32> {
	var c = max( color.rgb, vec3<f32>( 0.0 ) );
	let luma = vec3<f32>( 0.2126, 0.7152, 0.0722 );

	// Ink outline. 1/z is linear across a plane in screen space, so its Laplacian is 0 on flat
	// (even grazing) surfaces and > 0 only where this pixel is nearer than its neighbours:
	// silhouettes and convex creases, drawn on the near object.
	if ( dC < 1.0 && outline > 0.0 ) {
		let zC = viewDistance( dC, camNear, camFar );
		let inv = ( 1.0 / viewDistance( dL, camNear, camFar ) + 1.0 / viewDistance( dR, camNear, camFar )
			+ 1.0 / viewDistance( dU, camNear, camFar ) + 1.0 / viewDistance( dD, camNear, camFar ) ) * 0.25;
		let edge = smoothstep( 0.03, 0.12, 1.0 - zC * inv );
		let fade = exp( -zC * fogDensity * 4.0 );
		c = mix( c, c * vec3<f32>( 0.22, 0.24, 0.32 ), edge * outline * fade );
	}

	// saturation, then contrast around mid grey (linear 0.18)
	let l0 = dot( c, luma );
	c = max( mix( vec3<f32>( l0 ), c, saturation ), vec3<f32>( 0.0 ) );
	c = pow( c / 0.18, vec3<f32>( contrast ) ) * 0.18;

	// split toning: shadows lean blue-teal, highlights lean warm gold
	let l1 = dot( c, luma );
	let tint = mix( vec3<f32>( 0.9, 0.97, 1.1 ), vec3<f32>( 1.1, 1.0, 0.86 ), l1 / ( l1 + 0.5 ) );
	c *= mix( vec3<f32>( 1.0 ), tint, warmth );

	// vignette
	let v = length( ( uv - 0.5 ) * vec2<f32>( 1.0, 0.85 ) );
	c *= 1.0 - vignette * smoothstep( 0.35, 0.85, v );
	return vec4<f32>( c, 1.0 );
}
`,
	[viewDistanceWGSL]
)
