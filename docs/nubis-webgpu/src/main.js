// Nubis‑style volumetric cloudscapes — Three.js WebGPU (TSL + WGSL)
import * as THREE from 'three/webgpu';
import { Fn, uniform, texture, texture3D, uv, vec3, positionWorld, mx_noise_float, wgslFn, mix, smoothstep } from 'three/tsl';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';

import { NubisTextures } from './noiseTextures.js';
import { cloudMarchFn } from './cloudShader.js';
import { skyColorFn, skyWGSL } from './skyShader.js';
import { remapWGSL, phaseWGSL } from './wgsl/common.js';
import { FlyControls } from './flyControls.js';

const overlay = document.getElementById( 'overlay' );
const setStatus = ( msg ) => { overlay.textContent = msg; overlay.style.display = msg ? 'block' : 'none'; };

// ---------------------------------------------------------------------------------------- params
const params = {
	// sun
	sunAzimuth: 35, sunElevation: 28, sunIntensity: 20,
	// layer
	layerBottom: 1500, layerTop: 4000, planetRadius: 6_371_000, maxDistance: 60_000,
	// cloud map
	coverageBias: 0.50, typeBias: 0.55, precipBias: 0.15, weatherSeed: 0,
	coverageMul: 1.0, typeOverride: - 1,
	// shape
	weatherScale: 60_000, shapeScale: 9_000, detailScale: 900, curlScale: 8_000,
	curlStrength: 180, erosion: 0.35, cloudTopOffset: 600, anvilBias: 0.0,
	windDirection: 40, windSpeed: 12,
	// lighting
	extinction: 0.05, ambientStrength: 0.6, eccentricity: 0.55, silverIntensity: 0.6, silverSpread: 0.25,
	lightStepLen: 120, inScatterStrength: 1.0, msOctaves: 4, densityScale: 2.0,
	// renderer
	maxSteps: 128, jitter: 1.0, renderScale: 0.5, fogDensity: 0.00004, debugMode: 0,
	exposure: 1.0, animate: true,
};

// uniforms shared with the shaders
const U = {
	camPos: uniform( new THREE.Vector3() ),
	camTan: uniform( new THREE.Vector2( 1, 1 ) ),
	camWorld: uniform( new THREE.Matrix4() ),
	camNear: uniform( 0.5 ),
	camFar: uniform( 200_000 ),
	sunDir: uniform( new THREE.Vector3( 0, 1, 0 ) ),
	sunIntensity: uniform( params.sunIntensity ),
	windDir: uniform( new THREE.Vector3( 1, 0, 0 ) ),
	uLayer: uniform( new THREE.Vector4() ),
	uScale: uniform( new THREE.Vector4() ),
	uShape: uniform( new THREE.Vector4() ),
	uAnim: uniform( new THREE.Vector4() ),
	uLight: uniform( new THREE.Vector4() ),
	uLight2: uniform( new THREE.Vector4() ),
	uMarch: uniform( new THREE.Vector4() ),
	fogDensity: uniform( params.fogDensity ),
	cloudSize: uniform( new THREE.Vector2( 1, 1 ) ),
};

let cloudTime = 0;

function syncUniforms() {

	const az = THREE.MathUtils.degToRad( params.sunAzimuth );
	const el = THREE.MathUtils.degToRad( params.sunElevation );
	U.sunDir.value.set( Math.cos( el ) * Math.sin( az ), Math.sin( el ), Math.cos( el ) * Math.cos( az ) ).normalize();
	U.sunIntensity.value = params.sunIntensity;

	const wd = THREE.MathUtils.degToRad( params.windDirection );
	U.windDir.value.set( Math.sin( wd ), 0, Math.cos( wd ) );

	U.uLayer.value.set( params.layerBottom, params.layerTop, params.planetRadius, params.maxDistance );
	U.uScale.value.set( params.weatherScale, params.shapeScale, params.detailScale, params.curlScale );
	U.uShape.value.set( params.curlStrength, params.erosion, params.cloudTopOffset, params.anvilBias );
	U.uAnim.value.set( params.coverageMul, params.typeOverride, params.windSpeed, cloudTime );
	U.uLight.value.set( params.extinction, params.ambientStrength, params.eccentricity, params.silverIntensity );
	U.uLight2.value.set( params.silverSpread, params.lightStepLen, params.inScatterStrength, params.densityScale );
	U.uMarch.value.set( params.maxSteps, params.jitter, params.debugMode, params.msOctaves );
	U.fogDensity.value = params.fogDensity;

}

// ---------------------------------------------------------------------------------------- init
async function init() {

	if ( ! navigator.gpu ) {

		setStatus( 'WebGPU is not available in this browser. Use Chrome / Edge 113+ (or Safari 26 / Firefox 141+).' );
		return;

	}

	const renderer = new THREE.WebGPURenderer( { antialias: false, forceWebGL: false } );
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 1.5 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = params.exposure;
	document.body.appendChild( renderer.domElement );
	await renderer.init();

	if ( renderer.backend.isWebGPUBackend !== true ) {

		setStatus( 'WebGPU adapter could not be created (fell back to WebGL). The WGSL cloud shader needs real WebGPU.' );
		return;

	}

	setStatus( 'Generating Nubis noise textures on the GPU…' );

	// ---- textures (compute shaders)
	const nubis = new NubisTextures( renderer );
	nubis.weatherParams.coverageBias.value = params.coverageBias;
	nubis.weatherParams.typeBias.value = params.typeBias;
	nubis.weatherParams.precipBias.value = params.precipBias;
	nubis.weatherParams.seed.value = params.weatherSeed;
	const ms = await nubis.generateAll();
	console.log( `Nubis textures generated in ${ ms.toFixed( 0 ) } ms` );

	// ---- camera & controls
	const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, U.camNear.value, U.camFar.value );
	camera.position.set( 0, 2, 0 );
	const controls = new FlyControls( camera, renderer.domElement );
	controls.yaw = Math.PI * 0.15;
	controls.pitch = 0.18;

	// ---- scene (ground + landmarks), rendered into an HDR target with depth
	const scene = new THREE.Scene();
	const sun = new THREE.DirectionalLight( 0xffffff, 3 );
	scene.add( sun );
	const hemi = new THREE.HemisphereLight( 0x8fb7e8, 0x3a4a2a, 1.0 );
	scene.add( hemi );

	const groundMat = new THREE.MeshStandardNodeMaterial( { roughness: 1 } );
	groundMat.colorNode = Fn( () => {

		const n = mx_noise_float( positionWorld.xz.mul( 0.0006 ) ).mul( 0.5 ).add( 0.5 );
		const n2 = mx_noise_float( positionWorld.xz.mul( 0.004 ) ).mul( 0.5 ).add( 0.5 );
		const grass = vec3( 0.16, 0.26, 0.09 );
		const dirt = vec3( 0.30, 0.24, 0.15 );
		return mix( grass, dirt, smoothstep( 0.35, 0.75, n.mul( 0.7 ).add( n2.mul( 0.3 ) ) ) );

	} )();
	// subdivided so triangles are never entirely beyond the far plane (which would clip the whole plane)
	const ground = new THREE.Mesh( new THREE.PlaneGeometry( 300_000, 300_000, 48, 48 ), groundMat );
	ground.rotation.x = - Math.PI / 2;
	ground.frustumCulled = false;
	scene.add( ground );

	// some scale references: 60‑120 m "towers" scattered around the start
	const boxGeo = new THREE.BoxGeometry( 1, 1, 1 );
	const boxMat = new THREE.MeshStandardNodeMaterial( { color: 0x9a9a9a, roughness: 0.9 } );
	const towers = new THREE.InstancedMesh( boxGeo, boxMat, 40 );
	const m = new THREE.Matrix4();
	for ( let i = 0; i < 40; i ++ ) {

		const a = ( i / 40 ) * Math.PI * 2 + ( i % 3 ) * 0.4;
		const r = 400 + ( i % 7 ) * 350;
		const h = 40 + ( ( i * 37 ) % 90 );
		m.makeScale( 20 + ( i % 4 ) * 8, h, 20 + ( i % 5 ) * 6 );
		m.setPosition( Math.cos( a ) * r, h / 2, Math.sin( a ) * r );
		towers.setMatrixAt( i, m );

	}
	scene.add( towers );

	// ---- render targets
	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize( size );
	const depthTexture = new THREE.DepthTexture( size.x, size.y );
	const sceneRT = new THREE.RenderTarget( size.x, size.y, {
		type: THREE.HalfFloatType, depthTexture, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
	} );
	const cloudRT = new THREE.RenderTarget( Math.ceil( size.x * params.renderScale ), Math.ceil( size.y * params.renderScale ), {
		type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
	} );

	// ---- cloud pass (quarter / half resolution)
	const shapeNode = texture3D( nubis.shape );
	const detailNode = texture3D( nubis.detail );
	const curlNode = texture( nubis.curl );
	const weatherNode = texture( nubis.weather );
	const depthNode = texture( depthTexture, uv() );

	const cloudMat = new THREE.NodeMaterial();
	cloudMat.depthTest = false; cloudMat.depthWrite = false;
	cloudMat.fragmentNode = cloudMarchFn( {
		uv: uv(), fragCoord: uv().mul( U.cloudSize ), sceneDepth: depthNode.r,
		camPos: U.camPos, camTan: U.camTan, camWorld: U.camWorld, camNear: U.camNear, camFar: U.camFar,
		shapeTex: shapeNode, shapeSampler: shapeNode,
		detailTex: detailNode, detailSampler: detailNode,
		curlTex: curlNode, curlSampler: curlNode,
		weatherTex: weatherNode, weatherSampler: weatherNode,
		sunDir: U.sunDir, sunIntensity: U.sunIntensity, windDir: U.windDir,
		uLayer: U.uLayer, uScale: U.uScale, uShape: U.uShape, uAnim: U.uAnim,
		uLight: U.uLight, uLight2: U.uLight2, uMarch: U.uMarch, fogDensity: U.fogDensity,
	} );
	const cloudQuad = new THREE.QuadMesh( cloudMat );

	// ---- composite pass: sky background + aerial perspective + clouds (premultiplied over)
	const compositeFn = wgslFn( /* wgsl */ `
	fn composite( uv : vec2<f32>, sceneColor : vec4<f32>, sceneDepth : f32, cloud : vec4<f32>,
		camTan : vec2<f32>, camWorld : mat4x4<f32>, camNear : f32, camFar : f32,
		sunDir : vec3<f32>, sunIntensity : f32, fogDensity : f32, debugMode : f32 ) -> vec4<f32> {
		let ndc = vec2<f32>( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0 );
		let rd = normalize( ( camWorld * vec4<f32>( ndc * camTan, -1.0, 0.0 ) ).xyz );
		let camFwd = normalize( ( camWorld * vec4<f32>( 0.0, 0.0, -1.0, 0.0 ) ).xyz );
		var bg = skyRadiance( rd, sunDir, sunIntensity );
		if ( sceneDepth < 1.0 ) {
			let viewZ = ( camNear * camFar ) / ( ( camFar - camNear ) * sceneDepth - camFar );
			let dist = -viewZ / max( dot( rd, camFwd ), 1e-4 );
			let fog = 1.0 - exp( -dist * fogDensity * 2.5 );
			let haze = skyRadiance( normalize( vec3<f32>( rd.x, 0.02, rd.z ) ), sunDir, 0.0 );
			bg = mix( sceneColor.rgb, haze, fog );
		}
		if ( debugMode == 6.0 ) { return vec4<f32>( vec3<f32>( ( 1.0 - sceneDepth ) * 20.0 ), 1.0 ); }
		// debug views: undo the sRGB output transform so raw values show up linearly
		if ( debugMode >= 1.0 ) { return vec4<f32>( pow( cloud.rgb, vec3<f32>( 2.2 ) ), 1.0 ); }
		return vec4<f32>( bg * cloud.a + cloud.rgb, 1.0 );
	}
	`, [ remapWGSL, phaseWGSL, skyWGSL ] );

	const compMat = new THREE.NodeMaterial();
	compMat.depthTest = false; compMat.depthWrite = false;
	compMat.fragmentNode = compositeFn( {
		uv: uv(), sceneColor: texture( sceneRT.texture, uv() ), sceneDepth: depthNode.r, cloud: texture( cloudRT.texture, uv() ),
		camTan: U.camTan, camWorld: U.camWorld, camNear: U.camNear, camFar: U.camFar,
		sunDir: U.sunDir, sunIntensity: U.sunIntensity, fogDensity: U.fogDensity, debugMode: U.uMarch.z,
	} );
	const compQuad = new THREE.QuadMesh( compMat );

	// ---- GUI
	buildGUI( nubis, renderer, cloudRT );

	// ---- resize
	window.addEventListener( 'resize', () => {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.getDrawingBufferSize( size );
		sceneRT.setSize( size.x, size.y );
		cloudRT.setSize( Math.ceil( size.x * params.renderScale ), Math.ceil( size.y * params.renderScale ) );

	} );

	const stats = new Stats();
	document.body.appendChild( stats.dom );
	setStatus( '' );

	// ---- loop
	const timer = new THREE.Timer();
	const sunLightColor = new THREE.Color();

	renderer.setAnimationLoop( () => {

		timer.update();
		const dt = Math.min( timer.getDelta(), 0.1 );
		if ( params.animate ) cloudTime += dt;
		controls.update( dt );
		camera.updateMatrixWorld();

		syncUniforms();
		U.camPos.value.copy( camera.position );
		const tanY = Math.tan( THREE.MathUtils.degToRad( camera.fov ) / 2 );
		U.camTan.value.set( tanY * camera.aspect, tanY );
		U.camWorld.value.copy( camera.matrixWorld );
		renderer.toneMappingExposure = params.exposure;
		renderer.toneMapping = params.debugMode > 0 ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;

		// scene light follows the sun
		const sd = U.sunDir.value;
		sun.position.copy( sd ).multiplyScalar( 1000 );
		const day = THREE.MathUtils.smoothstep( sd.y, - 0.05, 0.35 );
		sunLightColor.setRGB( 1, THREE.MathUtils.lerp( 0.45, 0.97, THREE.MathUtils.smoothstep( sd.y, 0, 0.3 ) ), THREE.MathUtils.lerp( 0.15, 0.92, THREE.MathUtils.smoothstep( sd.y, 0, 0.3 ) ) );
		sun.color.copy( sunLightColor );
		sun.intensity = 3.0 * day;
		hemi.intensity = 0.2 + 1.0 * day;

		// 1. scene → HDR target (+ depth)
		renderer.setRenderTarget( sceneRT );
		renderer.render( scene, camera );

		// 2. clouds → low-res target
		U.cloudSize.value.set( cloudRT.width, cloudRT.height );
		renderer.setRenderTarget( cloudRT );
		cloudQuad.render( renderer );

		// 3. composite → screen (renderer applies tone mapping + sRGB)
		renderer.setRenderTarget( null );
		compQuad.render( renderer );

		stats.update();

	} );

	window.__nubis = { renderer, camera, params, nubis, controls };

}

function buildGUI( nubis, renderer, cloudRT ) {

	const gui = new GUI( { title: 'Nubis · WebGPU' } );

	const fSun = gui.addFolder( 'Sun' );
	fSun.add( params, 'sunElevation', - 5, 90, 0.5 );
	fSun.add( params, 'sunAzimuth', 0, 360, 1 );
	fSun.add( params, 'sunIntensity', 0, 60, 0.5 );
	fSun.add( params, 'exposure', 0.1, 3, 0.05 );

	const regenWeather = async () => {

		nubis.weatherParams.coverageBias.value = params.coverageBias;
		nubis.weatherParams.typeBias.value = params.typeBias;
		nubis.weatherParams.precipBias.value = params.precipBias;
		nubis.weatherParams.seed.value = params.weatherSeed;
		await nubis.regenerateWeather();

	};
	const fMap = gui.addFolder( 'Cloud map (weather)' );
	fMap.add( params, 'coverageBias', 0, 1, 0.01 ).name( 'coverage' ).onChange( regenWeather );
	fMap.add( params, 'typeBias', 0, 1, 0.01 ).name( 'type (stratus→cumulus)' ).onChange( regenWeather );
	fMap.add( params, 'precipBias', 0, 1, 0.01 ).name( 'precipitation' ).onChange( regenWeather );
	fMap.add( params, 'weatherSeed', 0, 100, 1 ).name( 'seed' ).onChange( regenWeather );
	fMap.add( params, 'coverageMul', 0, 1.5, 0.01 ).name( 'coverage multiplier' );
	fMap.add( params, 'typeOverride', - 1, 1, 0.01 ).name( 'type override (-1 = map)' );
	fMap.add( params, 'weatherScale', 10_000, 200_000, 1000 ).name( 'map extent (m)' );

	const fShape = gui.addFolder( 'Density model' );
	fShape.add( params, 'layerBottom', 500, 5000, 50 );
	fShape.add( params, 'layerTop', 2000, 12000, 50 );
	fShape.add( params, 'shapeScale', 2000, 30000, 100 ).name( 'base noise scale (m)' );
	fShape.add( params, 'detailScale', 100, 4000, 10 ).name( 'detail noise scale (m)' );
	fShape.add( params, 'erosion', 0, 1, 0.01 );
	fShape.add( params, 'curlScale', 1000, 30000, 100 );
	fShape.add( params, 'curlStrength', 0, 800, 1 );
	fShape.add( params, 'cloudTopOffset', 0, 3000, 10 ).name( 'wind shear (m)' );
	fShape.add( params, 'anvilBias', 0, 1, 0.01 );
	fShape.add( params, 'windDirection', 0, 360, 1 );
	fShape.add( params, 'windSpeed', 0, 200, 1 ).name( 'wind speed (m/s)' );
	fShape.add( params, 'animate' );

	const fLight = gui.addFolder( 'Lighting model' );
	fLight.add( params, 'extinction', 0.001, 0.1, 0.001 ).name( 'extinction σ (1/m)' );
	fLight.add( params, 'ambientStrength', 0, 3, 0.01 );
	fLight.add( params, 'eccentricity', - 0.9, 0.95, 0.01 ).name( 'HG eccentricity' );
	fLight.add( params, 'silverIntensity', 0, 3, 0.01 ).name( 'silver lining' );
	fLight.add( params, 'silverSpread', 0.01, 0.9, 0.01 );
	fLight.add( params, 'lightStepLen', 20, 600, 5 ).name( 'light step (m)' );
	fLight.add( params, 'inScatterStrength', 0, 1, 0.01 ).name( 'in‑scatter prob.' );
	fLight.add( params, 'msOctaves', 1, 4, 1 ).name( 'multi‑scatter octaves' );
	fShape.add( params, 'densityScale', 0.5, 6, 0.1 ).name( 'density scale' );

	const fRender = gui.addFolder( 'Renderer' );
	fRender.add( params, 'maxSteps', 32, 256, 1 );
	fRender.add( params, 'jitter', 0, 1, 0.01 );
	fRender.add( params, 'renderScale', [ 0.25, 0.5, 0.75, 1.0 ] ).onChange( ( v ) => {

		const size = renderer.getDrawingBufferSize( new THREE.Vector2() );
		cloudRT.setSize( Math.ceil( size.x * v ), Math.ceil( size.y * v ) );

	} );
	fRender.add( params, 'maxDistance', 10_000, 150_000, 1000 );
	fRender.add( params, 'fogDensity', 0, 0.0002, 0.000001 );
	fRender.add( params, 'debugMode', { none: 0, 'weather map': 1, 'step heat map': 2, 'shape noise': 3, 'detail noise': 4, 'curl noise': 5, 'density (cheap/full/alpha)': 7 } );

	const fCam = gui.addFolder( 'Presets' );
	const presets = {
		'Fair weather cumulus': () => Object.assign( params, { coverageBias: 0.45, typeBias: 0.65, precipBias: 0.05, erosion: 0.35, sunElevation: 35 } ),
		'Overcast stratus': () => Object.assign( params, { coverageBias: 0.85, typeBias: 0.1, precipBias: 0.2, erosion: 0.25, sunElevation: 40 } ),
		'Storm front': () => Object.assign( params, { coverageBias: 0.7, typeBias: 0.9, precipBias: 0.8, anvilBias: 0.8, erosion: 0.3, sunElevation: 20 } ),
		'Sunset': () => Object.assign( params, { coverageBias: 0.5, typeBias: 0.6, precipBias: 0.1, sunElevation: 3, sunAzimuth: 290, sunIntensity: 30 } ),
	};
	for ( const [ name, fn ] of Object.entries( presets ) ) {

		fCam.add( { [ name ]: async () => { fn(); gui.controllersRecursive().forEach( c => c.updateDisplay() ); await regenWeather(); } }, name );

	}

	return gui;

}

init().catch( ( e ) => {

	console.error( e );
	setStatus( 'Error: ' + e.message );

} );
