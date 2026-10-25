// Minimal first-person fly controls: drag to look, WASD / QE to move, Shift = fast.
import * as THREE from 'three/webgpu';

export class FlyControls {

	constructor( camera, domElement ) {

		this.camera = camera;
		this.dom = domElement;
		this.yaw = 0;
		this.pitch = 0.15;
		this.speed = 60; // m/s
		this.keys = new Set();
		this._dragging = false;
		this._last = { x: 0, y: 0 };

		domElement.addEventListener( 'pointerdown', ( e ) => {

			if ( e.button !== 0 ) return;
			this._dragging = true;
			this._last.x = e.clientX; this._last.y = e.clientY;
			domElement.setPointerCapture( e.pointerId );

		} );
		domElement.addEventListener( 'pointerup', ( e ) => {

			this._dragging = false;
			domElement.releasePointerCapture( e.pointerId );

		} );
		domElement.addEventListener( 'pointermove', ( e ) => {

			if ( ! this._dragging ) return;
			const dx = e.clientX - this._last.x, dy = e.clientY - this._last.y;
			this._last.x = e.clientX; this._last.y = e.clientY;
			this.yaw -= dx * 0.003;
			this.pitch = THREE.MathUtils.clamp( this.pitch - dy * 0.003, - Math.PI / 2 + 0.01, Math.PI / 2 - 0.01 );

		} );
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.target.tagName === 'INPUT' ) return;
			this.keys.add( e.code );

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );

		this._fwd = new THREE.Vector3();
		this._right = new THREE.Vector3();
		this._euler = new THREE.Euler( 0, 0, 0, 'YXZ' );

	}

	update( dt ) {

		const cam = this.camera;
		this._euler.set( this.pitch, this.yaw, 0 );
		cam.quaternion.setFromEuler( this._euler );

		const k = this.keys;
		const fast = k.has( 'ShiftLeft' ) || k.has( 'ShiftRight' );
		const v = this.speed * ( fast ? 15 : 1 ) * dt;

		this._fwd.set( 0, 0, - 1 ).applyQuaternion( cam.quaternion );
		this._right.set( 1, 0, 0 ).applyQuaternion( cam.quaternion );

		if ( k.has( 'KeyW' ) ) cam.position.addScaledVector( this._fwd, v );
		if ( k.has( 'KeyS' ) ) cam.position.addScaledVector( this._fwd, - v );
		if ( k.has( 'KeyD' ) ) cam.position.addScaledVector( this._right, v );
		if ( k.has( 'KeyA' ) ) cam.position.addScaledVector( this._right, - v );
		if ( k.has( 'KeyE' ) || k.has( 'Space' ) ) cam.position.y += v;
		if ( k.has( 'KeyQ' ) || k.has( 'ControlLeft' ) ) cam.position.y -= v;

		cam.position.y = Math.max( cam.position.y, 1.7 );

	}

}
