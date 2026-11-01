// Danh sách model rải trên mặt đất (static/streaming-terrain/models).
// Thêm model: chép file .glb vào thư mục đó rồi thêm một dòng ở đây.
const MODELS_PATH = '/streaming-terrain/models/'

export const FOLIAGE_ASSETS = [
	...Array.from({ length: 8 }, (_, i) => `tree${i + 1}.glb`),
	...Array.from({ length: 6 }, (_, i) => `bush0${i + 1}.glb`),
].map((name) => MODELS_PATH + name)

export const SKYBOX_URL = '/streaming-terrain/skybox/rosendal_park_sunset_1k.hdr'
