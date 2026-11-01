export interface GrassParams {
	// cỏ
	bladeCount: number // số lá (instance)
	segments: number // số đoạn dọc mỗi lá, đổi thì dựng lại index buffer
	patchSize: number // m, nửa cạnh vùng cỏ: lá rải trong [-patchSize, patchSize]
	bladeWidth: number // m
	bladeHeight: number // m
	// địa hình, dùng chung cho mặt đất và gốc cỏ
	terrainFrequency: number // tần số noise độ cao (1/m)
	terrainHeight: number // m, biên độ
	// gió
	windStrength: number // độ nghiêng lá theo gió
	windSpeed: number // hệ số tốc độ thời gian của gió
	// tương tác: vật thể đi qua đè cỏ
	trampleRadius: number // m, bán kính vùng cỏ bị đè quanh nhân vật
	trampleBend: number // rad, góc ngả tối đa của ngọn lá khi bị đè
	trampleRecovery: number // s, thời gian cỏ đứng dậy lại (còn ~5% độ đè)
}

export const defaultGrassParams: GrassParams = {
	bladeCount: 128 * 1024,
	segments: 6,
	patchSize: 50,
	bladeWidth: 0.25,
	bladeHeight: 2,
	terrainFrequency: 0.02,
	terrainHeight: 10,
	windStrength: 1.5,
	windSpeed: 1,
	trampleRadius: 1.6,
	trampleBend: 1.3,
	trampleRecovery: 2.5,
}
