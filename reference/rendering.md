# TouchDesigner Rendering Reference

Reference for building 3D scenes in TouchDesigner programmatically. Covers the rendering pipeline, cameras, lights, materials, geometry, instancing, and complete examples.

---

## 1. Rendering Pipeline Overview

TouchDesigner's 3D rendering pipeline has four core components:

```
Geometry COMP  -->  Camera COMP  -->  Render TOP
                    Light COMP  ----^
```

- **Geometry COMP** contains SOPs (Surface Operators) that define 3D shapes. SOPs live *inside* the Geometry COMP.
- **Camera COMP** defines the viewpoint: position, rotation, projection, field of view.
- **Light COMP** illuminates the scene: point lights, spotlights, directional lights.
- **Render TOP** combines everything into a 2D image. It references which geometry, camera, and lights to use.

A minimal scene requires at least one of each. The Render TOP pulls geometry, camera, and light references together and outputs a 2D texture.

---

## 2. Camera COMP Setup

```python
cam = base.create(cameraCOMP, 'cam1')

# Position
cam.par.tx = 0      # translate X
cam.par.ty = 1      # translate Y
cam.par.tz = 5      # translate Z

# Rotation (Euler angles in degrees)
cam.par.rx = -10     # rotate X (pitch)
cam.par.ry = 0       # rotate Y (yaw)
cam.par.rz = 0       # rotate Z (roll)

# Look-at targeting (optional, overrides rotation)
cam.par.lookat = '/project1/target_null'

# Projection
cam.par.projection = 'perspective'   # 'perspective' or 'orthographic'
cam.par.fov = 45                     # field of view in degrees (perspective mode)
cam.par.orthowidth = 5               # orthographic width (orthographic mode)

# Clipping planes
cam.par.near = 0.1
cam.par.far = 100
```

### Key Camera Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `tx`, `ty`, `tz` | Position in world space | 0, 0, 5 |
| `rx`, `ry`, `rz` | Rotation (degrees) | 0, 0, 0 |
| `lookat` | Path to target operator (overrides rotation) | (empty) |
| `projection` | `'perspective'` or `'orthographic'` | `'perspective'` |
| `fov` | Field of view in degrees | 45 |
| `near` | Near clipping plane | 0.1 |
| `far` | Far clipping plane | 100 |

---

## 3. Light COMP Setup

```python
light = base.create(lightCOMP, 'light1')

# Light type
light.par.lighttype = 'cone'     # 'point', 'distant', or 'cone'

# Intensity
light.par.dimmer = 1.0           # overall brightness multiplier

# Position
light.par.tx = 2
light.par.ty = 3
light.par.tz = 2

# Color
light.par.cr = 1.0
light.par.cg = 1.0
light.par.cb = 1.0

# Cone (spot) light specific
light.par.coneangle = 30         # cone angle in degrees
light.par.conedelta = 5          # soft edge width

# Attenuation (enable distance-based falloff)
light.par.attenuated = True      # enable attenuation
light.par.attenuationstart = 1.0 # distance where falloff begins
light.par.attenuationend = 10.0  # distance where light reaches zero
light.par.attenuationexp = 2.0   # falloff curve exponent

# Shadows
light.par.shadowtype = 'soft2d'  # 'off', 'hard2d', 'soft2d', 'custom'
light.par.shadowresolution1 = 1024  # shadow map width
light.par.shadowresolution2 = 1024  # shadow map height
```

### Light Types

| Type | Value | Description |
|------|-------|-------------|
| Point | `'point'` | Emits in all directions from a point |
| Directional | `'distant'` | Parallel rays, like sunlight. Position is ignored, only rotation matters. |
| Cone (Spot) | `'cone'` | Emits in a cone shape. Use `coneangle` and `conedelta` to control spread. |

---

## 4. Material Setup (MATs)

Materials control how surfaces appear when rendered. The three most common material types:

| Type | Operator | Best For |
|------|----------|----------|
| PBR | `pbrMAT` | Physically-based rendering, realistic surfaces |
| Phong | `phongMAT` | Classic lighting model, lighter weight |
| Constant | `constantMAT` | Flat/unlit color, UI elements, no lighting needed |

### PBR Material

```python
mat = base.create(pbrMAT, 'pbr_mat1')

# Base color (albedo)
mat.par.basecolorr = 0.8
mat.par.basecolorg = 0.2
mat.par.basecolorb = 0.1

# Surface properties
mat.par.metallic = 0.0           # 0 = dielectric, 1 = metal
mat.par.roughness = 0.5          # 0 = mirror, 1 = rough
mat.par.emitr = 0.0              # emission color
mat.par.emitg = 0.0
mat.par.emitb = 0.0

# Texture maps (reference TOP operators)
mat.par.basecolormap = '/project1/texture1'
mat.par.normalmap = '/project1/normal1'
mat.par.roughnessmap = '/project1/roughness1'
```

### Phong Material

```python
mat = base.create(phongMAT, 'phong_mat1')

# Diffuse color
mat.par.diffr = 0.8
mat.par.diffg = 0.2
mat.par.diffb = 0.1

# Specular
mat.par.specr = 1.0
mat.par.specg = 1.0
mat.par.specb = 1.0
mat.par.shininess = 50

# Texture map
mat.par.colormap = '/project1/texture1'
```

### Constant Material

```python
mat = base.create(constantMAT, 'const_mat1')

# Flat color (ignores lighting)
mat.par.colorr = 1.0
mat.par.colorg = 0.5
mat.par.colorb = 0.0
mat.par.alpha = 1.0

# Texture map
mat.par.colormap = '/project1/texture1'
```

### Assigning a Material to Geometry

```python
geo.par.material = mat           # assign by operator reference
# or
geo.par.material = mat.path      # assign by path string
```

The material parameter is on the Geometry COMP, not on individual SOPs.

---

## 5. Render TOP

The Render TOP is the final stage that rasterizes the 3D scene into a 2D image.

```python
render = base.create(renderTOP, 'render1')

# Assign scene components
render.par.camera = cam          # camera COMP reference or path
render.par.geometry = geo        # geometry COMP reference or path
render.par.lights = light        # light COMP reference or path (note: plural 'lights')

# Resolution
render.par.resolutionw = 1920
render.par.resolutionh = 1080

# Anti-aliasing (menu values, not integers)
render.par.antialias = 'aa8mid'  # 'aa1', 'aa2', 'aa4', 'aa8mid', 'aa8high', 'aa16low', etc.

# Background color is set on the CAMERA, not Render TOP
cam.par.bgcolorr = 0.0
cam.par.bgcolorg = 0.0
cam.par.bgcolorb = 0.0
cam.par.bgcolora = 0.0           # 0 = transparent background
```

### Pattern Matching

The `geometry` and `light` parameters support wildcard patterns to include multiple operators:

```python
# Render all geometry COMPs whose names start with "geo"
render.par.geometry = 'geo*'

# Render specific geometries (space-separated)
render.par.geometry = 'geo1 geo2 geo3'

# All lights
render.par.lights = 'light*'
```

Wildcard matching is relative to the Render TOP's parent. If the Render TOP is inside `/project1/base1/`, then `'geo*'` matches `/project1/base1/geo1`, etc.

### Key Render TOP Parameters

| Parameter | Description |
|-----------|-------------|
| `camera` | Camera COMP to render from |
| `geometry` | Geometry COMP(s) to render (supports wildcards) |
| `lights` | Light COMP(s) to use (supports wildcards) |
| `resolutionw`, `resolutionh` | Output resolution |
| `antialias` | Anti-alias mode: `'aa1'`, `'aa2'`, `'aa4'`, `'aa8mid'`, `'aa8high'`, `'aa16low'`, etc. |

Note: Background color (`bgcolorr/g/b/a`) is set on the **Camera COMP**, not the Render TOP.

---

## 6. Geometry COMP (CRITICAL - Common Mistakes)

This is the most important section. The Geometry COMP in TouchDesigner works differently than you might expect. SOPs (surface operators) that define 3D shapes must be created **inside** the Geometry COMP, not connected to it externally.

### Correct Pattern

```python
# Create the Geometry COMP
geo = base.create(geometryCOMP, 'geo1')

# Create SOPs INSIDE the Geometry COMP
sphere = geo.create(sphereSOP, 'sphere1')
sphere.par.rad = 0.5             # set radius on all axes
sphere.par.radx = 0.5            # or set individually
sphere.par.rady = 0.5
sphere.par.radz = 0.5

# Always end with a Null SOP for clean output
null = geo.create(nullSOP, 'out1')
null.inputConnectors[0].connect(sphere.outputConnectors[0])

# Set render and display flags on the final SOP
null.render = True
null.display = True

# Position the geometry in world space via the Geometry COMP's transform
geo.par.tx = 2.0
geo.par.ty = 0.0
geo.par.tz = 0.0
```

### WRONG Patterns (Anti-Patterns)

**Do NOT connect SOPs to the Geometry COMP externally:**
```python
# WRONG - SOPs do not connect to a Geometry COMP from outside
sphere = base.create(sphereSOP, 'sphere1')
sphere.outputConnectors[0].connect(geo.inputConnectors[0])  # WRONG
```

**Do NOT try to set a `sop` parameter:**
```python
# WRONG - there is no 'sop' parameter on Geometry COMP
geo.par.sop = sphere        # WRONG - this parameter does not exist
geo.par.sop = 'sphere1'     # WRONG
```

**Do NOT create SOPs at the same level as the Geometry COMP:**
```python
# WRONG - SOPs must be INSIDE the geo, not beside it
sphere = base.create(sphereSOP, 'sphere1')   # wrong scope
geo = base.create(geometryCOMP, 'geo1')      # SOP is outside
```

### Render and Display Flags

Every SOP has `render` and `display` boolean flags:

- **`render = True`** -- this SOP's geometry is sent to the Render TOP. The Render TOP renders whatever SOP has the render flag inside each Geometry COMP.
- **`display = True`** -- this SOP's geometry is shown in the viewport/editor.

These flags are typically set on the final Null SOP in a chain:

```python
# SOP chain inside a Geometry COMP
box = geo.create(boxSOP, 'box1')
transform = geo.create(transformSOP, 'transform1')
transform.inputConnectors[0].connect(box.outputConnectors[0])
null = geo.create(nullSOP, 'out1')
null.inputConnectors[0].connect(transform.outputConnectors[0])

# Set flags on the output null
null.render = True
null.display = True
```

### Common SOP Types

| Operator | Python Name | Description |
|----------|-------------|-------------|
| Sphere | `sphereSOP` | Sphere primitive |
| Box | `boxSOP` | Box/cube primitive |
| Grid | `gridSOP` | Flat grid mesh |
| Torus | `torusSOP` | Torus (donut) shape |
| Circle | `circleSOP` | Circle or disc |
| Line | `lineSOP` | Line segment |
| Tube | `tubeSOP` | Cylinder/tube/cone |
| Merge | `mergeSOP` | Combine multiple SOPs |
| Transform | `transformSOP` | Transform geometry |
| Noise | `noiseSOP` | Deform with noise |
| Null | `nullSOP` | Pass-through (used as output) |

---

## 7. Instancing

Instancing efficiently duplicates geometry without copying the actual mesh data. Each instance can have unique position, rotation, scale, and color.

### Enable Instancing

```python
geo.par.instancing = True
```

### CHOP-Based Instancing

Drive instances from a CHOP with channels named by convention:

```python
# Create a Pattern CHOP with instance transforms
pattern = base.create(patternCHOP, 'instance_data')
pattern.par.length = 100         # 100 instances

# Point the Geometry COMP at the CHOP
geo.par.instancing = True
geo.par.instancechop = pattern.path

# Channel name mapping (these are the defaults)
geo.par.instancetx = 'tx'
geo.par.instancety = 'ty'
geo.par.instancetz = 'tz'
geo.par.instancerx = 'rx'
geo.par.instancery = 'ry'
geo.par.instancerz = 'rz'
geo.par.instancesx = 'sx'
geo.par.instancesy = 'sy'
geo.par.instancesz = 'sz'
```

### DAT-Based Instancing

Use a DAT (table) with columns for transforms:

```python
geo.par.instancing = True
geo.par.instancedat = dat.path

# Column headers: tx, ty, tz, rx, ry, rz, sx, sy, sz, cr, cg, cb
```

### SOP-Based Instancing

Use point attributes from a SOP to drive instances:

```python
geo.par.instancing = True
geo.par.instancesop = sop.path
```

### Instancing Attribute Names by Source Type

| Source | Position | Rotation | Scale | Color |
|--------|----------|----------|-------|-------|
| CHOP | `tx`, `ty`, `tz` | `rx`, `ry`, `rz` | `sx`, `sy`, `sz` | `cr`, `cg`, `cb` |
| SOP | `P(0)`, `P(1)`, `P(2)` | `N(0)`, `N(1)`, `N(2)` | `pscale` or `s(0)`, `s(1)`, `s(2)` | `Cd(0)`, `Cd(1)`, `Cd(2)` |
| DAT | `tx`, `ty`, `tz` | `rx`, `ry`, `rz` | `sx`, `sy`, `sz` | `cr`, `cg`, `cb` |

### Instance Color

To use per-instance color, enable it and assign channels:

```python
geo.par.instancecolorr = 'cr'
geo.par.instancecolorg = 'cg'
geo.par.instancecolorb = 'cb'
```

The material must be configured to use the instance color (often via a Constant MAT or PBR with vertex color enabled).

---

## 8. Complete Rendering Example

A full example that creates a lit, material-assigned sphere with camera and renders it to a texture.

```python
# Assumes 'base' is the container where we are building the scene
# e.g., base = op('/project1/base1')

# --- Geometry ---
geo = base.create(geometryCOMP, 'geo1')
geo.par.tx = 0
geo.par.ty = 0.5
geo.par.tz = 0

# Create a sphere SOP inside the Geometry COMP
sphere = geo.create(sphereSOP, 'sphere1')
sphere.par.radx = 1.0
sphere.par.rady = 1.0
sphere.par.radz = 1.0
sphere.par.rows = 30
sphere.par.cols = 30

# Output null with flags
null_sop = geo.create(nullSOP, 'out1')
null_sop.inputConnectors[0].connect(sphere.outputConnectors[0])
null_sop.render = True
null_sop.display = True

# --- Material ---
mat = base.create(pbrMAT, 'material1')
mat.par.basecolorr = 0.9
mat.par.basecolorg = 0.3
mat.par.basecolorb = 0.1
mat.par.metallic = 0.0
mat.par.roughness = 0.4

# Assign material to geometry
geo.par.material = mat

# --- Camera ---
cam = base.create(cameraCOMP, 'cam1')
cam.par.tx = 0
cam.par.ty = 1.5
cam.par.tz = 5
cam.par.rx = -10
cam.par.ry = 0
cam.par.rz = 0

# --- Lights ---
# Key light
key_light = base.create(lightCOMP, 'key_light')
key_light.par.lighttype = 'cone'
key_light.par.tx = 3
key_light.par.ty = 4
key_light.par.tz = 3
key_light.par.dimmer = 1.2
key_light.par.coneangle = 45
key_light.par.lookat = geo   # aim at the geometry

# Fill light
fill_light = base.create(lightCOMP, 'fill_light')
fill_light.par.lighttype = 'distant'
fill_light.par.rx = -30
fill_light.par.ry = -45
fill_light.par.dimmer = 0.4

# --- Render TOP ---
render = base.create(renderTOP, 'render1')
render.par.camera = cam
render.par.geometry = 'geo*'       # match all geometry by pattern
render.par.lights = '*light*'      # match all lights by pattern (note: plural)
render.par.resolutionw = 1920
render.par.resolutionh = 1080
render.par.antialias = 'aa8mid'    # menu value, not integer

# Background color is set on Camera COMP
cam.par.bgcolorr = 0.05
cam.par.bgcolorg = 0.05
cam.par.bgcolorb = 0.08
cam.par.bgcolora = 1.0
```

### Multiple Geometries Example

```python
# Create a ground plane
ground = base.create(geometryCOMP, 'geo_ground')
grid = ground.create(gridSOP, 'grid1')
grid.par.sizex = 20
grid.par.sizey = 20
grid.par.rows = 2
grid.par.cols = 2
ground_out = ground.create(nullSOP, 'out1')
ground_out.inputConnectors[0].connect(grid.outputConnectors[0])
ground_out.render = True
ground_out.display = True

# Ground material
ground_mat = base.create(pbrMAT, 'ground_mat')
ground_mat.par.basecolorr = 0.3
ground_mat.par.basecolorg = 0.3
ground_mat.par.basecolorb = 0.35
ground_mat.par.roughness = 0.9
ground.par.material = ground_mat

# Create several objects
for i in range(5):
    obj = base.create(geometryCOMP, f'geo_obj{i}')
    obj.par.tx = (i - 2) * 2.0
    obj.par.ty = 0.5
    obj.par.tz = 0

    box = obj.create(boxSOP, 'box1')
    box.par.sizex = 0.8
    box.par.sizey = 1.0
    box.par.sizez = 0.8

    out = obj.create(nullSOP, 'out1')
    out.inputConnectors[0].connect(box.outputConnectors[0])
    out.render = True
    out.display = True

    obj.par.material = mat   # reuse the PBR material from above

# The Render TOP with 'geo*' pattern picks up all of these automatically
```

### SOP Chain Example (Multiple Operations Inside a Geometry COMP)

```python
geo = base.create(geometryCOMP, 'geo_deformed')

# Start with a sphere
sphere = geo.create(sphereSOP, 'sphere1')
sphere.par.rows = 50
sphere.par.cols = 50

# Add noise deformation
noise = geo.create(noiseSOP, 'noise1')
noise.inputConnectors[0].connect(sphere.outputConnectors[0])
noise.par.amp = 0.3

# Transform
xform = geo.create(transformSOP, 'transform1')
xform.inputConnectors[0].connect(noise.outputConnectors[0])
xform.par.ry = 45

# Output
out = geo.create(nullSOP, 'out1')
out.inputConnectors[0].connect(xform.outputConnectors[0])
out.render = True
out.display = True
```
