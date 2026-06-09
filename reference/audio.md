# TouchDesigner Audio Reference

A practical reference for audio in TouchDesigner. Covers input/output, analysis, synthesis, filtering, dynamics, and spatial audio.

---

## Audio Quick Reference

| Category | Operators | Purpose |
|----------|-----------|---------|
| **Input** | `audiofileinCHOP`, `audiodeviceinCHOP`, `audiomovie CHOP` | Load audio from files or capture live |
| **Output** | `audiodeviceoutCHOP`, `audiofileoutCHOP` | Play to speakers or save to file |
| **Analysis** | `audiospectrumCHOP`, `analyzeCHOP`, `beatCHOP` | FFT, levels, beat detection |
| **Synthesis** | `audiooscillatorCHOP` | Generate tones, noise, waveforms |
| **Filtering** | `audiofilterCHOP`, `audioparaeqCHOP`, `audiobandeqCHOP` | Low/high pass, parametric EQ |
| **Dynamics** | `audiodynamicsCHOP` | Compression, limiting |
| **Spatial** | `audiorenderCHOP` | 3D spatial audio, binaural |
| **Mixing** | `mathCHOP`, `mergeCHOP` | Volume, pan, combine sources |

---

## Audio Input

### Audio File In CHOP

Play audio from disk or URLs. Supports `.mp3`, `.wav`, `.aif`, `.aiff`, `.au`.

```python
audio_file = parent.create(audiofileinCHOP, 'audio_file')
audio_file.par.file = 'audio/music.mp3'
audio_file.par.play = True
audio_file.par.playmode = 'sequential'  # or 'locked', 'specify'
audio_file.par.volume = 0.8
audio_file.par.repeat = True
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `file` | Path to audio file (local or http://) |
| `playmode` | `locked` (timeline), `sequential` (continuous), `specify` (index) |
| `speed` | Playback speed multiplier (sequential mode) |
| `volume` | 0 = mute, 1 = full |
| `repeat` | Loop when end is reached |
| `trim`, `trimstart`, `trimend` | Trim audio start/end |

### Audio Device In CHOP

Capture live audio from microphones, line-in, or other audio devices.

```python
audio_in = parent.create(audiodeviceinCHOP, 'audio_in')
audio_in.par.active = True
audio_in.par.driver = 'default'       # or 'asio' for low latency
audio_in.par.device = 'default'
audio_in.par.rate = 44100
audio_in.par.bufferlength = 0.05      # seconds, affects latency
```

**Driver options:**
| Driver | Use Case |
|--------|----------|
| `default` | DirectSound (Windows) / CoreAudio (macOS) |
| `asio` | Low-latency professional audio |
| `datapath` | DataPath capture devices |
| `blackmagic` | Blackmagic Design devices |
| `aja` | AJA devices |

**Tip:** Use ASIO for lowest latency. Increase `bufferlength` if you hear crackling.

---

## Audio Output

### Audio Device Out CHOP

Output audio to speakers or audio interfaces.

```python
audio_out = parent.create(audiodeviceoutCHOP, 'audio_out')
audio_out.par.active = True
audio_out.par.driver = 'default'
audio_out.par.device = 'default'
audio_out.par.bufferlength = 0.15     # seconds, increase if crackling
audio_out.par.volume = 1.0
audio_out.par.clampoutput = True      # prevent clipping
audio_out.par.cookalways = True       # essential for continuous output
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `bufferlength` | Audio buffer size in seconds (higher = more latency, fewer dropouts) |
| `volume` | 0 = mute, 1 = full |
| `pan` | 0 = left, 0.5 = center, 1 = right |
| `clampoutput` | Clamp to -1 to 1 to prevent clipping |
| `cookalways` | Must be On for continuous playback |

**Troubleshooting audio dropouts:**
1. Increase `bufferlength` (default 0.15 seconds)
2. Check Edit > Preferences > CHOPs > Maximum Time Slice Size (default 0.2 seconds)
3. Optimize networks so no frame exceeds buffer size
4. Consider running audio in a separate TouchDesigner process

---

## Audio Analysis

### Audio Spectrum CHOP

Calculate FFT frequency spectrum for visualization or analysis.

```python
spectrum = parent.create(audiospectrumCHOP, 'spectrum')
spectrum.par.mode = 'visual'          # or 'timetoraw' for processing
spectrum.par.fftsize = 2048           # 512, 1024, 2048, 4096, 8192
spectrum.par.frequencylog = 1         # logarithmic (better for human hearing)
spectrum.par.highfreqboost = 1        # boost high frequencies for display
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `mode` | `visual` (display-friendly), `timetoraw` (magnitude/phase for processing) |
| `fftsize` | Power of 2 (512-16384). Larger = more accurate but slower |
| `frequencylog` | 0 = linear (1 sample/Hz), 1 = logarithmic (equal octaves) |
| `highfreqboost` | Boost high frequencies for visualization |

**Performance tip:** Reduce `fftsize` to 2048 for faster cooking. Set `frequencylog` to 0 for simple interpretation (sample 1000 = 1000 Hz).

### Analyze CHOP

Extract single values from audio: max, min, average, RMS, peaks.

```python
analyze = parent.create(analyzeCHOP, 'analyze')
analyze.par.function = 'rmspower'     # good for audio level meters
```

**Common functions:**
| Function | Description |
|----------|-------------|
| `average` | Average value |
| `maximum` / `minimum` | Peak values |
| `rmspower` | RMS power (perceived loudness) |
| `sum` | Sum of all samples |
| `highestpeakvalue` | Value of highest peak |
| `totalpeaks` | Count of peaks |

### Beat CHOP

Generate ramps, pulses, and counters synced to BPM.

```python
beat = parent.create(beatCHOP, 'beat')
beat.par.period = 4                   # beats per cycle
beat.par.playmode = 'local'           # independent of timeline
# Output channels
beat.par.ramp = True                  # 0-1 ramp each period
beat.par.pulse = True                 # pulse each period
beat.par.bpm = True                   # current BPM value
```

**Setting global BPM:**
```python
op('/local/time').tempo = 140
```

**Key outputs:**
| Output | Description |
|--------|-------------|
| `ramp` | 0-1 ramp each period |
| `pulse` | Pulse at start of each period |
| `count` | Increments each period |
| `bar`, `beat`, `sixteenths` | Current position |
| `bpm` | Current tempo |

---

## Synthesis

### Audio Oscillator CHOP

Generate waveforms for synthesis or modulation.

```python
osc = parent.create(audiooscillatorCHOP, 'osc')
osc.par.wavetype = 'sin'              # sin, tri, ramp, square, pulse, whitenoise
osc.par.frequency = 440               # Hz (A4)
osc.par.amp = 0.5                     # amplitude
osc.par.rate = 44100                  # sample rate
```

**Wave types:**
| Type | Range | Description |
|------|-------|-------------|
| `sin` | -1 to 1 | Sine wave |
| `tri` | -1 to 1 | Triangle wave |
| `ramp` | 0 to 1 | Sawtooth ramp |
| `square` | -1 to 1 | Square wave |
| `pulse` | 0 to 1 | Pulse wave |
| `whitenoise` | -1 to 1 | Random samples |

**Pitch control:** Input 1 controls pitch logarithmically:
- 0 = base frequency (440 Hz default)
- 1 = one octave up (880 Hz)
- -1 = one octave down (220 Hz)
- 1/12 (0.0833) = one semitone

---

## Filtering

### Audio Filter CHOP

Remove frequencies with low/high/band pass filters.

```python
filt = parent.create(audiofilterCHOP, 'filter')
filt.par.filter = 'lowpass'           # lowpass, highpass, bandpass, bandreject
filt.par.units = 'frequency'          # or 'logarithmic'
filt.par.cutofffrequency = 1000       # Hz
filt.par.resonance = 0                # boost near cutoff
filt.par.rolloff = 12                 # dB per octave (12 or 24)
```

**Filter types:**
| Type | Description |
|------|-------------|
| `lowpass` | Pass frequencies below cutoff |
| `highpass` | Pass frequencies above cutoff |
| `bandpass` | Pass frequencies between low and high cutoff |
| `bandreject` | Remove frequencies between cutoffs |

### Audio Para EQ CHOP

Parametric equalizer with 3 bands.

```python
eq = parent.create(audioparaeqCHOP, 'eq')
eq.par.enableeq1 = True
eq.par.boost1 = 6                     # dB boost (negative to cut)
eq.par.frequencyhz1 = 100             # center frequency
eq.par.bandwidth1 = 2                 # octaves
```

**Per-band parameters:**
| Parameter | Description |
|-----------|-------------|
| `enableeqN` | Enable band N (1-3) |
| `boostN` | Gain in dB (positive = boost, negative = cut) |
| `frequencyhzN` | Center frequency in Hz |
| `bandwidthN` | Width in octaves |

---

## Dynamics

### Audio Dynamics CHOP

Compression and limiting for dynamic range control.

```python
dynamics = parent.create(audiodynamicsCHOP, 'dynamics')
# Compressor
dynamics.par.enablecompressor = True
dynamics.par.thresholdcompressor = -20    # dB
dynamics.par.ratiocompressor = 0.5        # 0 = none, 1 = full limiting
dynamics.par.attackcompressor = 2         # msec = 10^val
dynamics.par.releasecompressor = 3        # msec = 10^val
# Limiter
dynamics.par.enablelimiter = True
dynamics.par.thresholdlimiter = 0         # dB (0 = max digital level)
```

**Compressor types:**
| Type | Use Case |
|------|----------|
| `compagc` | Automatic Gain Control - smooth long passages |
| `compmus` | Musical Dynamics - preserve dynamics, light compression |

**Compression parameters:**
| Parameter | Description |
|-----------|-------------|
| `thresholdcompressor` | Level (dB) where compression starts |
| `ratiocompressor` | Amount of compression (0-1+) |
| `kneecompressor` | Smoothness of transition (0 = hard) |
| `attackcompressor` | How fast compression engages (10^val msec) |
| `releasecompressor` | How fast compression releases (10^val msec) |

---

## Spatial Audio

### Audio Render CHOP

3D spatial audio using Steam Audio SDK.

```python
spatial = parent.create(audiorenderCHOP, 'spatial')
spatial.par.active = True
spatial.par.listenerobject = op('/project/camera1')
spatial.par.sourceobject = op('/project/sound_source')
spatial.par.outputformat = 'Binaural'     # for headphones
spatial.par.attenuation = True
```

**Output formats:**
| Format | Channels | Description |
|--------|----------|-------------|
| `Binaural` | 2 | Headphone 3D audio |
| `stereo` | 2 | Standard stereo |
| `quadraphonic` | 4 | 4-speaker surround |
| `fiveone` | 6 | 5.1 surround |
| `sevenone` | 8 | 7.1 surround |
| `ambix` | 16 | 3rd order Ambisonics |
| `custom` | varies | Custom speaker layout via mapping table |

**Requirements:**
- Mono audio input only
- Sample rate must be 44100 or 48000
- Listener and source must be COMPs with transforms

---

## Common Audio Patterns

### Basic Audio Playback

```python
# File playback to speakers
audio_file = parent.create(audiofileinCHOP, 'audio_file')
audio_file.par.file = 'music.mp3'
audio_file.par.play = True

audio_out = parent.create(audiodeviceoutCHOP, 'audio_out')
audio_out.par.active = True
audio_out.par.cookalways = True
audio_out.inputConnectors[0].connect(audio_file)
```

### Audio-Reactive Visuals

```python
# Get audio levels for visual reactivity
spectrum = parent.create(audiospectrumCHOP, 'spectrum')
spectrum.par.fftsize = 1024

# Extract specific frequency bands
analyze_low = parent.create(analyzeCHOP, 'analyze_low')
analyze_low.par.function = 'rmspower'
# Use Math CHOP to select low frequency samples

analyze_high = parent.create(analyzeCHOP, 'analyze_high')
analyze_high.par.function = 'rmspower'
# Use Math CHOP to select high frequency samples
```

### Mixing Multiple Sources

```python
# Combine audio sources with Math CHOP
merge = parent.create(mergeCHOP, 'merge')
# Connect multiple audio sources

math = parent.create(mathCHOP, 'mixer')
math.par.gain = 0.5  # reduce combined volume
math.inputConnectors[0].connect(merge)
```

### Sidechain Compression

```python
# Duck background music when voice is present
dynamics = parent.create(audiodynamicsCHOP, 'duck')
dynamics.par.enablecompressor = True
dynamics.par.thresholdcompressor = -20
dynamics.par.ratiocompressor = 0.8
# Connect music to input 0, voice to input 1 (sidechain)
```

---

## Time Slicing

Audio CHOPs use "time slicing" - they output only the samples generated since the last frame. This is critical for real-time audio processing.

**Key concepts:**
- Time slice = samples between last cook and current cook
- At 60 FPS with 44100 Hz sample rate: ~735 samples per slice
- Audio Device Out expects continuous time-sliced input
- Use `timeslice` parameter on Common page to control

**Sample rate:** Most audio CHOPs default to 44100 Hz. Match sample rates across your audio chain to avoid resampling artifacts.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Audio crackling/dropouts | Increase Audio Device Out `bufferlength` |
| No sound output | Check `active` and `cookalways` parameters |
| Audio out of sync | Use `locked` playmode for timeline sync |
| High CPU usage | Reduce `fftsize` in Audio Spectrum, lower sample rates |
| Clipping/distortion | Enable `clampoutput`, reduce volume, use limiter |
| Latency too high | Use ASIO driver, reduce buffer sizes |

### Performance Tips

1. **Sample rate:** Use 44100 Hz unless you need higher quality
2. **FFT size:** 2048 is a good balance for spectrum analysis
3. **Buffer length:** Start at 0.15 seconds, reduce if latency matters
4. **Cook Always:** Only enable on output CHOPs that need continuous playback
5. **Time slicing:** Keep time-sliced CHOPs in their own network for clarity

---

## Complete Audio CHOP List

**Input:** `audiofileinCHOP`, `audiodeviceinCHOP`, `audiomovie CHOP`, `audiostreaminCHOP`

**Output:** `audiodeviceoutCHOP`, `audiofileoutCHOP`, `audiostreamoutCHOP`

**Analysis:** `audiospectrumCHOP`, `analyzeCHOP`, `beatCHOP`, `envelopeCHOP`

**Synthesis:** `audiooscillatorCHOP`, `lfoCHOP`, `waveCHOP`, `noiseCHOP`

**Processing:** `audiofilterCHOP`, `audioparaeqCHOP`, `audiobandeqCHOP`, `audiodynamicsCHOP`

**Spatial:** `audiorenderCHOP`, `oculusaudioCHOP`

**Utility:** `mathCHOP`, `mergeCHOP`, `trailCHOP`, `recordCHOP`, `resampleCHOP`
