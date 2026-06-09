# TouchDesigner Patterns & Best Practices

A reference for Claude when building and modifying TouchDesigner networks via MCP tools.

---

## 1. Node Layout Rules

TouchDesigner networks are visual — node positions matter for readability and maintenance.

**Minimum spacing between operators:**

| Axis | Family | Minimum Distance |
|------|--------|-----------------|
| X (horizontal) | All | 200 px |
| Y (vertical) | TOPs, COMPs | 130 px |
| Y (vertical) | CHOPs, SOPs, DATs, MATs | 160 px |

**Layout discipline:**

- **Always check existing positions before creating operators.** Use the `td_layout` MCP tool to inspect what is already in a network, or use `td_find_empty` to get coordinates for a clear spot.
- **Wire direction** is left-to-right by convention. Inputs are on the left edge of a node, outputs on the right.
- **Type conversion operators** (e.g., `choptoTOP`, `soptoDAT`) should be stacked vertically at the same X position, shifted on Y, to visually group the conversion step.
- **Align related chains** on the same Y level so parallel processing paths are easy to follow.

**Example — placing a new operator safely:**

```python
# Use td_find_empty MCP tool to get a clear position, then:
new_op = base.create(noiseTOP, 'noise1')
new_op.nodeCenterX = 400  # position returned by td_find_empty
new_op.nodeCenterY = 0
```

---

## 2. Operator Creation Pattern

The standard sequence when creating operators programmatically:

```python
# 1. Reference the target component
base = op('/some/component')

# 2. Check layout first
#    Use td_layout MCP tool to see existing nodes and positions
#    Use td_find_empty MCP tool to get coordinates for a clear spot

# 3. Create the operator
new_op = base.create(noiseTOP, 'noise1')
new_op.nodeCenterX = 400
new_op.nodeCenterY = 0

# 4. Configure parameters
new_op.par.resolutionw = 1920
new_op.par.resolutionh = 1080

# 5. Connect to other operators
source.outputConnectors[0].connect(new_op.inputConnectors[0])
```

**Key points:**

- Always set `nodeCenterX` and `nodeCenterY` after creation to avoid stacking nodes at (0, 0).
- Connections use `outputConnectors[index]` and `inputConnectors[index]` — index is zero-based.
- Operator type constants (e.g., `noiseTOP`, `nullCHOP`, `textDAT`) are globally available in TD's Python environment.

---

## 3. Pattern Matching (Wildcards)

TouchDesigner supports wildcards in many parameter fields and Python API calls:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `*` | Matches any sequence of characters | `geo*` matches `geo1`, `geo_sphere`, `geometry` |
| `?` | Matches exactly one character | `light?` matches `light1`, `lightA` |

**Where wildcards are used:**

- **Render TOP** — `geometry`, `camera`, and `light` parameters accept wildcards to match multiple operators.
- **Select operators** — `selectTOP`, `selectCHOP`, `selectSOP`, `selectDAT` use wildcards in their source parameter.
- **`op.findChildren()`** — The `name` argument supports glob-style patterns.
- **Parameter expressions** — Any parameter that references operator names by string.

```python
# Find all children whose names start with "particle"
matches = base.findChildren(name='particle*')
```

---

## 4. Null Operators as Intermediaries

Null operators pass data through unchanged. Every operator family has one:

| Family | Null Type |
|--------|-----------|
| TOP | `nullTOP` |
| CHOP | `nullCHOP` |
| SOP | `nullSOP` |
| DAT | `nullDAT` |
| MAT | `nullMAT` |

**Use nulls for three purposes:**

### Output points

End every chain with a named null. Other operators select from the null rather than reaching into the middle of a chain.

```python
output = base.create(nullTOP, 'final_output')
last_in_chain.outputConnectors[0].connect(output.inputConnectors[0])
# Other components select from 'final_output'
```

### Breakpoints for debugging

Insert a null to inspect intermediate values without disrupting the chain.

```python
debug_null = base.create(nullCHOP, 'debug_after_filter')
filter_chop.outputConnectors[0].connect(debug_null.inputConnectors[0])
debug_null.outputConnectors[0].connect(next_op.inputConnectors[0])
```

### Rename points

Give a meaningful name to a data stream at a point where the auto-generated name is unclear.

---

## 5. Relative vs Absolute Paths

```python
# Absolute paths — full path from root
op('/project1/myComponent')

# Relative paths — from the current operator's parent component
op('noise1')                     # sibling in same component
op('../otherComp/noise1')        # up one level, into another component
op('./child/noise1')             # explicit relative into a child

# Special references
parent()                         # parent component
me                               # the current operator
root                             # scene root (/)
```

**Guidelines:**

- **Inside reusable components**, always use relative paths. This ensures the component works when copied or moved to a different location in the hierarchy.
- **Across component boundaries** (e.g., referencing a global resource), absolute paths are acceptable.
- **Global shortcuts** (e.g., `op.MYCOMP`) are an alternative to long absolute paths for well-known components.

---

## 6. Debugging

### Scanning for errors

Use the `td_errors` MCP tool to scan for errors and warnings in any operator tree. This checks cooking errors, expression errors, and missing references across all operators under a given path.

### Common error sources

| Problem | Symptom |
|---------|---------|
| Missing operator reference | Parameter shows red, error like "operator not found" |
| Expression error | Parameter shows red, Python traceback in error |
| Missing external file | Operator shows warning, file path parameter highlighted |
| Type mismatch on connection | Wire appears red or dashed, operator shows error |
| Stale cache | Error persists for 1-2 frames after a fix (TD caches errors) |

### Debugging with nulls

```python
# Insert a null to inspect data at a specific point in a chain
debug_null = base.create(nullCHOP, 'debug1')
source.outputConnectors[0].connect(debug_null.inputConnectors[0])

# Now inspect debug_null's channels
for chan in debug_null.chans():
    print(f'{chan.name}: {chan.eval()}')
```

### Debugging TOPs

```python
# Save a TOP's current frame to disk for inspection
top_op.save('/tmp/debug_frame.png')
```

Or use the `td_top_preview` MCP tool to capture a snapshot of any TOP.

---

## 7. Feedback TOP Pattern

Feedback loops let a TOP read its own output from the previous frame, enabling effects that evolve over time.

```python
# Create the feedback loop operators
feedback = base.create(feedbackTOP, 'feedback1')
comp = base.create(compositeTOP, 'comp1')
level = base.create(levelTOP, 'decay1')

# Wire: feedback -> level (fade) -> composite <- new input
feedback.outputConnectors[0].connect(level.inputConnectors[0])
level.par.opacity = 0.95  # slight fade each frame prevents infinite buildup
level.outputConnectors[0].connect(comp.inputConnectors[0])
input_top.outputConnectors[0].connect(comp.inputConnectors[1])

# Close the loop — feedback reads from the composite
feedback.par.top = comp.path
```

**How it works:**

1. `feedbackTOP` outputs the previous frame's result from the operator named in its `top` parameter.
2. That previous frame passes through `levelTOP` which fades it slightly (opacity < 1.0).
3. `compositeTOP` layers the faded previous frame with the new input.
4. `feedbackTOP.par.top` points to the composite, closing the loop.

**Applications:**

- **Trails / motion blur** — composite + fade creates ghosting behind moving objects.
- **Cellular automata** — a GLSL TOP in the feedback loop applies cellular rules each frame.
- **Wave simulation** — a GLSL TOP reads the previous frame as a displacement map.
- **Painting / accumulation** — new strokes composite onto the accumulated canvas.

---

## 8. Data Saving Patterns

### TOP to image file

```python
top.save('output.png')       # supports .png, .jpg, .tga, .bmp, .exr
# For image sequences:
top.save(f'frame_{me.time.frame:04d}.png')
```

### Movie recording

```python
recorder = base.create(moviefileoutTOP, 'recorder1')
recorder.par.file = 'output.mov'
source.outputConnectors[0].connect(recorder.inputConnectors[0])
recorder.par.record = True   # start recording
# recorder.par.record = False  # stop recording
```

### CHOP to file

```python
fileout = base.create(fileoutCHOP, 'save1')
fileout.par.file = 'data.clip'   # supports .clip, .chan, .bclip
source.outputConnectors[0].connect(fileout.inputConnectors[0])
```

### DAT to file

```python
dat.save('output.csv')          # or .txt, .json
# For continuous export, use fileoutDAT:
fileout = base.create(fileoutDAT, 'export1')
```

### SOP to file

```python
sop.save('output.obj')          # or .bgeo
```

---

## 9. Common Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Creating operators without checking positions | Nodes pile up at (0,0) or overlap existing nodes | Use `td_layout` or `td_find_empty` MCP tools before creating |
| Long chains without null intermediaries | Hard to debug, hard to tap into mid-chain | Insert named nulls at logical stages |
| Absolute paths inside reusable components | Component breaks when moved or duplicated | Use relative paths (`op('sibling')`, `parent()`, `me`) |
| Forgetting render/display flags on SOPs | Geometry COMP appears empty or renders wrong SOP | Set render and display flags on the final SOP in the chain |
| Placing SOPs outside a Geometry COMP | SOPs outside geo COMPs cannot be rendered in 3D | Always create SOPs inside a `geometryCOMP` |
| Making HTTP requests to AcroMCP from `td_execute` | Deadlock — TD's webserver is single-threaded and cannot serve a request while handling one | Never call back to AcroMCP from within executed code |
| Deeply nested expressions referencing distant operators | Fragile, hard to trace when they break | Use intermediary parameters or nulls to simplify references |
| Creating and destroying operators in the same frame | TouchDesigner crash | Create persistent operators and reuse them, or use `run()` with `delayFrames=1` to defer destruction to a later frame |

---

## 10. Frame-Sensitive Operations

Some operations require waiting one or more frames to complete properly.

### Operator creation and destruction

**Never create and destroy an operator in the same frame.** This can cause TouchDesigner to crash. If you need temporary operators:

- **Preferred:** Create a persistent operator and reuse it (set parameters to empty/minimal when idle)
- **Alternative:** Use `run()` with `delayFrames=1` to defer destruction:

```python
# BAD — may crash TD
temp = base.create(opviewerTOP)
temp.par.opviewer = target.path
temp.save('/tmp/capture.png')
temp.destroy()  # Crash! Same frame as create

# GOOD — deferred destruction
temp = base.create(opviewerTOP)
temp.par.opviewer = target.path
run('op(args[0]).destroy()', temp.path, delayFrames=1)
# Destruction happens next frame
```

### OP Viewer TOP rendering

An OP Viewer TOP needs **1 frame** after setting its `opviewer` parameter before the image is fully rendered. Force cooking (`cook(force=True)`) is not sufficient.

```python
opviewer.par.opviewer = target.path
# Image not ready yet!
run('args[0].save("/tmp/capture.png")', opviewer, delayFrames=1)
# Image saved after 1 frame delay
```

### TOP resolution changes

After changing a TOP's resolution parameters, the new resolution may not be reflected until the next frame.

### Extension reinitialization

Extensions automatically reinitialize when their source TextDAT changes. If the TextDAT has `syncfile = True` (synced to an external .py file), **editing the .py file on disk triggers reinitialization**.

This means `__init__` code runs again. Extensions should **never create persistent operators** — use MCP tools to create component structure, and have extensions simply reference existing operators:

```python
# BAD — don't create operators in extensions
def __init__(self, ownerComp):
    self.helper = ownerComp.create(nullTOP, 'helper')

# GOOD — reference operators that already exist in the component
def __init__(self, ownerComp):
    self.helper = ownerComp.op('helper')  # created via MCP, not extension
```

---

## 11. Performance Tips

### Cook management

- Set the **Cook Type** parameter on null TOPs/CHOPs to "Manual" for expensive operations that don't need to update every frame.
- Use **Select operators** to reference an existing result instead of duplicating an entire chain.

### Resolution control

- Limit the resolution of intermediate TOPs. Full resolution is often only needed at the final output stage.
- Use the `Resolution` parameter on TOPs to downsample intermediate steps.

### Monitoring

- **Perform CHOP** — creates channels with cook time, GPU time, and frame data for any operator.
- **Performance Monitor** — TD's built-in dialog (Alt+Y) shows per-operator cook times.

### General guidance

- Disable (bypass) operators that are not currently needed rather than deleting them.
- Avoid Python expressions in parameters when a simpler export CHOP or expression CHOP can do the same job — Python parameter expressions are slower than native TD expressions.
- Group related operators into components to keep networks clean and limit cook propagation.
