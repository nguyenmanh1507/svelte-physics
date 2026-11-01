// Mô tả control dưới dạng dữ liệu: thêm một thông số chỉ cần thêm một dòng config.
type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T]

export type RangeConfig<T> = {
	key: KeysOfType<T, number>
	label: string
	min: number
	max: number
	step: number
	hint?: string
}

export type ToggleConfig<T> = { key: KeysOfType<T, boolean>; label: string; note?: string }

export type SelectOption = { label: string; value: number }
