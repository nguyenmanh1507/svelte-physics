// The DOM typings in use know GPUDevice and friends but not the usage flags or the canvas context.
declare const GPUTextureUsage: {
	readonly COPY_SRC: number
	readonly COPY_DST: number
	readonly TEXTURE_BINDING: number
	readonly STORAGE_BINDING: number
	readonly RENDER_ATTACHMENT: number
}

interface WebGPUCanvasContext {
	configure(configuration: {
		device: GPUDevice
		format: GPUTextureFormat
		alphaMode?: 'opaque' | 'premultiplied'
		usage?: number
	}): void
	unconfigure(): void
	getCurrentTexture(): GPUTexture
}
