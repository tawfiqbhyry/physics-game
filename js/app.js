let camera, scene, renderer;
let gameStarted = false;
const originalBoxSize = 2;
let stack = [];
let overhangs = [];
let gameworking = true;

const boxHeight = 0.5;
const point = 5;
const scoreEL = document.getElementById("score-count");
const remainingOfItem = document.querySelector("#remaining");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function init() {
  //creating the scene
  scene = new THREE.Scene();

  // initialize canyon
  world = new CANNON.World();
  world.gravity.set(0, -10, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40;

  //foundation
  addLayer(0, 0, originalBoxSize, originalBoxSize);
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

  //Set Up lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // directional light
  const directionalLight = new THREE.DirectionalLight(0x8acacf, 0.5);
  directionalLight.position.set(10, 20, 0);
  scene.add(directionalLight);

  //setup the camera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(20, aspect, 60, 100);

  //camera
  const width = 10;
  const height = width * (window.innerHeight / window.innerWidth);
  camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    1,
    100
  );

  //set the position
  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);

  //renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

  // add the elements to the browser dom
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", onWindowResize, false);
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length;

  const layer = generateBox(x, y, z, width, depth);
  layer.direction = direction;

  stack.push(layer);
}

function addOverHang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1);
  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls) {
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

  const color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`);
  document.querySelector(".container").style.color = `hsl(
    ${30 + stack.length * 4},
    100%,
    50%
  )`;

  const material = new THREE.MeshLambertMaterial({ color });

  const Mesh = new THREE.Mesh(geometry, material);
  Mesh.position.set(x, y, z);

  scene.add(Mesh);

  //Cannon JS
  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  );
  let mass = falls ? 5 : 0;
  const body = new CANNON.Body({ mass, shape });
  body.position.set({ x, y, z });
  world.addBody(body);

  return {
    cannonjs: body,
    threejs: Mesh,
    width,
    depth,
  };
}

init();

window.addEventListener("click", async () => {
  if (!gameStarted) {
    renderer.setAnimationLoop(animate);
    gameStarted = true;
  } else {
    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];

    const direction = topLayer.direction;

    const delta =
      topLayer.threejs.position[direction] -
      previousLayer.threejs.position[direction];

    const overChangeSize = Math.abs(delta);
    const size = direction == "x" ? topLayer.width : topLayer.depth;
    const overlap = size - overChangeSize;

    if (overlap > 0) {
      cutBox(topLayer, overlap, size, delta);
      percentage = Math.round(((size - overChangeSize) / size) * 100 * 10) / 10;
      scoreEL.innerText =
        parseInt(scoreEL.innerText) + (percentage / 100) * point;
      remainingOfItem.innerHTML = percentage;

      const newWidth = direction == "x" ? overlap : topLayer.width;
      const newDepth = direction == "z" ? overlap : topLayer.depth;

      topLayer.width = newWidth;
      topLayer.depth = newDepth;

      topLayer.threejs.scale[direction] = overlap / size;
      topLayer.threejs.position[direction] -= delta / 2;

      const overhangShift =
        (overlap / 2 + overChangeSize / 2) * Math.sign(delta);
      const overhangX =
        direction == "x"
          ? topLayer.threejs.position.x + overhangShift
          : topLayer.threejs.position.x;
      const overhangZ =
        direction == "z"
          ? topLayer.threejs.position.z + overhangShift
          : topLayer.threejs.position.z;
      const overhangWidth = direction == "x" ? overChangeSize : newWidth;
      const overhangDepth = direction == "z" ? overChangeSize : newDepth;
      addOverHang(overhangX, overhangZ, overhangWidth, overhangDepth);

      //next layer
      const nextX = direction === "x" ? topLayer.threejs.position.x : -10;
      const nextZ = direction === "z" ? topLayer.threejs.position.z : -10;

      const nextDirection = direction == "x" ? "z" : "x";

      addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    } else {
      gameworking = false;
      alert("You missed the cube,Game Over!");
      await delay(2000);
      location.reload();
    }
  }
});

function animate() {
  const speed = 0.15;

  const topLayer = stack[stack.length - 1];
  topLayer.threejs.position[topLayer.direction] += speed;
  topLayer.cannonjs.position[topLayer.direction] += speed;

  if (camera.position.y < boxHeight * (stack.length - 2) + 4 && gameworking) {
    camera.position.y += speed;
  }
  updatePhysics();
  renderer.render(scene, camera);
}

function updatePhysics() {
  world.step(1 / 60); // Step the physics world

  // Copy coordinates from Cannon.js to Three.js
  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

function cutBox(topLayer, overlap, size, delta) {
  const direction = topLayer.direction;
  const newWidth = direction == "x" ? overlap : topLayer.width;
  const newDepth = direction == "z" ? overlap : topLayer.depth;

  // Update metadata
  topLayer.width = newWidth;
  topLayer.depth = newDepth;

  // Update ThreeJS model
  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  // Update CannonJS model
  topLayer.cannonjs.position[direction] -= delta / 2;

  // Replace shape to a smaller one (in CannonJS you can't simply just scale a shape)
  const shape = new CANNON.Box(
    new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
  );
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);
}
