import * as THREE from 'three'
import grass1Url from './textures/grass1.png?url'
import grass2Url from './textures/grass2.png?url'
import gridUrl from './textures/grid.png?url'
import tileDataUrl from './textures/tileData.jpg?url'

export type GrassTextures = {
	grid: THREE.Texture // vạch lưới của mặt đất
	tileData: THREE.Texture // mặt nạ lối đi: vùng sáng = cỏ thấp / không có cỏ
	bladeDiffuse: THREE.DataArrayTexture // mỗi lớp là một loại lá cỏ
}

// Các texture gốc để nguyên (NoColorSpace) vì shader tự gamma-encode ở cuối.
export async function loadGrassTextures(): Promise<GrassTextures> {
	const loader = new THREE.TextureLoader()
	const [grid, tileData, bladeDiffuse] = await Promise.all([
		loader.loadAsync(gridUrl),
		loader.loadAsync(tileDataUrl),
		loadTextureArray([grass1Url, grass2Url]),
	])
	grid.wrapS = grid.wrapT = THREE.RepeatWrapping
	return { grid, tileData, bladeDiffuse }
}

export function disposeGrassTextures(t: GrassTextures) {
	t.grid.dispose()
	t.tileData.dispose()
	t.bladeDiffuse.dispose()
}

// Ghép nhiều ảnh cùng kích thước thành một DataArrayTexture (sampler2DArray trong shader)
export async function loadTextureArray(urls: string[]) {
	const loader = new THREE.ImageLoader()
	const images = await Promise.all(urls.map((url) => loader.loadAsync(url)))
	const { width, height } = images[0]
	const layerSize = width * height * 4
	const data = new Uint8Array(layerSize * images.length)

	images.forEach((image, i) => {
		if (image.width !== width || image.height !== height) {
			throw new Error(`Ảnh ${urls[i]} khác kích thước ${width}×${height}`)
		}
		data.set(readPixels(image).data, i * layerSize)
	})

	const texture = new THREE.DataArrayTexture(data, width, height, images.length)
	texture.format = THREE.RGBAFormat
	texture.type = THREE.UnsignedByteType
	texture.minFilter = THREE.LinearMipMapLinearFilter
	texture.magFilter = THREE.LinearFilter
	texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
	texture.generateMipmaps = true
	texture.needsUpdate = true
	return texture
}

// Đọc pixel qua canvas, lật dọc để khớp quy ước uv của WebGL (gốc dưới-trái)
function readPixels(image: HTMLImageElement) {
	const canvas = document.createElement('canvas')
	canvas.width = image.width
	canvas.height = image.height
	const context = canvas.getContext('2d')!
	context.translate(0, image.height)
	context.scale(1, -1)
	context.drawImage(image, 0, 0)
	return context.getImageData(0, 0, image.width, image.height)
}
