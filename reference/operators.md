# TouchDesigner Operator Reference

A practical reference for working with TouchDesigner operators programmatically. Covers all operator families, conversion patterns, and the complete list of operator types available for `create()` calls.

---

## Operator Family Overview

TouchDesigner organizes all operators into seven families. Each family processes a different data type and uses a consistent suffix.

| Family | Suffix | Data Type | Common Uses |
|--------|--------|-----------|-------------|
| **TOP** | `TOP` | Textures, images, video | Compositing, image processing, video playback, render output, GPU compute |
| **CHOP** | `CHOP` | Channels (arrays of samples) | Motion data, audio, animation curves, sensor input, control signals |
| **SOP** | `SOP` | 3D surface geometry | Modeling, procedural geometry, point clouds, mesh manipulation |
| **DAT** | `DAT` | Text, tables, scripts | Data storage, scripting, network I/O, serial communication, SQL |
| **COMP** | `COMP` | Components (containers) | UI panels, 3D scenes, replicators, encapsulation, custom components |
| **MAT** | `MAT` | Materials and shaders | Surface appearance, GLSL shaders, PBR rendering, lighting models |
| **POP** | `POP` | GPU 3D point data | GPU particles, point clouds, real-time geometry animation (new in 2025) |

### Signal Flow

Operators connect left-to-right within the same family. Cross-family data flow requires explicit conversion operators (see [Data Conversion](#data-conversion-between-families)).

---

## SOPs vs POPs (GPU 3D)

### Legacy Particle SOP

TouchDesigner includes a Particle SOP (`particleSOP`) for CPU-based particle simulation. This operator still works but is limited to thousands of particles due to CPU constraints.

### Modern POPs (TouchDesigner 2025+)

**POPs (Point Operators)** are the seventh operator family, introduced in TouchDesigner 2025. They are GPU-accelerated operators for 3D data manipulation—points, particles, point clouds, and geometry.

**Key differences from SOPs:**

| Aspect | SOPs | POPs |
|--------|------|------|
| Processing | CPU | GPU |
| Point count | Thousands | Millions+ |
| Data storage | Point arrays | Texture buffers |
| Real-time animation | Limited | Excellent |

**When to use POPs:**
- Real-time particle simulation
- Point cloud manipulation (Kinect, ZED, LiDAR)
- Performance-critical applications
- Generally preferred for most 3D work

**When to use SOPs:**
- Traditional modeling operations not yet in POPs (Boolean, Bridge, Extrude)
- Legacy project compatibility
- Specific SOP-only features you need

For comprehensive POPs documentation, use `td_guide(topic="pops")`.

### Data Conversion

Convert between families:
- `SOP to POP` — Bring SOP geometry into POPs
- `TOP to POP` — Use texture data as point positions
- Render POPs with instancing via Geometry COMP

---

## Universal Operators

These four operators exist in every family. They handle routing and organization rather than data transformation.

### null -- Passthrough and Breakpoint

```python
n = base.create(nullSOP, 'null_geo')
n = base.create(nullTOP, 'null_img')
n = base.create(nullCHOP, 'null_chan')
n = base.create(nullDAT, 'null_data')
```

Use null operators as output endpoints, organizational breakpoints, or stable reference targets. When other operators reference a null, you can change everything upstream without breaking downstream connections.

### select -- Reference from Elsewhere

```python
s = base.create(selectSOP, 'select_geo')
s.par.sop = op('/project/geometry/null_output')
```

Select operators reference an operator from anywhere in the project without requiring a wire connection. Essential for cross-network data sharing.

### switch -- Toggle Between Inputs

```python
sw = base.create(switchTOP, 'switch_source')
sw.par.index = 0  # selects first input
```

Switch operators choose one of their inputs to pass through, based on an index value. Useful for A/B comparisons, state machines, and conditional routing.

### merge -- Combine Multiple Inputs

```python
m = base.create(mergeSOP, 'merge_all')
```

Merge operators combine all inputs into a single output. For SOPs, this concatenates geometry. For CHOPs, this combines channels. For TOPs, this composites layers.

---

## Data Conversion Between Families

### CHOP to DAT

Convert channel data to a table of values.

```python
# chopToDAT -- writes CHOP channels as rows/columns in a DAT
c2d = base.create(chopToDAT, 'chop_to_dat')
c2d.inputConnectors[0].connect(chop_source)

# chopexecuteDAT -- fires a script callback when CHOP values change
ce = base.create(chopexecuteDAT, 'chop_exec')
```

### DAT to CHOP

Convert table data back into channels.

```python
d2c = base.create(datToCHOP, 'dat_to_chop')
d2c.inputConnectors[0].connect(dat_source)
```

### TOP to CHOP

Sample pixel data or texture values into channels.

```python
t2c = base.create(topToCHOP, 'top_to_chop')
t2c.inputConnectors[0].connect(top_source)
```

### CHOP to TOP

Convert channel data into a texture (one pixel per sample).

```python
c2t = base.create(chopToTOP, 'chop_to_top')
c2t.inputConnectors[0].connect(chop_source)
```

### SOP to DAT

Export geometry data (points, primitives, attributes) as table rows.

```python
s2d = base.create(sopToDAT, 'sop_to_dat')
s2d.inputConnectors[0].connect(sop_source)
```

### DAT to SOP

Build geometry from table data using a Script SOP.

```python
s = base.create(scriptSOP, 'dat_to_sop')
# In the Script SOP's callback, read from a DAT and create points/primitives
```

### TOP to DAT (Pixel Data)

Access individual pixel values via a Script TOP.

```python
st = base.create(scriptTOP, 'pixel_reader')
# In the Script TOP's callback, use scriptOp.inputs[0].numpyArray()
# to read pixel data and write results to a DAT
```

### Conversion Quick Reference

| From | To | Operator |
|------|----|----------|
| CHOP | DAT | `chopToDAT` |
| DAT | CHOP | `datToCHOP` |
| TOP | CHOP | `topToCHOP` |
| CHOP | TOP | `chopToTOP` |
| SOP | DAT | `sopToDAT` |
| SOP | CHOP | `sopToCHOP` |
| DAT | SOP | `scriptSOP` (manual) |
| TOP | DAT | `scriptTOP` (manual) |

---

## Complete Operator Type Lists

All operator types listed by their Python class names, as used with `base.create(typeName, 'opName')`. Grouped by category within each family.

### SOPs (Geometry)

**Primitives and Shapes:**
boxSOP, circleSOP, gridSOP, lineSOP, rectangleSOP, sphereSOP, torSOP, tubeSOP, superquadSOP, spiralSOP, curveSOP, cubeSOP

**Text and Font:**
fontSOP, textSOP

**Procedural Generation:**
fractalSOP, lSystemSOP, metaballSOP, isoSurfaceSOP, noiseSOP, sprinkleSOP

**Modeling and Deformation:**
addSOP, blendSOP, booleanSOP, bridgeSOP, capSOP, carveSOP, clipSOP, convertSOP, copySOP, creepSOP, crossSOP, curveclaySOP, deleteSOP, divideSOP, extrudeSOP, facetSOP, filletSOP, fitSOP, groupSOP, holeSOP, joinSOP, kinkSOP, latticeSOP, limitSOP, magnetSOP, modelSOP, pointSOP, polyloftSOP, polyPatchSOP, polyReduceSOP, polySplineSOP, polyStitchSOP, primitiveSOP, profileSOP, projectSOP, railsSOP, raySOP, refineSOP, resampleSOP, revolveSOP, skinSOP, sortSOP, stiffenSOP, stitchSOP, surgeSOP, surfsectSOP, sweepSOP, transformSOP, trimSOP, triSOP, twistSOP, vertexSOP, wireframeSOP

**Dynamics and Simulation:**
boneSOP, forceSOP, particleSOP, springSOP

**Tracking and Analysis:**
blobTrackSOP, traceSOP

**Sequence and Blending:**
sequenceBlendSOP

**Caching and Data Flow:**
cacheSOP, channelSOP, trailSOP

**I/O and Networking:**
datInSOP, inSOP, outSOP, objectMergeSOP, touchinSOP, touchoutSOP

**Routing:**
mergeSOP, nullSOP, selectSOP, switchSOP

**Scripting:**
scriptSOP, cplusplusSOP

**Utility:**
armSOP, careSOP, examineSOP, unpackSOP

### TOPs (Textures and Images)

**Generation:**
constantTOP, noiseTOP, rampTOP, rectangleTOP, circleTOP, spiralTOP, textTOP, curveTOP

**Compositing and Layering:**
compositeTOP, overTOP, underTOP, insideTOP, insideAlphaTOP, matteTOP, addTOP, differenceTOP, slapcompTOP, weightTOP

**Color and Adjustment:**
hsvadjustTOP, channelMixTOP, chromakeyTOP, levelTOP, lookupTOP, monochromeTOP, rgbkeyTOP, thresholdTOP, functionTOP, remapTOP

**Filtering and Effects:**
antiAliasTOP, blurTOP, bloomTOP, convolveTOP, cropTOP, depthTOP, displaceTOP, edgeTOP, embossTOP, fitTOP, flipTOP, glareTOP, lensdistortTOP, lumablurTOP, mirrorTOP, normalMapTOP, occlusionTOP, projectionTOP, scaleTOP, sharpenTOP, ssaoTOP, tileTOP, transformTOP, trimTOP, cornerpinTOP

**Rendering:**
renderTOP, renderPickTOP

**Layout and Composition:**
layoutTOP, packTOP, reorderTOP, resolutionTOP

**Video and Media Input:**
moviefileinTOP, videodevinTOP, videostreaminTOP, directxinTOP, kinectTOP, kinectazureTOP, kinectazureselectionTOP, leapMotionTOP, ndiinTOP, photoshopinTOP, pointFileInTOP, screenGrabTOP, syphonSpoutInTOP, touchinTOP, webRTCTOP, zedTOP

**Video and Media Output:**
moviefileoutTOP, videodevoutTOP, videostreamoutTOP, directxoutTOP, ndioutTOP, touchoutTOP

**Caching and Feedback:**
cacheTOP, cacheselectTOP, feedbackTOP, timemachineTOP

**GPU and Compute:**
glslTOP, glslmultiTOP, opencvTOP, nvflowTOP, scriptTOP, cplusplusTOP

**Substance:**
substanceTOP, substanceselectTOP

**Texture Utilities:**
cubemapTOP, prefiltermapTOP, sparseTextureTOP, textureSamplerTOP

**VR:**
openvrTOP

**Data Conversion:**
crossTOP, analyzeTOP, blobTrackTOP, chopToTOP, sopToTOP, topToCHOP

**Routing:**
inTOP, outTOP, nullTOP, selectTOP, switchTOP

### CHOPs (Channels)

**Audio Input:**
audiodeviceinCHOP, audiofileinCHOP, audiostreaminCHOP, audiordinCHOP, audiondinCHOP

**Audio Output:**
audiodeviceoutCHOP, audiofileoutCHOP, audiostreamoutCHOP, audiodoutCHOP, audiondoutCHOP

**Audio Processing:**
audiobandequalizerCHOP, audiomixerCHOP, audiooscillatorCHOP, audioparaeqCHOP, audioplayCHOP, audiorenderCHOP, audiospectCHOP

**Generation and Pattern:**
constantCHOP, noiseCHOP, patternCHOP, waveCHOP

**Math and Logic:**
absolveCHOP, angleCHOP, expressionCHOP, functionCHOP, logicCHOP, mathCHOP

**Timing and Animation:**
beatCHOP, clockCHOP, countCHOP, cycleCHOP, keyframeCHOP, speedCHOP, timerCHOP

**Filtering and Smoothing:**
filterCHOP, lagCHOP, limitCHOP, scalerangeCHOP, slopeCHOP, springCHOP, triggerCHOP, warpCHOP

**Channel Manipulation:**
analyzeCHOP, attributeCHOP, blendCHOP, clipCHOP, clipBlenderCHOP, copyCHOP, crossCHOP, deleteCHOP, delayCHOP, envelopeCHOP, eventCHOP, extendCHOP, fanCHOP, feedbackCHOP, holdCHOP, interpolateCHOP, lookupCHOP, mergeCHOP, overrideCHOP, renameCHOP, reorderCHOP, replaceCHOP, resampleCHOP, shiftCHOP, shuffleCHOP, snapshotCHOP, sortCHOP, stretchCHOP, switchCHOP, trimCHOP, transformCHOP

**Sequence:**
sequencerCHOP, timesliceCHOP

**Input Devices:**
joystickCHOP, keyboardinCHOP, mouseinCHOP, mouseoutCHOP, tabletCHOP, hotkeysCHOP, gestureCHOP, leapMotionCHOP

**Tracking and Body:**
accelCHOP, bodyTrackCHOP, faceTrackCHOP, handTrackCHOP, kinectCHOP, openvrCHOP, posetrackCHOP, zedCHOP

**Object and Scene:**
objectCHOP, panelCHOP, parameterCHOP, performCHOP, renderPickCHOP, infoCHOP

**Network Protocols:**
dmxinCHOP, dmxoutCHOP, oscInCHOP, oscOutCHOP, tcpipCHOP, udpinCHOP, udpoutCHOP, serialCHOP, pipeinCHOP, pipeoutCHOP, sharedmeminCHOP, sharedmemoutCHOP

**Timecode:**
ltcInCHOP, ltcOutCHOP

**MIDI:**
midievtCHOP, midiinCHOP, midiinmapCHOP, midioutCHOP

**Lighting and Stage:**
blacktraxCHOP, etherdreamCHOP, laserCHOP, ncamCHOP

**Data Conversion:**
datInCHOP, sopToCHOP, topToCHOP, datToCHOP, chopToDAT

**File I/O:**
fileinCHOP, fileoutCHOP

**I/O and Routing:**
inCHOP, outCHOP, nullCHOP, selectCHOP, touchinCHOP, touchoutCHOP, bindCHOP, trailCHOP

**Scripting:**
scriptCHOP, cplusplusCHOP, sTypeCHOP

### DATs (Data and Text)

**Text and Tables:**
textDAT, jsonDAT, xmlDAT, tableDAT

**Scripting and Execution:**
scriptDAT, executeDAT, evaluateDAT, expressionDAT, functionDAT

**Execute Callbacks:**
chopexecuteDAT, datexecuteDAT, panelexecuteDAT, parameterexecuteDAT

**Data Manipulation:**
insertDAT, mergeDAT, renameDAT, reorderDAT, selectDAT, sortDAT, substituteDAT, switchDAT, transposeDAT, overrideDAT

**Data Conversion:**
chopToDAT, datToDAT, sopToDAT

**File I/O:**
fileinDAT, fileoutDAT, folderDAT, fifoDAT

**Network Protocols:**
oscInDAT, oscOutDAT, tcpipDAT, udpinDAT, udpoutDAT, serialDAT, websocketDAT, webDAT, webrtcDAT, mqttclientDAT

**MIDI:**
midievtDAT, midiinDAT

**DMX and Stage:**
artnetDAT, etherdreamDAT

**Device and Hardware:**
keyboardinDAT, multitouchDAT

**OPC-UA:**
opcuaDAT

**SQL:**
sqlDAT

**Scene Inspection:**
errorDAT, examineDAT, infochopDAT, parameterDAT, performDAT, realtimeDAT, renderPickDAT, treeDAT

**I/O and Routing:**
inDAT, outDAT, nullDAT, touchinDAT, touchoutDAT

**Scripting:**
cplusplusDAT

### COMPs (Components)

**Containers and Layout:**
baseCOMP, containerCOMP

**UI Widgets:**
buttonCOMP, fieldCOMP, listCOMP, sliderCOMP, tableCOMP, textCOMP, widgetCOMP

**3D Scene:**
cameraCOMP, geometryCOMP, lightCOMP, handleCOMP

**Animation:**
animationCOMP, timelineCOMP

**USD and glTF:**
usdCOMP, gltfCOMP

**Viewing:**
opviewerCOMP, parameterCOMP

**Replication:**
replicatorCOMP

**Windowing:**
windowCOMP

**Tracking and Devices:**
kinectazureCOMP

**Video Streaming:**
videostreaminCOMP, videostreamoutCOMP

**Display Sharing:**
syphonSpoutCOMP

**Routing:**
selectCOMP

**Legacy UI:**
blindCOMP

**KeyFrames:**
kFCOMP

### MATs (Materials)

**Physically Based:**
pbrMAT

**Classic Shading:**
phongMAT, constantMAT

**Custom Shaders:**
glslMAT

**Geometry Rendering Styles:**
lineMAT, pointMAT, pointspriteMAT, wireframeMAT

**Depth:**
depthMAT

**Texturing:**
texturelayerMAT

**Instancing:**
instMAT

**Shared Properties:**
commonMAT

**Routing:**
switchMAT

---

## Parameter Discovery

Use the `td_op` MCP tool to inspect any operator and discover all its parameters, their current values, defaults, types, and labels.

### Inspecting an Operator

```
td_op(path="/project1/geo1")
```

This returns the operator's full parameter list including name, value, default, type (style), label, and page grouping.

### Reading a Single Parameter

```
td_get_par(path="/project1/geo1", name="tx")
```

Returns the parameter's value, default, type, and metadata.

### Setting a Parameter

```
td_set_par(path="/project1/geo1", name="tx", value=1.5)
```

### Discovering Children

```
td_children(path="/", depth=2)
```

Lists all child operators at a path, useful for understanding scene hierarchy before navigating into specific operators.

### Common Parameter Names

Most operators share these built-in parameters:

| Parameter | Description |
|-----------|-------------|
| `name` | Operator name |
| `nodeX`, `nodeY` | Position in network editor |
| `nodeWidth`, `nodeHeight` | Size in network editor |
| `comment` | User comment |
| `tags` | Space-separated tag list |
| `clone` | Clone source path |
| `externaltox` | External tox file path |
| `enableexternaltox` | Whether external tox is active |

### Parameter Modes

Parameters can be set to different modes:

| Mode | Constant | Description |
|------|----------|-------------|
| `ParMode.CONSTANT` | Direct value | Default mode, holds a fixed value |
| `ParMode.EXPRESSION` | Python expression | Evaluated each frame |
| `ParMode.EXPORT` | CHOP export | Driven by a CHOP channel |
| `ParMode.BIND` | Bind reference | Two-way binding to another parameter |

### Example: Create and Configure an Operator

```python
# Create a noise TOP
n = base.create(noiseTOP, 'noise1')

# Set parameters
n.par.resolutionw = 1920
n.par.resolutionh = 1080
n.par.mono = True
n.par.period = 2.0

# Position in network editor
n.nodeX = 200
n.nodeY = -100

# Use td_op to discover what other parameters are available
# td_op(path=n.path)
```
