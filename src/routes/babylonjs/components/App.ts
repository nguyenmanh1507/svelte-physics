import '@babylonjs/core/Debug/debugLayer'
import '@babylonjs/loaders/glTF'
import { Sound } from '@babylonjs/core/Audio/sound.js'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js'
import { Engine } from '@babylonjs/core/Engines/engine.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { Effect } from '@babylonjs/core/Materials/effect.js'
import { Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js'
import { Scene } from '@babylonjs/core/scene.js'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture.js'
import { Button } from '@babylonjs/gui/2D/controls/button.js'
import { Control } from '@babylonjs/gui/2D/controls/control.js'
import { Image } from '@babylonjs/gui/2D/controls/image.js'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle.js'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock.js'

enum State {
	START,
	GAME,
	LOSE,
	CUTSCENE,
}

class App {
	// General entire application
	private _scene: Scene
	private _canvas: HTMLCanvasElement
	private _engine: Engine
	private _transition = false

	// Scene - related
	private _state: State = State.START

	constructor(canvas: HTMLCanvasElement) {
		this._canvas = canvas
		this._engine = new Engine(canvas, true)
		this._scene = new Scene(this._engine)
		const camera = new ArcRotateCamera(
			'Main Camera',
			Math.PI / 2,
			Math.PI / 2,
			2,
			Vector3.Zero(),
			this._scene
		)
		camera.attachControl(this._canvas, true)

		new HemisphericLight('Light1', new Vector3(1, 1, 0), this._scene)
		MeshBuilder.CreateSphere('Sphere', { diameter: 1 }, this._scene)
	}

	private _handleKeyDown = (ev: KeyboardEvent) => {
		if (ev.shiftKey && ev.ctrlKey && ev.altKey && (ev.key === 'I' || ev.key === 'i')) {
			if (this._scene.debugLayer.isVisible()) {
				this._scene.debugLayer.hide()
				this._engine.resize()
			} else {
				this._scene.debugLayer.show()
				this._engine.resize()
			}
		}
	}

	private _goToStart = () => {
		this._engine.displayLoadingUI()

		// SECTION: --SCENE SETUP--
		//dont detect any inputs from this ui while the game is loading
		this._scene.detachControl()
		const scene = new Scene(this._engine)
		scene.clearColor = new Color4(0, 0, 0, 1.0)
		const camera = new FreeCamera('Camera1', new Vector3(0, 0, 0), scene)
		camera.setTarget(Vector3.Zero())

		// SECTION: --SOUND--
		new Sound('startSong', '/summer-festival/sounds/copycat(revisited).mp3', scene, () => {}, {
			volume: 0.25,
			loop: true,
			autoplay: true,
		})
		new Sound('selection', '/summer-festival/sounds/vgmenuselect.mp3', scene, () => {})

		// SECTION: --GUI--
		const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI('UI')
		guiMenu.idealHeight = 720

		const imageRect = new Rectangle('titleContainer')
		imageRect.width = 0.8
		imageRect.thickness = 0
		guiMenu.addControl(imageRect)

		const startBG = new Image('startBG', '/summer-festival/images/sprites/start.jpeg')
		imageRect.addControl(startBG)

		const title = new TextBlock('title', "SUMMER'S FESTIVAL")
		title.resizeToFit = true
		title.fontFamily = 'Ceviche One'
		title.fontSize = '64px'
		title.color = 'white'
		title.top = '14px'
		title.width = 0.8
		title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP
		imageRect.addControl(title)

		const startBtn = Button.CreateSimpleButton('start', 'PLAY')
		startBtn.fontFamily = 'Viga'
		startBtn.width = 0.2
		startBtn.height = '40px'
		startBtn.color = 'white'
		startBtn.top = '-14px'
		startBtn.thickness = 0
		startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM
		imageRect.addControl(startBtn)

		// SECTION: set up transition effect : modified version of https://www.babylonjs-playground.com/#2FGYE8#0
		Effect.RegisterShader(
			'fade',
			`
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float fadeLevel;
void main(void){
vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;
baseColor.a = 1.0;
gl_FragColor = baseColor;
		}
	`
		)

		this._transition = false
	}

	initialize() {
		window.addEventListener('keydown', this._handleKeyDown)
		this._engine.runRenderLoop(() => {
			this._scene.render()
		})
	}

	cleanup() {
		window.removeEventListener('keydown', this._handleKeyDown)
		this._engine.stopRenderLoop()
		this._engine.dispose()
	}
}

export { App }
