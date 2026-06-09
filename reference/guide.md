# TouchDesigner Guide

## CRITICAL: Your Prior Knowledge is Unreliable

TouchDesigner has a unique Python API. Your pre-trained knowledge about TD parameters, operator types, and API methods is often incorrect. ALWAYS:
- Verify parameter names with `td_op` or `td_get_par` before setting them
- Use `td_children` to explore the scene before creating operators
- Check existing operator positions before creating new ones to avoid overlap
- Read this guide before starting any TD task

## Deep-Dive Reference

For detailed information beyond this guide, use `td_guide` with a topic:
- `td_guide(topic="operators")` — Operator types, data conversion, complete type lists
- `td_guide(topic="rendering")` — 3D rendering, cameras, lights, materials, instancing
- `td_guide(topic="glsl")` — GLSL shaders, uniforms, built-in functions
- `td_guide(topic="patterns")` — Layout rules, debugging, feedback loops, data saving
- `td_guide(topic="pops")` — GPU particles, Point Operators, POPs vs SOPs
- `td_guide(topic="networking")` — OSC, MIDI, DMX, Serial, UDP/TCP, WebSockets, NDI
- `td_guide(topic="audio")` — Audio CHOPs, spectrum analysis, synthesis, mixing

## MCP Tools Quick Reference

| Tool | Purpose | Key Params |
|------|---------|------------|
| `td_health` | Check if TD is running, get version info | (none) |
| `td_execute` | Run Python code in TD (captures stdout/stderr) | `code`, `from_op?` |
| `td_op` | Inspect operator details and all parameters | `path`, `extra?` |
| `td_children` | List child operators with depth/tag filtering | `path?`, `depth?`, `tags?` |
| `td_get_par` | Read a parameter value and metadata | `path`, `name` |
| `td_set_par` | Set a parameter value | `path`, `name`, `value` |
| `td_top_preview` | Save TOP as PNG, returns file path to read | `path` |
| `td_pane` | Get current network editor pane state | (none) |
| `td_selection` | Get currently selected operators | (none) |
| `td_bounds` | Get bounding box of op (incl. docked ops) | `path` |
| `td_layout` | List children with positions, sorted by X then Y | `path?` |
| `td_errors` | Error/warning report for op tree | `path?`, `recurse?` |
| `td_find_empty` | Find clear position for new ops | `path`, `w?`, `h?`, `margin?` |

## Common Workflows

### Exploring the Scene
```
1. td_health              -> Confirm TD is running
2. td_children(path="/")  -> See top-level structure
3. td_children(path="/project1", depth=2) -> Explore deeper
4. td_op(path="/some/op") -> Inspect specific operator params
```

### Creating Operators
```
1. td_layout(path="/target/comp")      -> See existing children + positions
2. td_find_empty(path="/target/comp")  -> Get clear position for new op
3. td_execute(code="...")              -> Create the operator at that position
```
```python
# Create at the position returned by td_find_empty
new_op = op('/components').create(constantTOP, 'myConstant')
new_op.nodeCenterX = 400  # use x from td_find_empty
new_op.nodeCenterY = 0    # use y from td_find_empty

# Connect operators
op1.outputConnectors[0].connect(op2.inputConnectors[0])
```

### Setting Parameters
```python
# Simple value — use td_set_par tool directly
# td_set_par(path="/some/op", name="tx", value=100)

# Expression — use td_execute
op('/some/op').par.tx.expr = "me.time.seconds"
op('/some/op').par.tx.mode = ParMode.EXPRESSION

# Export — use td_execute
op('/chop1').export(op('/some/op'), 'tx')
```

### Viewing TOP Output
```
1. td_top_preview(path="/some/top")  -> Returns {file: "C:\\...\\preview.png"}
2. Use Read tool on the returned file path to view the image
```

## Operator Families

| Family | Purpose | Common Operators |
|--------|---------|-----------------|
| **TOP** | Images/video | `constantTOP`, `nullTOP`, `selectTOP`, `switchTOP`, `compositeTOP`, `moviefileinTOP`, `renderTOP` |
| **CHOP** | Channels/data | `constantCHOP`, `nullCHOP`, `filterCHOP`, `selectCHOP`, `mathCHOP`, `noiseCHOP`, `timerCHOP` |
| **SOP** | 3D geometry | `sphereSOP`, `boxSOP`, `gridSOP`, `nullSOP`, `transformSOP`, `mergeSOP` |
| **POP** | GPU points/particles | `particlePOP`, `gridPOP`, `spherePOP`, `noisePOP`, `transformPOP`, `nullPOP` |
| **DAT** | Text/tables | `textDAT`, `tablDAT`, `selectDAT`, `nullDAT`, `webDAT`, `oscDAT` |
| **COMP** | Containers | `baseCOMP`, `containerCOMP`, `geometryCOMP`, `cameraCOMP`, `lightCOMP` |
| **MAT** | Materials | `pbrMAT`, `phongMAT`, `constantMAT` |

## TD Python Basics

```python
# Find operators
op('/path/to/op')          # by absolute path
op('relative')             # relative to current
op.SHORTCUT               # by global shortcut
parent()                  # parent component
me                        # current op (via from_op in td_execute)

# Create operators
new_op = parent.create(constantTOP, 'name1')
new_op.nodeCenterX = 400
new_op.nodeCenterY = 0

# Connect
op1.outputConnectors[0].connect(op2.inputConnectors[0])

# Parameters
op1.par.paramname           # parameter object
op1.par.paramname.val       # get/set value
op1.par.paramname.eval()    # evaluate (resolves expressions)
op1.par.paramname.expr      # get/set expression string
op1.par.paramname.default   # default value
op1.par.paramname.mode      # ParMode.CONSTANT, ParMode.EXPRESSION

# Children
comp.findChildren(maxDepth=1)
comp.findChildren(tags=['version_tracking'])
comp.selectedChildren       # currently selected in UI

# Position
op1.nodeCenterX, op1.nodeCenterY  # get/set position
```

## Code Conventions

- **Public methods**: UpperCamelCase (e.g., `SaveTox()`, `CreateComponent()`)
- **Private methods**: `_camelCase` (e.g., `_ensureComponentPage()`)
- **Pulse handlers**: `pulse_Parametername` (e.g., `pulse_Checkforupdates`)
- **Custom parameters**: Capitalized first letter (e.g., `Fadetime`, `Externaltoxpath`)
- **TD built-in params**: lowercase (e.g., `tx`, `ty`, `display`, `externaltox`)
- **Sync-to-file**: Extension TextDATs use `syncfile = True` — TD auto-reloads on disk changes. No need to call `reinitextensions`.
- **Node placement**: ALWAYS check existing children positions before creating operators. Query first, choose a clear spot.
- **Tag discovery**: `root.findChildren(tags=['my_tag'])`
