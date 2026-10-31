export function createRng(seed: number) {
	let s = seed
	return () => ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296
}
