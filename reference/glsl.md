# GLSL in TouchDesigner Reference

## Overview

TouchDesigner supports GLSL shaders through three operator types:

| Operator | Purpose | Shader Stage |
|----------|---------|--------------|
| **GLSL TOP** | Image processing, generative visuals | Fragment shader runs per-pixel |
| **GLSL MAT** | Custom 3D materials on geometry | Vertex + fragment for lighting/shading |
| **POP shaders** | Particle compute | Compute-style particle simulation |

All shaders use GLSL 3.30+ syntax. TouchDesigner provides built-in uniforms, functions, and input/output conventions that wrap standard GLSL.

---

## GLSL TOP

The primary operator for image processing and generative visuals. The fragment shader executes once per output pixel.

### Creating via Python

```python
glsl = base.create(glslTOP, 'shader1')
# Set resolution
glsl.par.resolutionw = 1920
glsl.par.resolutionh = 1080
# Connect input textures
texture_top.outputConnectors[0].connect(glsl.inputConnectors[0])
```

### Vertex Shader (Default)

In most GLSL TOP use cases, the vertex shader can be left at its default. If customizing:

```glsl
out Vertex {
    vec4 color;
    vec2 texCoord0;
} oVert;

void main() {
    oVert.color = TDInstanceColor(Cd);
    oVert.texCoord0 = uv[0].st;
    gl_Position = TDWorldToProj(TDDeform(P));
}
```

### Fragment Shader Template

```glsl
// Access input textures
uniform sampler2D sTD2DInputs[1]; // array sized to number of connected inputs

out vec4 fragColor;

void main() {
    vec2 uv = vUV.st;
    vec4 color = texture(sTD2DInputs[0], uv);
    fragColor = TDOutputSwizzle(color);
}
```

**Key rules:**
- Always wrap final color output with `TDOutputSwizzle()`.
- `vUV.st` provides normalized UV coordinates (0 to 1).
- Input textures are indexed by connector order: `sTD2DInputs[0]`, `sTD2DInputs[1]`, etc.

---

## Uniforms

### Built-in TD Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `uTDGeneral.time` | `float` | Current time in seconds |
| `uTDGeneral.timeDelta` | `float` | Frame delta time |
| `uTDGeneral.frame` | `float` | Current frame number |
| `uTDGeneral.resolution` | `vec2` | Output resolution (width, height) |
| `uTDGeneral.aspectRatio` | `float` | Output aspect ratio |

### Texture Input Uniforms

| Uniform | Description |
|---------|-------------|
| `uniform sampler2D sTD2DInputs[N]` | 2D input textures (N = number of inputs) |
| `uniform sampler2DArray sTDArrayInputs[N]` | Array texture inputs |

### Custom Uniforms via Parameters

Custom parameters added to a GLSL TOP automatically become uniforms. The parameter name becomes the uniform name.

```python
# In TD, add custom parameters to the GLSL TOP:
# Float par "Speed"  -> uniform float Speed;
# XY par "Center"    -> uniform vec2 Center;
# RGB par "Tint"     -> uniform vec3 Tint;
# RGBA par "Color"   -> uniform vec4 Color;
# Int par "Steps"    -> uniform int Steps;
# Toggle par "Enable" -> uniform int Enable; (0 or 1)
```

Access them in GLSL directly by name:

```glsl
uniform float Speed;
uniform vec2 Center;
uniform vec3 Tint;

void main() {
    vec2 uv = vUV.st;
    float t = uTDGeneral.time * Speed;
    vec4 color = vec4(Tint, 1.0);
    fragColor = TDOutputSwizzle(color);
}
```

---

## Built-in Functions

### TD-Specific Functions

| Function | Description |
|----------|-------------|
| `TDOutputSwizzle(vec4 color)` | Required wrapper for fragment output. Handles channel swizzling. |
| `TDDeform(vec4 pos)` | Apply TD deformations to vertex position |
| `TDWorldToProj(vec4 pos)` | Transform from world space to projection space |
| `TDInstanceColor(vec4 color)` | Get instance color |
| `TDInstanceTexCoord(vec3 t)` | Get instance texture coordinate |
| `TDColor(vec4 color)` | Apply TD color transforms |
| `TDLighting(...)` | Built-in lighting calculations (GLSL MAT) |

### TD Noise Functions

| Function | Description |
|----------|-------------|
| `TDPerlinNoise(vec3 p)` | 3D Perlin noise, returns float |
| `TDSimplexNoise(vec3 p)` | 3D Simplex noise, returns float |
| `TDRandom(vec2 p)` | Pseudo-random hash based on 2D input |

### Standard GLSL Functions

**Interpolation and clamping:**
- `mix(a, b, t)` -- linear interpolation between a and b
- `clamp(x, min, max)` -- clamp x to range
- `smoothstep(edge0, edge1, x)` -- Hermite interpolation
- `step(edge, x)` -- 0.0 if x < edge, else 1.0

**Vector math:**
- `length(v)` -- vector magnitude
- `distance(a, b)` -- distance between two points
- `normalize(v)` -- unit vector
- `dot(a, b)` -- dot product
- `cross(a, b)` -- cross product (vec3)
- `reflect(I, N)` -- reflection vector
- `refract(I, N, eta)` -- refraction vector

**Trigonometry:**
- `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- `radians(degrees)`, `degrees(radians)`

**Math:**
- `pow(x, y)`, `exp(x)`, `log(x)`, `sqrt(x)`
- `abs(x)`, `sign(x)`, `floor(x)`, `ceil(x)`, `fract(x)`, `mod(x, y)`
- `min(a, b)`, `max(a, b)`

**Matrix types and operations:**
- Types: `mat2`, `mat3`, `mat4`
- Functions: `inverse(m)`, `transpose(m)`

**Texture sampling:**
- `texture(sampler, uv)` -- filtered texture lookup
- `texelFetch(sampler, ivec2, lod)` -- exact pixel access, no filtering
- `textureSize(sampler, lod)` -- returns ivec2 dimensions

---

## GLSL MAT (Material Shader)

For custom 3D materials applied to geometry. Provides full control over vertex transformation and pixel lighting.

### Creating via Python

```python
mat = base.create(glslMAT, 'customMat1')
# Vertex and pixel shaders set via parameters
```

### Vertex Shader

Has access to geometry attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `P` | `vec3` | Position |
| `N` | `vec3` | Normal |
| `Cd` | `vec4` | Color |
| `uv[0]` | `vec3` | Texture coordinates |

### Fragment Shader

Must output final lighting/color. Use TD lighting functions for PBR-compatible results, or compute lighting manually.

---

## Common Patterns

### Feedback Loop (GLSL TOP)

Wire a Feedback TOP into input 0 and the new source into input 1:

```glsl
uniform sampler2D sTD2DInputs[2]; // [0] = feedback, [1] = new input

out vec4 fragColor;

void main() {
    vec2 uv = vUV.st;
    vec4 prev = texture(sTD2DInputs[0], uv);
    vec4 curr = texture(sTD2DInputs[1], uv);
    fragColor = TDOutputSwizzle(mix(prev, curr, 0.1));
}
```

### SDF Primitives (Signed Distance Fields)

```glsl
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// SDF operations
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(-d1, d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}
```

### UV Manipulation

```glsl
vec2 uv = vUV.st;

// Center UVs to -1..1 range
uv = uv * 2.0 - 1.0;

// Correct aspect ratio
uv.x *= uTDGeneral.aspectRatio;

// Rotate by angle a
float a = uTDGeneral.time;
uv *= mat2(cos(a), -sin(a), sin(a), cos(a));

// Scale
uv *= 2.0;

// Back to 0..1 range (if needed for texture lookup)
vec2 texUV = uv * 0.5 + 0.5;
```

### Raymarching Template

```glsl
out vec4 fragColor;

float map(vec3 p) {
    // Define your SDF scene here
    return sdSphere(p, 1.0);
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

void main() {
    vec2 uv = vUV.st * 2.0 - 1.0;
    uv.x *= uTDGeneral.aspectRatio;

    vec3 ro = vec3(0.0, 0.0, -3.0); // ray origin
    vec3 rd = normalize(vec3(uv, 1.0)); // ray direction

    float t = 0.0;
    for (int i = 0; i < 128; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        t += d;
        if (t > 100.0) break;
    }

    vec3 color = vec3(0.0);
    if (t < 100.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 light = normalize(vec3(1.0, 1.0, -1.0));
        color = vec3(max(dot(n, light), 0.0));
    }

    fragColor = TDOutputSwizzle(vec4(color, 1.0));
}
```

### Multi-Pass / Multi-Output

GLSL TOPs support multiple color buffers for outputting several textures in one pass:

```glsl
layout(location = 0) out vec4 fragColor0; // output buffer 0
layout(location = 1) out vec4 fragColor1; // output buffer 1

void main() {
    vec2 uv = vUV.st;
    fragColor0 = TDOutputSwizzle(vec4(uv, 0.0, 1.0)); // color
    fragColor1 = TDOutputSwizzle(vec4(length(uv), 0.0, 0.0, 1.0)); // data
}
```

Set the number of output buffers on the GLSL TOP's "Output" parameter page.

---

## Performance Tips

- **Minimize texture lookups.** Each `texture()` call has latency. Cache results in local variables if sampling the same location multiple times.
- **Use `texelFetch` for exact pixel access.** Avoids filtering overhead when you need precise pixel values.
- **Prefer `mix` over branching.** GPU pipelines stall on `if/else`; branchless math with `mix`, `step`, and `smoothstep` is faster.
- **Use `const` for compile-time constants.** The compiler can optimize these away.
- **Reduce precision where possible.** Use `mediump` or `lowp` qualifiers for variables that do not need full precision.
- **Avoid redundant normalize calls.** Only normalize vectors that have actually changed length.
- **Keep loop counts low and fixed.** Dynamic loop bounds are slower; use `#define` constants for iteration counts.
- **Profile with the GPU monitor.** TouchDesigner's performance monitor shows per-operator GPU time.
