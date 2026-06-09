# TouchDesigner Networking & Protocols Reference

A practical reference for network communication in TouchDesigner. Covers OSC, MIDI, DMX, Serial, UDP/TCP, WebSockets, and NDI.

---

## Protocol Quick Reference

| Protocol | Use Case | Operators | Transport |
|----------|----------|-----------|-----------|
| **OSC** | Control messages, inter-app | `oscInCHOP`, `oscOutCHOP`, `oscInDAT`, `oscOutDAT` | UDP |
| **MIDI** | Music hardware, controllers | `midiinCHOP`, `midioutCHOP`, `midiinDAT`, `midieventDAT` | USB/Serial |
| **DMX** | Stage lighting | `dmxinCHOP`, `dmxoutCHOP` | Serial/Art-Net/sACN |
| **Serial** | Arduino, custom hardware | `serialDAT`, `serialCHOP` | RS-232/USB |
| **UDP** | Fast, unreliable messaging | `udpinDAT`, `udpoutDAT`, `udpinCHOP`, `udpoutCHOP` | UDP |
| **TCP** | Reliable messaging | `tcpipDAT` | TCP |
| **WebSocket** | Web communication | `websocketDAT` | TCP |
| **NDI** | Video over IP | `ndiinTOP`, `ndioutTOP` | UDP/TCP |

---

## OSC (Open Sound Control)

OSC is the most common protocol for real-time control between applications. It uses UDP for low-latency communication.

### OSC In CHOP

Receive OSC messages as CHOP channels.

```python
osc_in = parent.create(oscInCHOP, 'osc_in')
osc_in.par.port = 7000              # listen port
osc_in.par.active = True
# Channels auto-create from incoming OSC addresses
# /synth/volume -> channel "synth_volume"
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `port` | UDP port to listen on |
| `active` | Enable/disable receiving |
| `oscaddressscope` | Filter addresses (e.g., `^*accel*` excludes accelerometer) |
| `stripsegments` | Remove prefix segments from channel names |

### OSC Out CHOP

Send CHOP channels as OSC messages.

```python
osc_out = parent.create(oscOutCHOP, 'osc_out')
osc_out.par.netaddress = '192.168.1.100'
osc_out.par.port = 8000
osc_out.par.active = True
# Channel names become OSC addresses
# "synth_volume" -> /synth/volume
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `netaddress` | Destination IP (use `localhost` for same machine) |
| `port` | Destination UDP port |
| `sendevents` | Send every cook vs only on change |

### OSC DATs

For message-based OSC (vs continuous channels):
- `oscInDAT` — Receive messages as table rows
- `oscOutDAT` — Send messages with `sendOSC()` method

```python
# Send OSC bundle from DAT
osc_out_dat = op('osc_out_dat')
osc_out_dat.sendOSC('/effect/trigger', [1.0, 'bang'])
```

---

## MIDI

MIDI connects to hardware controllers, synthesizers, and DAWs.

### MIDI In CHOP

```python
midi_in = parent.create(midiinCHOP, 'midi_in')
midi_in.par.id = 0                  # device ID from MIDI Device Mapper
midi_in.par.active = True
midi_in.par.simplified = True       # auto-create channels
```

**Simplified mode** auto-creates channels for all incoming MIDI (recommended).

**Manual mode** parameters:
| Parameter | Description |
|-----------|-------------|
| `notename` | Base name for note channels (e.g., `n`) |
| `notescope` | Note range (e.g., `0-127`, `60-72`) |
| `controlname` | Base name for CC channels (e.g., `c`) |
| `controlind` | Controller indices (e.g., `1-10`, `64`) |
| `velocity` | How to handle velocity (off, amplitude, separate) |

### MIDI Out CHOP

```python
midi_out = parent.create(midioutCHOP, 'midi_out')
midi_out.par.id = 0                 # output device ID
midi_out.par.active = True
```

### MIDI Channel Naming

| MIDI Event | Channel Pattern |
|------------|-----------------|
| Note On/Off | `n60`, `n61`, ... (note number) |
| Control Change | `c1`, `c2`, ... (CC number) |
| Pitch Bend | `pitch` |
| Aftertouch | `pressure` |

### Normalization

```python
midi_in.par.notenorm = '0to1'       # normalize note values 0-1
midi_in.par.norm = '0to1'           # normalize controller values 0-1
```

---

## DMX / Art-Net / sACN

DMX controls stage lighting. TouchDesigner supports multiple interfaces:
- **Serial** — Direct USB-DMX adapters (ENTTEC)
- **Art-Net** — DMX over Ethernet (UDP)
- **sACN** — Streaming ACN (E1.31)
- **KiNET** — Color Kinetics protocol

### DMX Out CHOP

```python
dmx_out = parent.create(dmxoutCHOP, 'dmx_out')
dmx_out.par.interface = 'artnet'    # or 'serial', 'sacn', 'kinet'
dmx_out.par.netaddress = '2.0.0.1'  # Art-Net node IP
dmx_out.par.net = 0                 # Art-Net net (0-127)
dmx_out.par.subnet = 0              # Art-Net subnet (0-15)
dmx_out.par.universe = 0            # Art-Net universe (0-15)
dmx_out.par.rate = 44               # max 44Hz for DMX512
dmx_out.par.active = True
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `interface` | `serial`, `artnet`, `sacn`, `kinet` |
| `net`, `subnet`, `universe` | Art-Net addressing |
| `rate` | Send rate (max 44Hz for DMX512) |
| `format` | `packetpersample` (per channel) or `packetperchan` (per universe) |

### DMX In CHOP

```python
dmx_in = parent.create(dmxinCHOP, 'dmx_in')
dmx_in.par.interface = 'artnet'
dmx_in.par.net = 0
dmx_in.par.subnet = 0
dmx_in.par.universe = 0
dmx_in.par.active = True
```

### Art-Net Addressing

Art-Net uses a hierarchical address scheme:
- **Net** (0-127): 256 universes each
- **Subnet** (0-15): 16 universes each
- **Universe** (0-15): 512 channels each

Total: 128 × 16 × 16 = 32,768 universes

---

## Serial Communication

For Arduino, custom hardware, and legacy devices.

### Serial DAT

```python
serial = parent.create(serialDAT, 'serial')
serial.par.port = 'COM3'            # or '/dev/ttyUSB0' on macOS/Linux
serial.par.baudrate = 9600          # match your device
serial.par.databits = 8
serial.par.parity = 'none'
serial.par.stopbits = 1
serial.par.active = True
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `port` | COM port (Windows) or device path (macOS/Linux) |
| `baudrate` | 9600, 115200, etc. — must match device |
| `format` | `perbyte`, `perline`, `permessage` |

### Sending Data

```python
serial = op('serial')
serial.send('Hello\n')              # send string
serial.send(bytes([0x01, 0x02]))    # send bytes
```

### Callbacks

```python
# In callbacks DAT
def onReceive(dat, rowIndex, message, bytes):
    print(f"Received: {message}")
```

---

## UDP Communication

Fast, connectionless messaging. No guarantee of delivery.

### UDP In DAT

```python
udp_in = parent.create(udpinDAT, 'udp_in')
udp_in.par.port = 5000
udp_in.par.format = 'permessage'    # one row per message
udp_in.par.active = True
```

### UDP Out DAT

```python
udp_out = parent.create(udpoutDAT, 'udp_out')
udp_out.par.netaddress = '192.168.1.100'
udp_out.par.port = 5000

# Send data
udp_out.send('message')
udp_out.send(bytes([0x01, 0x02, 0x03]))
```

### UDP CHOPs

For continuous numeric data:
- `udpinCHOP` — Receive channels
- `udpoutCHOP` — Send channels

---

## WebSockets

Two-way communication with web applications.

### WebSocket DAT

```python
ws = parent.create(websocketDAT, 'websocket')
ws.par.netaddress = 'ws://localhost:8080'
ws.par.port = 8080
ws.par.active = True

# Send message
ws.send('{"action": "update", "value": 42}')
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `netaddress` | WebSocket server URL |
| `port` | Server port (443 implies secure wss://) |
| `timeout` | Connection timeout (ms) |

### Callbacks

```python
def onReceive(dat, rowIndex, message, bytes):
    data = json.loads(message)
    # Handle incoming message
```

---

## NDI (Network Device Interface)

Video and audio streaming over IP. High quality, low latency.

### NDI In TOP

```python
ndi_in = parent.create(ndiinTOP, 'ndi_in')
ndi_in.par.name = 'MACHINE (Source)'  # source name from menu
ndi_in.par.bandwidth = 'high'
ndi_in.par.active = True
```

**Key parameters:**
| Parameter | Description |
|-----------|-------------|
| `name` | NDI source name (from dropdown) |
| `bandwidth` | `high` or `low` |
| `extraips` | IPs for sources outside local mDNS |

### NDI Out TOP

```python
ndi_out = parent.create(ndioutTOP, 'ndi_out')
ndi_out.par.name = 'TouchDesigner Output'
ndi_out.par.active = True
```

### NDI Audio

Attach `audioNDICHOP` to `ndiinTOP` to extract audio.

---

## Troubleshooting

### Windows Firewall

Most connection issues on Windows are caused by the firewall. Either:
- Disable Windows Firewall for the network profile
- Add TouchDesigner to allowed apps
- Open specific ports (UDP/TCP)

### Port Conflicts

Check if a port is in use:
```bash
netstat -ano | findstr :7000
```

### Common Issues

| Problem | Solution |
|---------|----------|
| OSC not receiving | Check port, firewall, `active` parameter |
| DMX flickering | Lower `rate` to 44Hz or below |
| MIDI not detected | Check MIDI Device Mapper in Dialogs menu |
| Serial not connecting | Verify COM port, baud rate, cable |
| NDI source not found | Check `extraips` for remote machines |

### Debugging Tools

- **Wireshark** — Network packet analysis (filter: `osc`, `artnet`, `dmx`)
- **Info CHOP** — Attach to network operators for status
- **Textport** — Print debug messages

---

## Complete Operator List

### CHOPs
`oscInCHOP`, `oscOutCHOP`, `midiinCHOP`, `midioutCHOP`, `midiinmapCHOP`, `dmxinCHOP`, `dmxoutCHOP`, `udpinCHOP`, `udpoutCHOP`, `tcpipCHOP`, `serialCHOP`, `pipeinCHOP`, `pipeoutCHOP`, `sharedmeminCHOP`, `sharedmemoutCHOP`

### DATs
`oscInDAT`, `oscOutDAT`, `midiinDAT`, `midievtDAT`, `serialDAT`, `udpinDAT`, `udpoutDAT`, `tcpipDAT`, `websocketDAT`, `webDAT`, `webrtcDAT`, `mqttclientDAT`, `artnetDAT`

### TOPs
`ndiinTOP`, `ndioutTOP`, `syphonSpoutInTOP`

### COMPs
`videostreamInCOMP`, `videostreamOutCOMP`, `syphonSpoutCOMP`
