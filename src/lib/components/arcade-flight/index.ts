// Hệ điều khiển máy bay arcade dùng lại được cho scene Three.js bất kỳ.
//   core/      lõi bay engine-agnostic (flight model, pilot, maneuver, config)
//   three/     adapter Three.js + DOM (input, camera bám đuôi, vệt hơi, reticle)
//   aircraft/  model mẫu (GLB): Su-57, Yak-130, Boeing 777
//   *.svelte   HUD, bảng phím, bảng config, nút cảm ứng
export * from './core'
export * from './three/aircraft-rig'
export * from './three/arcade-flight-controller'
export * from './three/flight-input'
export { ReticleOverlay } from './three/reticle-overlay'
export { VaporTrail } from './three/vapor-trail'
export { disposeObject } from './three/dispose'
export { loadSu57Rig, SU57_URL } from './aircraft/su57'
export { loadB777Rig, B777_URL } from './aircraft/b777'
export * from './aircraft/gltf-rig'
export { loadYak130Rig, YAK130_URL } from './aircraft/yak130'
export { default as FlightHud } from './flight-hud.svelte'
export { default as FlightHelp } from './flight-help.svelte'
export { default as FlightConfigPanel } from './flight-config-panel.svelte'
export { default as FlightTouchControls } from './flight-touch-controls.svelte'
