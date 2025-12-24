<script lang="ts">
	import JoltSvelte from '$lib/components/jolt-svelte/jolt-svelte.svelte'
	import { CodeHighlight } from '$lib/components/code-highlight'
</script>

<div class="mockup-window border-base-300 w-full border bg-blue-200">
	<JoltSvelte />
</div>

<div class="divider"></div>

<p><strong>step-by-step</strong> guide for integrating Jolt Physics with Three.js</p>

<h2 class="mt-8 mb-4 text-2xl font-bold">Step 1: Install & Import Dependencies</h2>

<p>Option A: Using npm</p>

<div class="mockup-code my-4 w-full">
	<pre data-prefix="$"><code>npm i jolt-physics</code></pre>
</div>

<CodeHighlight
	code={`import * as THREE from 'three';
import initJolt from 'jolt-physics';  // or 'jolt-physics/wasm-compat'
`}
/>

<p class="my-4">Option B: Using CDN</p>

<CodeHighlight
	code={`\<script src="https://unpkg.com/three@latest/build/three.min.js"\>\</script\>
\<script type="module"\>
  import initJolt from "https:\/\/www.unpkg.com\/jolt-physics\/dist\/jolt-physics.wasm-compat.js";
\</script\>
`}
/>

<h2 class="mt-8 mb-4 text-2xl font-bold">Step 2: Initialize Jolt Physics</h2>
<p>Jolt is a WASM module that needs to be initialized asynchronously:</p>

<CodeHighlight
	code={`let Jolt;
let jolt, physicsSystem, bodyInterface;

// Object layers for collision filtering
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_OBJECT_LAYERS = 2;

async function initPhysics() {
  Jolt = await initJolt();

  // Create settings
  const settings = new Jolt.JoltSettings();

  // Setup collision filtering (required)
  setupCollisionFiltering(settings);

  // Create the Jolt interface
  jolt = new Jolt.JoltInterface(settings);
  Jolt.destroy(settings);

  // Get references to main systems
  physicsSystem = jolt.GetPhysicsSystem();
  bodyInterface = physicsSystem.GetBodyInterface();
}

function setupCollisionFiltering(settings) {
  // Define which layers can collide with each other
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
  objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
  objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);

  // Map object layers to broadphase layers
  const BP_LAYER_NON_MOVING = new Jolt.BroadPhaseLayer(0);
  const BP_LAYER_MOVING = new Jolt.BroadPhaseLayer(1);
  const NUM_BROAD_PHASE_LAYERS = 2;

  const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, NUM_BROAD_PHASE_LAYERS);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_LAYER_NON_MOVING);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_LAYER_MOVING);

  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bpInterface;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
    settings.mBroadPhaseLayerInterface,
    NUM_BROAD_PHASE_LAYERS,
    settings.mObjectLayerPairFilter,
    NUM_OBJECT_LAYERS
  );
}
`}
/>

<h2 class="mt-8 mb-4 text-2xl font-bold">Step 3: Set Up Three.js Scene</h2>

<CodeHighlight
	code={`
let scene, camera, renderer;
const clock = new THREE.Clock();
const dynamicObjects = []; // Track physics objects

function initGraphics() {
  // Renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
  camera.position.set(0, 15, 30);
  camera.lookAt(0, 0, 0);

  // Scene
  scene = new THREE.Scene();

  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 5);
  scene.add(light);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
`}
/>

<h2 class="mt-8 mb-4 text-2xl font-bold">
	Step 4: Create Helper Functions for Jolt ↔ Three.js Conversion
</h2>

<CodeHighlight
	code={`// Convert Jolt vectors/quaternions to Three.js
const wrapVec3 = (v) => new THREE.Vector3(v.GetX(), v.GetY(), v.GetZ());
const wrapQuat = (q) => new THREE.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW());

// Convert Three.js to Jolt
const unwrapVec3 = (v) => new Jolt.Vec3(v.x, v.y, v.z);
const unwrapRVec3 = (v) => new Jolt.RVec3(v.x, v.y, v.z);
const unwrapQuat = (q) => new Jolt.Quat(q.x, q.y, q.z, q.w);`}
/>

<h2 class="mt-8 mb-4 text-2xl font-bold">Step 5: Create Physics Bodies & Three.js Meshes</h2>

<p>Create a static floor:</p>

<CodeHighlight
	code={`function createFloor(size = 50) {
  // Physics shape
  const shape = new Jolt.BoxShape(new Jolt.Vec3(size, 0.5, size), 0.05, null);

  // Physics body settings
  const creationSettings = new Jolt.BodyCreationSettings(
    shape,
    new Jolt.RVec3(0, -0.5, 0),           // Position
    new Jolt.Quat(0, 0, 0, 1),            // Rotation (identity)
    Jolt.EMotionType_Static,              // Static body
    LAYER_NON_MOVING                      // Layer
  );

  const body = bodyInterface.CreateBody(creationSettings);
  Jolt.destroy(creationSettings);

  // Add to physics world
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);

  // Create corresponding Three.js mesh
  const geometry = new THREE.BoxGeometry(size * 2, 1, size * 2);
  const material = new THREE.MeshPhongMaterial({ color: 0xc7c7c7 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, -0.5, 0);
  mesh.userData.body = body; // Link physics body to mesh

  scene.add(mesh);
  dynamicObjects.push(mesh);

  return body;
}`}
/>

<p class="mt-4">Create a dynamic sphere:</p>

<CodeHighlight
	code={`function createSphere(position, radius, color = 0xff0000) {
  // Physics shape
  const shape = new Jolt.SphereShape(radius, null);

  // Physics body
  const creationSettings = new Jolt.BodyCreationSettings(
    shape,
    new Jolt.RVec3(position.x, position.y, position.z),
    Jolt.Quat.prototype.sIdentity(),
    Jolt.EMotionType_Dynamic,             // Dynamic body
    LAYER_MOVING
  );
  creationSettings.mRestitution = 0.5;    // Bounciness

  const body = bodyInterface.CreateBody(creationSettings);
  Jolt.destroy(creationSettings);

  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);

  // Three.js mesh
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshPhongMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.body = body;

  scene.add(mesh);
  dynamicObjects.push(mesh);

  return body;
}`}
/>

<h2 class="mt-8 mb-4 text-2xl font-bold">Step 6: Game Loop - Sync Physics → Graphics</h2>

<CodeHighlight
	code={`function animate() {
  requestAnimationFrame(animate);

  // Get delta time (clamped to prevent spiral of death)
  let deltaTime = clock.getDelta();
  deltaTime = Math.min(deltaTime, 1.0 / 30.0);

  // Step physics simulation
  // Use 2 sub-steps when framerate drops below 55 Hz
  const numSteps = deltaTime > 1.0 / 55.0 ? 2 : 1;
  jolt.Step(deltaTime, numSteps);

  // Sync Three.js meshes with physics bodies
  for (const mesh of dynamicObjects) {
    const body = mesh.userData.body;
    if (body) {
      mesh.position.copy(wrapVec3(body.GetPosition()));
      mesh.quaternion.copy(wrapQuat(body.GetRotation()));
    }
  }

  renderer.render(scene, camera);
}`}
/>

<h2 class="mt-8 mb-4 text-2xl font-bold">Step 7: Put It All Together</h2>

<CodeHighlight
	code={`async function main() {
  await initPhysics();
  initGraphics();

  // Create scene objects
  createFloor();

  // Spawn some dynamic spheres
  for (let i = 0; i < 10; i++) {
    createSphere(
      { x: (Math.random() - 0.5) * 10, y: 10 + i * 2, z: (Math.random() - 0.5) * 10 },
      0.5 + Math.random() * 0.5,
      Math.random() * 0xffffff
    );
  }

  // Start render loop
  animate();
}

main();`}
/>

<h3 class="mt-8 mb-4 text-xl font-bold">Key Concepts Summary</h3>

<div class="rounded-box bg-base-100 w-fit overflow-x-auto border border-lime-900">
	<table class="table-zebra table">
		<thead>
			<tr>
				<th>Concept</th>
				<th>Description</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<th class="border-t border-lime-900">Object Layers</th>
				<td class="border-t border-lime-900"
					>Control which objects can collide (static vs moving)</td
				>
			</tr>
			<tr>
				<th class="border-t border-lime-900">BodyCreationSettings</th>
				<td class="border-t border-lime-900">Configure position, rotation, motion type, layer </td>
			</tr>
			<tr>
				<th class="border-t border-lime-900">EMotionType</th>
				<td class="border-t border-lime-900">
					<strong>Static</strong> (immovable), <strong>Dynamic</strong> (physics-driven),
					<strong>Kinematic</strong> (code-driven)
				</td>
			</tr>
			<tr>
				<th class="border-t border-lime-900">bodyInterface</th>
				<td class="border-t border-lime-900">Add/remove/query bodies in the physics world </td>
			</tr>
			<tr>
				<th class="border-t border-lime-900">jolt.Step()</th>
				<td class="border-t border-lime-900">Advance physics simulation by deltaTime</td>
			</tr>
			<tr>
				<th class="border-t border-lime-900">Sync loop</th>
				<td class="border-t border-lime-900">
					Copy <strong>body.GetPosition()</strong> and <strong>body.GetRotation()</strong> to Three.js
					each frame
				</td>
			</tr>
		</tbody>
	</table>
</div>

<h3 class="mt-8 mb-4 text-xl font-bold">Memory Management Warning ⚠️</h3>

<p class="mb-2">
	Jolt uses WebAssembly, so you <strong>must manually destroy</strong> objects created with
	<span class="badge badge-dash badge-primary"><code>new Jolt.XXX()</code></span>:
</p>

<CodeHighlight
	code={`// After you're done with temporary Jolt objects:
Jolt.destroy(creationSettings);
Jolt.destroy(tempVec);

// To remove a body completely:
bodyInterface.RemoveBody(body.GetID());
bodyInterface.DestroyBody(body.GetID());`}
/>
