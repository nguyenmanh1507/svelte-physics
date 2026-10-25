// Trình xem từng bước của tutorial volume rendering (canvas riêng).
export { default as VolumetricCloud } from './volumetric-cloud.svelte'
export { defaultParams, type VolumeParams } from './params'

// Mây thể tích để thả vào một scene three.js có sẵn.
export { CloudField, type CloudFieldOptions } from './cloud-field'
export {
	CLOUD_KINDS,
	createCloudShape,
	createRandom,
	type CloudKind,
	type CloudShape,
} from './shapes'
