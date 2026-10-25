// Mây thể tích Nubis (Guerrilla Games, Horizon Zero Dawn) cho WebGPURenderer.
// Bản gốc độc lập: docs/nubis-webgpu.
export { default as NubisSky, type NubisSceneHooks, type NubisSkyContext } from './nubis-sky.svelte'
export { NubisCloudscape, type SunLightOptions } from './nubis-cloudscape'
export { NubisTextures } from './noise-textures'
export {
	WEATHER_KEYS,
	defaultNubisParams,
	nubisPresets,
	packUniforms,
	sunDirection,
	type NubisParams,
} from './params'
