# TouchDesigner POPs Reference

POPs (Point Operators) are TouchDesigner's GPU-accelerated operator family for 3D data manipulation. Introduced in TouchDesigner 2025, POPs enable working with millions of points in real-time—a significant performance improvement over CPU-based SOPs.

---

## Critical: POPs vs SOPs

POPs are designed as a modern replacement for SOPs in performance-critical scenarios. The key difference is **GPU vs CPU processing**.

| Aspect | SOPs (Legacy) | POPs (Modern) |
|--------|---------------|---------------|
| Processing | CPU | GPU |
| Point Count | Thousands | Millions+ |
| Performance | Limited by CPU cores | Massively parallel |
| Shader Required | No | No (built-in compute) |
| Data Storage | Point arrays | Texture buffers |
| Real-time Animation | Limited | Excellent |

### When to Use POPs

- Large point counts (10K+ points)
- Real-time particle simulation
- Point cloud manipulation from sensors (Kinect, ZED, LiDAR)
- GPU-accelerated geometry animation
- Performance-critical applications

### When to Use SOPs

- Traditional modeling operations not yet in POPs (Boolean, Bridge, Extrude, etc.)
- Legacy project compatibility
- Operations requiring CPU-side manipulation
- Specific SOP-only features you need

---

## What Are POPs?

POPs (Point Operators) are the seventh operator family in TouchDesigner, added in 2025. They run entirely on the GPU and manipulate 3D data: points, polygons, point clouds, particles, and line strips.

**Key characteristics:**
- **GPU-native**: All computation runs on the graphics card
- **Attribute-based**: Points carry named data (position, color, velocity, custom)
- **100 operators**: Complete toolkit for generation, simulation, and analysis
- **No shaders required**: Complex operations without writing GLSL
- **System requirements**: Minimum 4GB VRAM, 8GB recommended

---

## Core Concepts

### Attributes

Every point in POPs carries named attributes. The Attribute POP creates, modifies, renames, or deletes attributes.

| Attribute | Type | Description |
|-----------|------|-------------|
| `P` | vec3 | Position (X, Y, Z) |
| `N` | vec3 | Normal vector |
| `Color` | vec4 | RGBA color (Cd in SOPs) |
| `Tex` | vec2/3 | Texture coordinates |
| `PointScale` | float | Per-point scale factor |
| `LineWidth` | float | Line rendering width |
| Custom | any | User-defined attributes |

**Particle-specific attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `PartId` | int | Unique particle identifier |
| `PartVel` | vec3 | Velocity (units/second) |
| `PartAge` | float | Time since birth (seconds) |
| `PartLifeSpan` | float | Total lifespan (seconds) |
| `PartForce` | vec3 | Accumulated forces |
| `PartMass` | float | Particle mass |
| `PartDrag` | float | Drag coefficient |
| `PartDeath` | bool | Flag for removal |

### Feedback Loops

Particle systems require feedback loops to persist state between frames. The Feedback POP enables this pattern:

```
Particle POP → [Force POPs] → [Noise/Transform] → Null POP
     ↑                                                |
     └─────────── Target Feedback Loop ───────────────┘
```

**Setup:**
1. Create a Particle POP as the source
2. Chain force and transform operations
3. End with a Null POP
4. Set Particle POP's "Target Feedback Loop POP" parameter to the Null POP

The Feedback POP can only read particle attributes—it cannot add or remove particles. Only the Particle POP controls population.

### GPU Processing

POPs leverage GPU parallelism through compute shaders. Each point is processed independently, enabling:
- Millions of simultaneous operations
- Real-time physics simulation
- Complex noise and procedural generation
- Interactive frame rates for massive point clouds

---

## Particle Simulation

### Particle POP Setup

The Particle POP creates and simulates GPU-accelerated particles.

```python
# Create a basic particle system
particle = parent.create(particlePOP, 'particle1')
particle.par.birthrate = 1000          # particles per second
particle.par.lifeexpect = 3.0          # seconds
particle.par.lifeexpectvar = 0.5       # variance fraction
particle.par.targetfeedbackloop = op('null_output')
```

### Physics Integration

When time integration is enabled, the Particle POP updates particles using:

**Velocity update:** `V(t+1) = V(t) + (F/m) * dt`
**Position update:** `P(t+1) = P(t) + V(t+1) * dt`
**Drag force:** `F_drag = Drag * V^2`
**Velocity damping:** `V(t+1) = V(t+1) * (1 - VelocityDamping)`

### Birth/Death Lifecycle

**Birth:**
- Constant rate (particles per second) or attribute-driven
- Initial position from source geometry
- Initial velocity from parameters or attributes

**Death:**
- Automatic when `PartAge >= PartLifeSpan`
- Manual via `PartDeath` attribute (when enabled)
- Limit constraints (boundary collision)

### Forces

Apply forces using dedicated POPs or the `PartForce` attribute:

**Force Radial POP:** Radial attraction/repulsion from a point
```python
force = parent.create(forceradialPOP, 'force1')
force.par.centerx = 0
force.par.centery = 0
force.par.centerz = 0
force.par.magnitude = 10
force.par.falloff = 2  # inverse square
```

**Field POP:** Vector field forces from a TOP texture

**Noise POP:** Apply noise to any attribute including PartForce

---

## Common POP Operators

### Geometry Sources

| Operator | Description |
|----------|-------------|
| `Point Generator POP` | Randomly distribute points in a volume |
| `Grid POP` | Create a regular grid of points |
| `Sphere POP` | Generate sphere geometry |
| `Box POP` | Generate box geometry |
| `Circle POP` | Generate circle/disc geometry |
| `Torus POP` | Generate torus geometry |
| `Line POP` | Create line primitives |
| `Curve POP` | Create curve primitives |
| `SOP to POP` | Convert SOP geometry to POPs |
| `Point File In POP` | Load point data from files (.ply, .exr, .obj) |

### Data Flow

| Operator | Description |
|----------|-------------|
| `Null POP` | Passthrough/endpoint (feedback target) |
| `Select POP` | Reference a POP from elsewhere |
| `Switch POP` | Choose between inputs |
| `Merge POP` | Combine multiple inputs |
| `Copy POP` | Duplicate points/primitives |
| `Delete POP` | Remove points by group/attribute |
| `In POP` / `Out POP` | Component I/O |

### Transform & Modify

| Operator | Description |
|----------|-------------|
| `Transform POP` | Translate, rotate, scale |
| `Noise POP` | Apply noise to any attribute |
| `Math POP` | Mathematical operations on attributes |
| `Math Mix POP` | Blend attributes between inputs |
| `Math Combine POP` | Combine attributes with operators |
| `Normalize POP` | Normalize vector attributes |
| `Limit POP` | Constrain to bounding box |

### Forces & Simulation

| Operator | Description |
|----------|-------------|
| `Particle POP` | Main particle emitter/simulator |
| `Feedback POP` | Enable feedback loops |
| `Force Radial POP` | Point-based attraction/repulsion |
| `Field POP` | Vector field from texture |

### Analysis

| Operator | Description |
|----------|-------------|
| `Analyze POP` | Compute statistics (min/max/avg) |
| `Proximity POP` | Find nearest neighbors |
| `Connectivity POP` | Identify connected components |
| `Neighbor POP` | Access neighboring point data |
| `Normal POP` | Calculate surface normals |

### Lookup & Control

| Operator | Description |
|----------|-------------|
| `Lookup Channel POP` | Drive attributes from CHOPs |
| `Lookup Texture POP` | Sample TOPs for attribute values |
| `Lookup Attribute POP` | Cross-reference attributes |

### Output

| Operator | Description |
|----------|-------------|
| `DMX Fixture POP` | Configure DMX lighting fixtures |
| `DMX Out POP` | Output to DMX universes |
| `File Out POP` | Export point data to files |

---

## Data Conversion

### SOP to POP

Convert existing SOP geometry into POPs:

```python
sop_to_pop = parent.create(soptoPOP, 'sop_import')
sop_to_pop.par.sop = op('/project/geo/null_output')
```

The SOP to POP transfers:
- Point positions → `P` attribute
- Point colors → `Color` attribute
- Point normals → `N` attribute
- Custom point attributes → matching POP attributes

### TOP to POP

Use texture data as point positions or attributes:

```python
top_to_pop = parent.create(toptoPOP, 'texture_points')
top_to_pop.par.top = op('/project/noise1')
```

RGB channels become XYZ positions. Use Lookup Texture POP for sampling TOPs into other attributes.

### POP to SOP

POPs can be rendered directly via Render TOP with instancing, or converted back:
- Use `sopToCHOP` + `channelSOP` pattern for CPU-side manipulation
- Render directly with point sprites or geometry instancing

### POP to Render

```python
# Render POPs with instancing
geo = parent.create(geometryCOMP, 'geo1')
geo.par.instancing = True
geo.par.instanceop = op('null_pop_output')
geo.par.instancetx = 'P:x'
geo.par.instancety = 'P:y'
geo.par.instancetz = 'P:z'
```

---

## Performance Considerations

### GPU Memory

- Each attribute consumes VRAM per point
- `float3` position for 1M points ≈ 12MB
- Monitor with Info CHOP → `gpu_memory_used`
- Minimum 4GB VRAM required, 8GB+ recommended

### Optimal Patterns

1. **Minimize conversions**: Stay in POPs when possible
2. **Use feedback wisely**: Only update changed attributes
3. **Batch operations**: Chain multiple POPs before output
4. **Resolution matching**: Use consistent point counts in chains

### Debugging

- Attach Info CHOP to check point counts and cook times
- Use Analyze POP to verify attribute ranges
- Enable viewer display to visualize point positions

---

## Complete Operator List

All 100 POP operators organized alphabetically by category:

**A-B:** Accumulate, Alembic In, Analyze, Attribute, Attribute Combine, Attribute Convert, Blend, Box

**C:** Cache, Cache Blend, Cache Select, CHOP to, Circle, Connectivity, Convert, Copy, CPlusPlus, Curve

**D:** DAT to, Delete, Dimension, DMX Fixture, DMX Out

**E-F:** Extrude, Facet, Feedback, Field, File In, File Out, Force Radial

**G:** GLSL, GLSL Advanced, GLSL Copy, GLSL Create, GLSL Select, Grid, Group

**H-L:** Histogram, Import Select, In, Line, Line Break, Line Divide, Line Metrics, Line Resample, Line Smooth, Line Thick, Limit, Lookup Attribute, Lookup Channel, Lookup Texture

**M-N:** Math, Math Combine, Math Mix, Merge, Neighbor, Noise, Normal, Normalize, Null

**O-P:** OAK Select, Out, Particle, Pattern, Phaser, Plane, Point, Point File In, Point Generator, Polygonize, Primitive, Projection, Proximity

**Q-R:** Quantize, Random, Ray, Rectangle, ReRange, Revolve

**S:** Select, Skin, Skin Deform, SOP to, Sort, Sphere, Sprinkle, Subdivide, Switch

**T-Z:** Texture Map, TOP to, Topology, Torus, Trail, Transform, Trig, Tube, Twist, ZED
