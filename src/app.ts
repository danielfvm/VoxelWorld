import ResourceHandler, {ResourceType} from "./ResourceHandler";
import World from "./world";
import {FloatingWindow} from "./window";
import Vector from "./Vector";
import {voxelInfos} from "./VoxelData";
import {SaveSystem} from "./SaveSystem";
import Chunk from "./Chunk";

window.onload = async () => {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
  const status = document.getElementById('status');
  const background = document.getElementById('background');
  const selectMenuBody = document.getElementById('select-menu-body');
  const selectMenuSearch = document.getElementById('select-menu-search') as HTMLInputElement;

  let camPos = Vector.zero();
  let camVel = Vector.zero();

  // yaw and pitch
  let camDir = Vector.zero();
  let camDirDst = Vector.zero();

  const keysPressed = {};
  let shiftPressed = false;

  // Load resources
  await ResourceHandler.get("../res/global.glsl");

  const interactSounds = [
    await ResourceHandler.get("../res/sounds/place.wav", ResourceType.AUDIO),
    await ResourceHandler.get("../res/sounds/break.wav", ResourceType.AUDIO),
  ];

  const backgroundSounds = [
    await ResourceHandler.get("../res/sounds/ambience-day.mp3", ResourceType.AUDIO) as HTMLAudioElement,
    await ResourceHandler.get("../res/sounds/ambience-night.mp3", ResourceType.AUDIO) as HTMLAudioElement,
  ];

  const stepSounds = [
    await ResourceHandler.get("../res/sounds/step01.wav", ResourceType.AUDIO),
    await ResourceHandler.get("../res/sounds/step02.wav", ResourceType.AUDIO),
    await ResourceHandler.get("../res/sounds/step03.wav", ResourceType.AUDIO),
    await ResourceHandler.get("../res/sounds/step04.wav", ResourceType.AUDIO),
  ];

  // Create world
  const world = new World(gl);
  await world.init();

  let fpsLimit = 120;
  let flying = false;

  let selectedVoxel = 1;

  // Create settings window
  const settingsWindow = new FloatingWindow("Settings / Debugging", [window.innerWidth - 250, 10], [220, 600]);
  settingsWindow.setVisible(true);
  settingsWindow.addCheckbox("Smoothing", world.smoothing, (value) => world.smoothing = value);
  settingsWindow.addCheckbox("God Rays", world.godrays, (value) => world.godrays = value);
  settingsWindow.addCheckbox("Reflections", world.debugReflections, (value) => world.debugReflections = value);
  settingsWindow.addCheckbox("Shadows", world.debugShadows, (value) => world.debugShadows = value);
  settingsWindow.addCheckbox("Flying", flying, (value) => flying = value);
  settingsWindow.addSlider("Pixel scale", 5, 50, world.pixelScale * 100, (value) => world.pixelScale = value / 100);
  settingsWindow.addSlider("Render distance", 50, 300, world.renderDistance, (value) => world.renderDistance = value);
  settingsWindow.addSlider("Limit FPS", 1, 500, fpsLimit, (value) => fpsLimit = value);
  settingsWindow.addSlider("Brsuh size", 1, 6, world.brushSize, (value) => world.brushSize = value);
  settingsWindow.addButton("Day", () => world.frame = 0);
  settingsWindow.addButton("Night", () => world.frame = 50000);
  settingsWindow.addButton("Respawn", () => {
    camPos.set(0);
    camDir.set(0);
    camDirDst.set(0);
  });

  settingsWindow.addSelection("Visualize", 0, ["Default", "Integrity", "Temperature", "Velocity"], (value) => world.debugVisualize = value);

  settingsWindow.addButton("Save", () => {
    world.save(prompt("Name of world"));
  });

  settingsWindow.addButton("Load", () => {
    world.load(prompt("Name of world"));
  });

  settingsWindow.addButton("List", async () => {
    console.log(await SaveSystem.list());
  });

  settingsWindow.addButton("Clear", () => {
    SaveSystem.clear();
  });


  window.addEventListener('keydown', (event) => {
    shiftPressed = event.shiftKey;
    keysPressed[event.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (event) => {
    shiftPressed = event.shiftKey;
    keysPressed[event.key.toLowerCase()] = false;
  });

  // check if scroll and shift key pressed, if so change brush size
  window.addEventListener('wheel', (event) => {
    if (shiftPressed) {
      world.brushSize = Math.max(1, Math.min(6, world.brushSize + (event.deltaY > 0 ? -1 : 1)));
    }
  });


  // capture mouse input and lock mouse
  document.addEventListener('mousemove', (event) => {
    // check if pointer is locked
    if (!document.pointerLockElement) {
      return;
    }

    camDirDst.x -= event.movementX * 0.01;
    camDirDst.y += event.movementY * 0.01;

    if (camDirDst.y < -1.5) {
      camDirDst.y = -1.5;
    }
    if (camDirDst.y > 1.5) {
      camDirDst.y = 1.5;
    }

    placeTimer -= 40;
  });

  // lock mouse on click
  background.addEventListener('click', (e) => {
    if (e.target == background) {
      canvas.requestPointerLock()
      backgroundSounds[0].loop = true;
      backgroundSounds[0].play();

      backgroundSounds[1].loop = true;
      backgroundSounds[1].play();
    }
  });

  const mouseDown = {};
  document.addEventListener("mousedown", (event) => {
    mouseDown[event.button] = true

    if (document.pointerLockElement && event.button == 1) {
      selectedVoxel = world.rayCast(camPos, camDir).id || selectedVoxel;
    }
  });
  document.addEventListener("mouseup", (event) => mouseDown[event.button] = false);

  // pointer lock listener
  document.addEventListener('pointerlockchange', () => {
    settingsWindow.setVisible(!document.pointerLockElement);
    if (document.pointerLockElement) {
      background.classList.remove("visible");
    } else {
      background.classList.add("visible");
    }
  });

  window.addEventListener("beforeunload", () => {
    world.destroy();
    console.log("Destroyed world!");
  });

  const selectMenuSearchPlaceholder = selectMenuSearch.placeholder;
  voxelInfos.slice(1).forEach((voxel, id) => {
    const color = `rgba(${voxel.color.map((x: number) => Math.floor(x * 255)).join(',')})`;

    const div = document.createElement('div');
    div.classList.add('voxel');
    div.style.backgroundColor = color;
    div.title = voxel.name;

    div.addEventListener('click', () => {
      selectedVoxel = id + 1;
      canvas.requestPointerLock();
    });

    div.addEventListener('mouseenter', () => selectMenuSearch.placeholder = voxel.name);
    div.addEventListener('mouseleave', () => selectMenuSearch.placeholder = selectMenuSearchPlaceholder);

    selectMenuBody.appendChild(div);
  });

  const maxArrayTextureLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
  const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const maxUBSize = gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE);
  const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  console.log('Max Texture Size', maxTexSize);
  console.log('Max Texture Units:', maxTextureUnits);
  console.log('Max Array Texture Layers:', maxArrayTextureLayers);
  console.log('Max Uniform block Size:', maxUBSize);

  window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    world.resize();
  }
  window.onresize(null);

  let placeTimer = Date.now();
  let placeAudioTimer = Date.now();
  let walkAudioTimer = Date.now();
  let onground = false;

  const playerUpdate = (delta: number) => {
    const speed = 3 * (shiftPressed ? 5 : 1);
    const moveVel = Vector.zero();

    // Do keyboard WASD input for camera movement by setting velocity
    if (keysPressed['w']) {
      moveVel.z += 1;
    }
    if (keysPressed['a']) {
      moveVel.x -= 1;
    }
    if (keysPressed['s']) {
      moveVel.z -= 1;
    }
    if (keysPressed['d']) {
      moveVel.x += 1;
    }
    if (keysPressed['q']) {
      camVel.y += speed;
    }
    if (keysPressed['e']) {
      camVel.y -= speed;
    }

    moveVel.normalize().mul(speed);

    if (keysPressed[' '] && onground && !flying) {
      camVel.y += 15.0;
    }

    if (flying) {
      camVel.mul(0.1);
      moveVel.mul(0.1);
    }

    // Rotate moveVel according yaw and add to camVel
    camVel.x += moveVel.x * Math.cos(camDir.x) - moveVel.z * Math.sin(camDir.x);
    camVel.z += moveVel.x * Math.sin(camDir.x) + moveVel.z * Math.cos(camDir.x);

    if (document.pointerLockElement && (mouseDown[0] || mouseDown[2]) && placeTimer + 160 < Date.now()) {
      const isBreak = mouseDown[2] == true;
      const type = isBreak ? 0 : selectedVoxel;
      const pos = world.playerPlace(camPos, camDir, type);
      const dis = Vector.sub(pos, camPos);

      if (placeAudioTimer < Date.now()) {
        const soundNode = interactSounds[isBreak ? 1 : 0].cloneNode(true);
        soundNode.volume = Math.max(0.1, 1 - dis.length() * 0.03);
        soundNode.play();

        placeAudioTimer = Date.now() + Math.random() * 100;
      }

      placeTimer = Date.now();
    }

    if (camPos.y < -Chunk.HEIGHT / 2) {
      camPos.y = Chunk.HEIGHT / 2;
      camVel.y = 0;
    }

    if (camPos.y > Chunk.HEIGHT / 2) {
      camPos.y = Chunk.HEIGHT / 2;
    }

    camDir.add(Vector.mul(Vector.sub(camDirDst, camDir), Vector.all(0.5)));

    const horizontalSpeed = Math.sqrt(camVel.x * camVel.x + camVel.z * camVel.z);

    if (onground && horizontalSpeed > 0.5) {
      if (walkAudioTimer < Date.now()) {
        const soundNode = stepSounds[Math.floor(Math.random() * stepSounds.length)].cloneNode(true);
        soundNode.volume = Math.min(1, 0.1 + horizontalSpeed * 0.005);
        soundNode.play();

        walkAudioTimer = Date.now() + Math.random() * 50 + 300;
      }
    }
  };

  let fps, fpsInterval, now, then, elapsed, fpsTimeout, fpsCounter;

  let deltaTimer = performance.now();

  function animate() {

    // request another frame
    requestAnimationFrame(animate);

    // calc elapsed time since last loop
    now = performance.now();
    elapsed = now - then;

    fpsInterval = 1000 / fpsLimit;

    if (now > fpsTimeout + 500) {
      fpsTimeout = now;
      fps = fpsCounter * 2;
      fpsCounter = 0;
    }

    // if enough time has elapsed, draw the next frame
    if (elapsed > fpsInterval) {
      // Get ready for next frame by setting then=now, but also adjust for your
      // specified fpsInterval not being a multiple of RAF's interval (16.7ms)
      then = now - (elapsed % fpsInterval);
      fpsCounter++;

      const delta = (now - deltaTimer) / 1000;
      deltaTimer = now;

      if (document.pointerLockElement) {
        // Put your drawing code here
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        world.render(camPos, camDir);

        const dayNight = world.getDayNight();
        backgroundSounds[0].volume = Math.max(0, dayNight);
        backgroundSounds[1].volume = Math.max(0, -dayNight);
        

        playerUpdate(delta);
        if (flying)
          camPos.add(camVel);
        else
          onground = world.updateCam(delta, camPos, camDir, camVel)

        status.innerHTML =
          fps + "fps " + elapsed.toFixed(2) + "ms<br>" +
          Vector.floor(camPos) + "<br>" +
          Vector.floor(world.getCenterChunk(camPos)) + "<br>" +
          "Chunks: " + world.chunks.size;
      }
    }
  }

  // initialize the timer variables and start the animation
  then = performance.now();
  fpsTimeout = then;
  fpsCounter = 0;
  fps = 0;
  animate();
}
