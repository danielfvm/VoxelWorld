type Properties = "name" | "color" | "randomColor" | "specular" | "distortion" | "reflection" | "physics" | "flamable" | "emission" | "solid" | "temperature" | "density";
type PropertyDict = { [key in Properties]?: any };

enum VoxelPhsyics {
  OTHER,
  SOLID,
  SAND,
  LIQUID,
  GAS,
}

const DefaultPropertyValues: PropertyDict = {
  name: null,
  color: null, 
  randomColor: 0.0,
  specular: 0.0,
  distortion: false,
  reflection: 0.0,
  physics: VoxelPhsyics.OTHER,
  flamable: false,
  emission: 0,
  solid: true,
  temperature: 0,
  density: 0,
}

const PropertyGlslTypes: PropertyDict = {
  name: "string",
  color: "vec4",
  randomColor: "float",
  specular: "float",
  distortion: "bool",
  reflection: "float",
  physics: "uint",
  flamable: "bool",
  emission: "uint",
  solid: "bool",
  temperature: "int",
  density: "int",
}

export const voxelInfos: PropertyDict[] = [
  { name: "Air", color: [0, 0, 0, 0], solid: false },
  { name: "Grass", color: [0.4, 0.9, 0.2], randomColor: 0.1, physics: VoxelPhsyics.SOLID },
  { name: "Stone", color: [0.4, 0.44, 0.46], randomColor: 0.1, physics: VoxelPhsyics.SOLID },
  { name: "Water", color: [0.3, 0.5, 1.0, 0.5], specular: 1.0, distortion: true, reflection: 0.5, physics: VoxelPhsyics.LIQUID, solid: false },
  { name: "Sand", color: [1.0, 0.7, 0.2], randomColor: 0.2, physics: VoxelPhsyics.SAND },
  { name: "Snow", color: [0.9, 0.9, 0.9], randomColor: 0.1, physics: VoxelPhsyics.SOLID, specular: 0.9, temperature: -50 },
  { name: "Light", color: [1.0, 1.0, 1.0, 1.0], emission: 32 },
  { name: "Mirror", color: [0.0, 0.0, 0.0, 1.0], reflection: 1.0 },
  { name: "Walkthrough", color: [1.0, 0.0, 1.0, 1.0], solid: false },
  { name: "Fire", color: [0.9, 0.3, 0.1], randomColor: 0.1, solid: false, emission: 32, physics: VoxelPhsyics.GAS, temperature: 100 },
  { name: "Lava", color: [0.9, 0.4, 0.15], randomColor: 0.1, physics: VoxelPhsyics.LIQUID, solid: false, emission: 20, temperature: 120 },
  { name: "Oil", color: [0.0, 0.0, 0.0], randomColor: 0.03, distortion: true, reflection: 0.1, physics: VoxelPhsyics.LIQUID, solid: false, density: -1, flamable: true },
  { name: "Cloud", color: [1.0, 1.0, 1.0], randomColor: 0.1, physics: VoxelPhsyics.OTHER, density: -100, solid: false, emission: 1 },
  { name: "Wood", color: [0.5, 0.3, 0.0], randomColor: 0.2, physics: VoxelPhsyics.SOLID, flamable: true },
  { name: "Basalt", color: [0.2, 0.24, 0.26], randomColor: 0.1, physics: VoxelPhsyics.SOLID },
];

export function getVoxelProperties(): Properties[] {
  return Object.keys(DefaultPropertyValues) as Properties[];
}

// a function that generates GLSL array with VOXEL_[PROPERTY_NAME] for each voxelInfo
export function generateVoxelProperty(property: Properties): string {
  const infos = voxelInfos.map((info) => info);
  while (infos.length < 255)
    infos.push({ name: "Empty" + infos.length, color: [1, 0, 1, 1], solid: true });
  
  const properties = infos.map((info) => info[property] ?? DefaultPropertyValues[property] ?? (() => { 
    throw `Undefined property ${property}`; 
  })());

  const type = PropertyGlslTypes[property];
  const datas = properties.map((v) => `${type}(${type === "vec4" && v.length != 4 ? [ ...v, 1 ] : v})`);

  if (type === "string") {
    return "";
  }

  return `${type} VOXEL_${property.toUpperCase()}[${datas.length}] = ${type}[${datas.length}](${datas.join(', ')});`;
}

export function generateVoxelIds(): string {
  return voxelInfos.map((info, i) => `#define _${info.name.toUpperCase()} ${i}u`).join('\n');
}

export function generatePhyicsId(): string {
  return Object.keys(VoxelPhsyics).map((name) => `#define _PHYSICS_${name.toUpperCase()} ${VoxelPhsyics[name]}u`).join('\n');
}
