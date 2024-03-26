/*
floatBitsToInt

Fibonacci = 1:
  SET X A
  ADD A R
  SET R X
*/

interface KoalaRule {
  name: string;
  prefix: string;
  amount: number;
  default: number;
  romAddress: number;
  ramAddress: number;
  body: string[];
}

interface Instruction {
  code: number;
  arguments: number;
}

interface KoalaRuntimeResult {
  width: number;
  height: number;
  rules: KoalaRuleDict;
  runtime: KoalaRuntime;
}

type KoalaValue = {[rule: string]: number[]}
type KoalaRuleDict = {[name: string]: KoalaRule}
type KoalaRuntime = (readback: boolean) => Int32Array;

/**
 * 32 bit register design:
 *
 * 00 00 00 00
 * CC CC MM II
 *
 * I: opCode:   instructionLookupTable
 * M: maskCode: registersLookupTable + constantsLookupTable
 * C: constants if needed
 *
 */
const instructionLookupTable: {[mnemonic: string]: Instruction} = {
  "end":  {code: 0x00, arguments: 0},
  "set":  {code: 0x01, arguments: 2},
  "getr": {code: 0x02, arguments: 2},
  "getg": {code: 0x03, arguments: 2},
  "getb": {code: 0x04, arguments: 2},

  // maths
  "add": {code: 0x10, arguments: 2},
  "sub": {code: 0x11, arguments: 2},
  "mul": {code: 0x12, arguments: 2},
  "div": {code: 0x13, arguments: 2},
  "mod": {code: 0x14, arguments: 2},
  "and": {code: 0x15, arguments: 2},
  "or":  {code: 0x16, arguments: 2},
  "nil": {code: 0x17, arguments: 2},
  "gt":  {code: 0x18, arguments: 2},
  "lt":  {code: 0x19, arguments: 2},
  "egt": {code: 0x1a, arguments: 2},
  "elt": {code: 0x1b, arguments: 2},
  "not": {code: 0x1C, arguments: 2},
  "pow": {code: 0x1D, arguments: 2},
  "eq":  {code: 0x1E, arguments: 2},
  "neq": {code: 0x1F, arguments: 2},
};

// Read & Write
const registersLookupTable: {[name: string]: number} = {
  "__CONST": 0,
  // 0 = Constant value
  "R": 1,
  "G": 2,
  "B": 3,
  "A": 4,
};

// Read only
const constantsLookupTable: {[name: string]: number} = {
  "ID": 5,
  "OFFSET": 6,
  "FRAME": 7,
  "RAND": 8,
  "__BUF_0": 9,
  "__BUF_1": 10,
  "__BUF_2": 11,
  "__BUF_3": 12,
};


const vs = `#version 300 es
in vec4 position;
void main() {
  gl_Position = position;
}
`;

const fsRender = `#version 300 es
precision highp float;
precision highp isampler2D;

uniform isampler2D ramTex;

out vec4 outColor;

void main() {
  ivec4 color = texelFetch(ramTex, ivec2(gl_FragCoord.xy), 0);
  outColor = vec4(color) / 255.0;
}
`;

const fs = `#version 300 es
precision highp float;
precision highp isampler2D;
 
uniform isampler2D ramTex;
uniform isampler2D mapTex;
uniform isampler2D romTex;

uniform ivec2 size;
uniform int frame;
 
out ivec4 outColor;

#define MAX_INSTR 100

${Object.keys(instructionLookupTable).map((mnemonic) => {
  return "#define " + mnemonic.toUpperCase() + " " + instructionLookupTable[mnemonic].code;
}).join("\n")}

int readOpCode(int PC) {
  return texelFetch(romTex, ivec2(PC, 0), 0).x;
}

ivec4 readRam(int idx) {
  return texelFetch(ramTex, ivec2(idx % size.x, idx / size.x), 0);
}

uint hash( uint x ) {
    x += ( x << 10u );
    x ^= ( x >>  6u );
    x += ( x <<  3u );
    x ^= ( x >> 11u );
    x += ( x << 15u );
    return x;
}

uint hash( uvec2 v ) { return hash(v.x ^ hash(v.y)); }

#define ARG0 (mask0 != 0 ? lookup[mask0] : const0)
#define ARG1 (mask1 != 0 ? lookup[mask1] : const1)
 
void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);
  ivec4 ramValue = texelFetch(ramTex, pos, 0); 
  ivec4 mapValue = texelFetch(mapTex, pos, 0); 

  int ID = pos.x + pos.y * size.x;
  int PROG_START = ramValue.a;//mapValue.x;

  int lookup[16] = int[16](
    0,          // Constant
    ramValue.r, // R
    ramValue.g, // G
    ramValue.b, // B
    ramValue.a, // A
    ID,         // ID
    mapValue.g, // OFFSET
    frame,      // FRAME
    0,          // RAND
    0,          // 0
    0,          // 1
    0,          // 2
    0,          // 3
    0,          // 4
    0,          // 5
    0           // 6
  ); 

  for (int PC = PROG_START; PC < PROG_START + MAX_INSTR; PC++) {
    int code = readOpCode(PC);
    int ins = code & 0xFF;
    int mask0 = (code >> 8) & 0x0F;
    int mask1 = (code >> 12) & 0x0F;
    int const0 = (code >> 16) & 0xFF;
    int const1 = (code >> 24) & 0xFF;

    // Update rand value
    lookup[8] = int(hash(uvec2(pos + frame * 1000 + PC * 1000)));

    switch (ins) {
    case END:
      PC = PROG_START + MAX_INSTR;
      break;
    case SET:
      lookup[mask0] = ARG1;
      break;
    case GETR:
      lookup[mask0] = readRam(ARG1).r;
      break;
    case GETG:
      lookup[mask0] = readRam(ARG1).g;
      break;
    case GETB:
      lookup[mask0] = readRam(ARG1).b;
      break;

    // maths
    case ADD:
      lookup[mask0] += ARG1;
      break;
    case SUB:
      lookup[mask0] -= ARG1;
      break;
    case MUL:
      lookup[mask0] *= ARG1;
      break;
    case DIV:
      lookup[mask0] /= ARG1;
      break;
    case MOD:
      lookup[mask0] %= ARG1;
      break;
    case AND:
      lookup[mask0] &= ARG1;
      break;
    case OR:
      lookup[mask0] |= ARG1;
      break;
    case NIL:
      lookup[mask0] = ARG0 == 0 ? ARG1 : ARG0;
      break;
    case GT:
      lookup[mask0] = ARG0 > ARG1 ? 1 : 0;
      break;
    case LT:
      lookup[mask0] = ARG0 < ARG1 ? 1 : 0;
      break;
    case EGT:
      lookup[mask0] = ARG0 >= ARG1 ? 1 : 0;
      break;
    case ELT:
      lookup[mask0] = ARG0 <= ARG1 ? 1 : 0;
      break;
    case NOT:
      lookup[mask0] = ARG1 == 0 ? 1 : 0;
      break;
    case POW:
      lookup[mask0] = int(pow(float(ARG0), float(ARG1)));
      break;
    case EQ:
      lookup[mask0] = ARG0 == ARG1 ? 1 : 0;
      break;
    case NEQ:
      lookup[mask0] = ARG0 != ARG1 ? 1 : 0;
      break;
    }
  }

  outColor = ivec4(lookup[1], lookup[2], lookup[3], lookup[4]);
}
`;


function createShader(gl: WebGLRenderingContext, sourceCode: string, type: number): WebGLShader {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    throw `Could not compile WebGL program. \n\n${info}`;
  }
  return shader;
}


function createTexture(gl: WebGL2RenderingContext, data: number[], width: number, height: number, internalFormat: GLint, format: GLenum): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,                // mip level
    internalFormat,
    width,
    height,
    0,                // border
    format,
    gl.INT,           // type
    new Int32Array(data),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

function createFramebuffer(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return fb;
}


function isValidName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_#]*$/.test(name);
}

declare global {
    interface Window { getOpCode: any; getOpCodes: any; }
}

window.getOpCodes = function(codes: number[]) {
  return codes.map(window.getOpCode);
}

window.getOpCode = function(code: number) {
  const mnemonic = code & 0xFF;
  const arg0 = {
    mask: (code >> 8) & 0x0F,
    constant: (code >> 16) & 0xFF,
  };
  const arg1 = {
    mask: (code >> 12) & 0x0F,
    constant: (code >> 24) & 0xFF,
  };

  // find name (key) of instructionLookupTable by mnemonic
  const name = Object.keys(instructionLookupTable).find((key) => instructionLookupTable[key].code === mnemonic);

  const val0 = arg0.mask == 0 ? arg0.constant : 
    Object.keys(registersLookupTable).find((key) => registersLookupTable[key] === arg0.mask) || 
    Object.keys(constantsLookupTable).find((key) => constantsLookupTable[key] === arg0.mask) ||
    "$" + arg0.mask;

  const val1 = arg1.mask == 0 ? arg1.constant : 
    Object.keys(registersLookupTable).find((key) => registersLookupTable[key] === arg1.mask) || 
    Object.keys(constantsLookupTable).find((key) => constantsLookupTable[key] === arg1.mask) ||
    "$" + arg1.mask;

  console.log(name + " " + val0 + " " + val1);
}


export default class Koala {
  private loadShader(gl: WebGLRenderingContext, vertShader: string, fragShader: string) {
    // Create shader program
    const pid = gl.createProgram();

    // Compile vertex shader
    const vert = createShader(gl, vertShader, gl.VERTEX_SHADER);
    gl.attachShader(pid, vert);

    // Compile fragment shader
    const frag = createShader(gl, fragShader, gl.FRAGMENT_SHADER);
    gl.attachShader(pid, frag);
    gl.linkProgram(pid);
    gl.useProgram(pid);

    return pid;
  }

  /*public cleanup() {
    this.gl.deleteProgram(this.pid);
    this.gl.deleteShader(this.vert);
    this.gl.deleteShader(this.frag);
  }*/

  private extractRules(code: string): KoalaRuleDict {
    const rules: {[name: string]: KoalaRule} = {};

    let name: string = null;
    let instructions: string[] = [];

    const updateBody = () => {
      if (name && rules[name]) {
        rules[name].body = instructions;
        instructions = [];
      }
    }

    code.split('\n').forEach((line) => {
      line = line.split(';')[0].trim(); // remove comments

      // skip empty lines
      if (!line || line.length === 0)
        return;

      // search for rule definition
      const match = line.match(/^([\w|#]+)(?:\s*(?:\((\d+)\))?(?:\s*=\s*(\d+))?)?:$/);

      if (match) {
        updateBody();
        const data = match[1].split('#');
        const prefix = data.length == 2 ? data[0] : "";

        name = data.length == 2 ? data[1] : data[0];

        if (!isValidName(match[1]))
          throw `Invalid rule name ${match[1]}`;

        if (rules[name])
          throw `Duplicate rule name ${name}`;

        rules[name] = {
          name: name,
          prefix: prefix,
          amount: match[2] ? parseInt(match[2]) : 0,
          default: match[3] ? parseInt(match[3]) : 0,

          // unknown at this point
          romAddress: 0,
          ramAddress: 0,
          body: [],
        };
      } else {
        instructions.push(line);
      }
    });

    updateBody();

    return rules;
  }

  private parseToken(token: string, dict: KoalaRuleDict, vars: {[name: string]: number} = {}): [number, number] {
    if (vars[token]) {
      return [vars[token], 0];
    }

    if (token[0] == '$' && dict[token.substring(1)]) {
      return [0, dict[token.substring(1)].romAddress];
    }


    if (dict[token]) {
      return [0, dict[token].ramAddress / 4];
    }

    if (registersLookupTable[token]) {
      return [registersLookupTable[token], 0];
    }

    if (constantsLookupTable[token]) {
      return [constantsLookupTable[token], 0];
    }

    const constant = parseInt(token);
    if (!isNaN(constant)) {
      return [0, constant];
    }

    throw `Unknown token ${token}`;
  }

  private getOpCode(mnemonic: string, arg0: {mask: number, constant?: number}, arg1: {mask: number, constant?: number}): number {
    mnemonic = mnemonic.toLowerCase();

    if (!instructionLookupTable[mnemonic])
      throw `Unknown instruction ${mnemonic}`;

    return instructionLookupTable[mnemonic].code
      | (arg0.mask << 8)
      | (arg1.mask << 12)
      | (arg0.constant << 16)
      | (arg1.constant << 24);
  }

  private parseExpressionTree(tokens: string[], dict: KoalaRuleDict, vars: {[name: string]: number} = {}, start = 0, depth = 0): [number, number[]] {
    let data = [];
    let sign = "set";

    // if it starts with a + or - we add a 0 to reset the buffers to zero
    if (tokens[0] == '+' || tokens[0] == '-') {
      tokens = [ '0', ...tokens ];
    }

    // we check if we have two operands following each other
    const allOperants  = [ '+',   '-',   '*',   '/',   '%',   '&',   '|',  '??',  '>',  '<',  '>=',  '<=',  '!',   '^',   '==', '!='  ];
    const allMnemonics = [ 'add', 'sub', 'mul', 'div', 'mod', 'and', 'or', 'nil', 'gt', 'lt', 'egt', 'elt', 'not', 'pow', 'eq', 'neq' ];

    for (let i = start + 1; i < tokens.length; i++)
      if (allOperants.includes(tokens[i]) && allOperants.includes(tokens[i + 1]))
        throw `Invalid expression ${tokens.join(' ')}`;

    for (let i = start; i < tokens.length; i++) {

      if (tokens[i] == '(') {
        const [end, value] = this.parseExpressionTree(tokens, dict, vars, i + 1, depth + 1);
        i = end;
        data = data.concat(value);

        const mask0 = constantsLookupTable["__BUF_0"] + depth;
        const mask1 = constantsLookupTable["__BUF_0"] + depth + 1;

        data.push(this.getOpCode(sign, {mask: mask0}, {mask: mask1}));

        continue;
      }

      if (i < tokens.length - 1 && tokens[i + 1] == '(' && registersLookupTable[tokens[i]]) {
        const [end, value] = this.parseExpressionTree(tokens, dict, vars, i + 2, depth + 1);
        data = data.concat(value);

        const mask0 = constantsLookupTable["__BUF_0"] + depth;
        const mask1 = constantsLookupTable["__BUF_0"] + depth + 1;

        data.push(this.getOpCode("GET" + tokens[i], {mask: mask1}, {mask: mask1}));
        data.push(this.getOpCode(sign, {mask: mask0}, {mask: mask1}));
        
        i = end;
        continue;
      }

      if (tokens[i] == ')') {
        return [i, data];
      }

      if (allOperants.includes(tokens[i])) {
        sign = allMnemonics[allOperants.indexOf(tokens[i])];
      } else {
        const mask0 = constantsLookupTable["__BUF_0"] + depth;
        const [mask1, constant] = this.parseToken(tokens[i], dict, vars);

        data.push(this.getOpCode(sign, {mask: mask0}, {mask: mask1, constant: constant}));
      }
    }

    return [tokens.length, data];
  }

  private buildRule(rule: KoalaRule, dict: KoalaRuleDict): number[] {

    const variableTable = {};
    const variableStart = Object.keys(registersLookupTable).length + Object.keys(constantsLookupTable).length;
    const variableMaxSize = 15;

    return rule.body.map((line) => {

      // Do assignments
      {
        const tokens = line.split(/=(.+)/, 2).filter(Boolean).map((t) => t.trim());

        if (tokens.length <= 2) {
          const name = tokens.shift();

          if (!isValidName(name))
            throw `Invalid variable name ${name}`;

          if (constantsLookupTable[name])
            throw `Cannot name variable after constant ${name}`;

          const mask0: number = variableTable[name]
            || registersLookupTable[name]
            || (variableTable[name] = variableStart + Object.keys(variableTable).length);

          if (mask0 >= variableStart + variableMaxSize)
            throw `Too many variables`;

          const tokens1 = tokens[0].split(/\s+|(>=)|(<=)|(==)|(!=)|(\?\?)|([%?!|&=+\-*\/^()])/).filter(Boolean);
          console.log(tokens1);

          // if its a simple assignment (e.g.: x = y), we optimize it by not using a buffer variable
          if (tokens1.length == 1) {
            const [mask1, constant] = this.parseToken(tokens1[0], dict, variableTable);

            return [ this.getOpCode("set", { mask: mask0 }, { mask: mask1, constant }) ];
          } else {
            const data = this.parseExpressionTree(tokens1, dict, variableTable)[1];
            
            return [ ...data, this.getOpCode("set", { mask: mask0 }, { mask: constantsLookupTable["__BUF_0"] }) ];
          }
        }
      }

      // Do classic assembly instruction
      {
        const tokens = line.split(' ');
        const name = tokens[0].toLowerCase();

        if (!instructionLookupTable[name])
          throw `Unknown instruction ${name}`;

        if (instructionLookupTable[name].arguments !== tokens.length - 1)
          throw `Wrong number of arguments for instruction ${name}`;

        let opCode = instructionLookupTable[name].code;

        for (let i = 1; i < tokens.length; i++) {
          const [mask, constant] = this.parseToken(tokens[i], dict);
          opCode |= mask << (i * 4 + 4);
          opCode |= constant << (i * 8 + 8);
        }

        return [opCode];
      }
    }).flat();
  }

  public compile(code: string): KoalaRuntimeResult {
    const rules = this.extractRules(code);

    let ramData = [];
    let romData = [];
    let mapData = [];

    // Run twice to get rule start address for second pass
    for (let j = 0; j < 2; ++j) {
      ramData = [];
      romData = [];
      mapData = [];

      for (let name in rules) {

        // Set the address in rom for the rule assembly code and start of ram address
        rules[name].romAddress = romData.length + 1;
        rules[name].ramAddress = ramData.length;

        for (let i = 0; i < rules[name].amount; i++) {
          mapData = mapData.concat([/*rules[name].romAddress*/ 0, i, 0, 0]);
          ramData = ramData.concat([rules[name].default, 0, 0, rules[name].romAddress]);
        }

        romData.push(0); // end of rule, each rule is separated by a zero
        romData.push(...this.buildRule(rules[name], rules));
      }

      // End of instructions
      romData.push(0);
    }

    const memWidth = Math.ceil(Math.sqrt(mapData.length / 4));
    const memHeight = Math.ceil(mapData.length / 4 / memWidth);

    // Resize mapdata to fill the missing width * height with 0
    if (mapData.length < memWidth * memHeight * 4)
      mapData = mapData.concat(Array(memWidth * memHeight * 4 - mapData.length).fill(0));

    if (ramData.length < memWidth * memHeight * 4)
      ramData = ramData.concat(Array(memWidth * memHeight * 4 - ramData.length).fill(0));

    console.log(memWidth + "x" + memHeight);
    console.log("MAP", mapData);
    console.log("ROM", romData);
    console.log("RAM", ramData);

    // make a 3x2 canvas for 6 results
    const canvas = document.createElement('canvas');
    canvas.width = memWidth;
    canvas.height = memHeight;

    const gl = canvas.getContext('webgl2');

    const program = this.loadShader(gl, vs, fs);
    const positionLoc = gl.getAttribLocation(program, 'position');
    const ramTexLoc = gl.getUniformLocation(program, 'ramTex');
    const romTexLoc = gl.getUniformLocation(program, 'romTex');
    const mapTexLoc = gl.getUniformLocation(program, 'mapTex');
    const sizeLoc = gl.getUniformLocation(program, 'size');
    const frameLoc = gl.getUniformLocation(program, 'frame');

    // setup a full canvas clip space quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,]), gl.STATIC_DRAW);

    // Create a vertex array object (attribute state)
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // setup our attributes to tell WebGL how to pull
    // the data from the buffer above to the position attribute
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(
      positionLoc,
      2,         // size (num components)
      gl.FLOAT,  // type of data in buffer
      false,     // normalize
      0,         // stride (0 = auto)
      0,         // offset
    );

    const texROM = createTexture(gl, romData, romData.length, 1, gl.R32I, gl.RED_INTEGER);
    const texMap = createTexture(gl, mapData, memWidth, memHeight, gl.RGBA32I, gl.RGBA_INTEGER);
    const ramTex1 = createTexture(gl, ramData, memWidth, memHeight, gl.RGBA32I, gl.RGBA_INTEGER);
    const ramTex2 = createTexture(gl, ramData, memWidth, memHeight, gl.RGBA32I, gl.RGBA_INTEGER);
    const fb1 = createFramebuffer(gl, ramTex1);
    const fb2 = createFramebuffer(gl, ramTex2);

    let oldInfo = {fb: fb1, tex: ramTex1};
    let newInfo = {fb: fb2, tex: ramTex2};

    const results = new Int32Array(memWidth * memHeight * 4);

    let frame = 0;

    return {
      width: memWidth,
      height: memHeight,
      rules: rules,
      runtime: function (readback: boolean): Int32Array {

        // framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, newInfo.fb);
        gl.viewport(0, 0, memWidth, memHeight);


        gl.bindVertexArray(vao);

        // Bind textures: RAM, MAP, ROM
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, oldInfo.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texMap);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, texROM);


        gl.useProgram(program);

        // tell the shader the location of each texture
        gl.uniform1i(ramTexLoc, 0);
        gl.uniform1i(mapTexLoc, 1);
        gl.uniform1i(romTexLoc, 2);
        gl.uniform2i(sizeLoc, memWidth, memHeight);
        gl.uniform1i(frameLoc, frame++);

        gl.drawArrays(gl.TRIANGLES, 0, 6);  // draw 2 triangles (6 vertices)

        // get the result
        if (readback)
          gl.readPixels(0, 0, memWidth, memHeight, gl.RGBA_INTEGER, gl.INT, results);

        //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Swap
        {
          const tmp = oldInfo;
          oldInfo = newInfo;
          newInfo = tmp;
        }

        return results;
      },
    }
  }
}
