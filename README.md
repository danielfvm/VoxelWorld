# Voxel World
![image](https://github.com/danielfvm/VoxelWorld/assets/23420640/ef091050-0a01-48c2-a530-053ac0f74bda)
Voxel World is a cellular automata based Voxel game using WebGL that aims to be 3D sanbox version of the popular [Powder Toy](https://powdertoy.co.uk/) game. You can check out a working version [here](https://danielfvm.github.io/VoxelWorld/).

## How it works
### Rendering
The terrain is split into chunks and each chunk is stored as a texture. Since the minimum number of supported texture binds per draw call is 8, only 2x2 chunks are loaded at a time. The chunk data is then passed to a raycasting [shader](/res/world.fs.glsl) rendered on a quad on the screen. We can enhance performance by decreasing the size of the quad and then scaling it up to the screen size in another drawing call. This action reduces the overall image quality, thereby decreasing the number of pixels the raycasting shader needs to process. On the final render pass a [postprocessing shader effect](/res/screen.glsl) adds god rays by computing the sun's position relative to the screen and utilizing the depth buffer. Additionally it performs a custom antialising filter that softens pixels.

![image](https://github.com/danielfvm/VoxelWorld/assets/23420640/a19903bf-5e26-43ff-8bcd-19ac0e354872)

#### Water reflections

https://github.com/danielfvm/VoxelWorld/assets/23420640/c387261e-ea22-481b-9e69-c86c0ecfa41d




### Simulation
Since WebGL does not support compute shaders, Voxel World uses the fragment shader to calculate the cellular automata based physics. It does so by sampling the chunk data from the texture, computing the next state and rendering it to a framebuffer. It uses the texture attached to the framebuffer for the next iteration.

Each voxel keeps track of following information and are updated accordingly in the [simulate](res/simulate.fs.glsl) shader:
* type - Sand, Grass, Stone, ...
* integrity - if voxel is in air or overhang is too large, voxel will drop
* temperature
* velocity
* light level

#### Integrity 

https://github.com/danielfvm/VoxelWorld/assets/23420640/f378d67c-4565-42f4-905c-4a7362b93858

#### Liquid + Light

https://github.com/danielfvm/VoxelWorld/assets/23420640/be116018-0021-4676-be3a-c0eb64b00ad7



## Procedural generated terrain
The terrain is generated with perlin noise inside the [global.glsl](/res/global.glsl#L240) shader.

https://github.com/danielfvm/VoxelWorld/assets/23420640/cd156752-5b7e-4d2a-b352-c85a68137735

## Development
To test the game locally first clone this repository, install dependencies, run the local test server and finally open it in your browser at [http://localhost:8081/](http://localhost:8081/)
```
git clone https://github.com/danielfvm/VoxelWorld
cd VoxelWorld
npm install
npm run serve
```



## Useful resources
* [WebGL Report](https://webglreport.com/?v=2) for checking GPU features
* Raycasting based on [this](https://www.shadertoy.com/view/4dX3zl) shader
