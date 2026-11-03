from json import loads, dumps
from io import StringIO
from datetime import datetime
import hmac
import ipaddress
import os
import secrets
import sys
import tempfile
import traceback
import json

from CallbacksExt import CallbacksExt
from AcroVersionExt import AcroVersionExt

from TDStoreTools import StorageManager
import TDJSON
TDF = op.TDModules.mod.TDFunctions


def _header(request, name):
    """Case-insensitive lookup of an HTTP header in the webserverDAT request dict."""
    name = name.lower()
    for key, value in request.items():
        if isinstance(key, str) and key.lower() == name:
            return str(value)
    return ''


def _hostPart(address):
    """Strip the port from 'host:port' or '[v6]:port'."""
    address = (address or '').strip()
    if address.startswith('['):
        return address[1:].split(']', 1)[0]
    if address.count(':') == 1:
        return address.split(':', 1)[0]
    return address


def _isLoopbackClient(address):
    """True if the client address (as reported by the webserverDAT) is this machine."""
    try:
        ip = ipaddress.ip_address(_hostPart(address))
    except ValueError:
        return False
    if getattr(ip, 'ipv4_mapped', None):
        ip = ip.ipv4_mapped
    return ip.is_loopback


def _isLoopbackHost(host):
    """True if the Host header names this machine. Blocks DNS rebinding."""
    return _hostPart(host).lower() in ('localhost', '127.0.0.1', '::1')


class AcroMCP(CallbacksExt, AcroVersionExt):

    """ TouchDesigner MCP bridge - HTTP API for external tools """

    def __init__(self, ownerComp):
        # the component to which this extension is attached
        self.ownerComp = ownerComp

        # init callbacks
        self.callbackDat = self.ownerComp.par.Callbackdat.eval()
        try:
            CallbacksExt.__init__(self, ownerComp)
        except:
            self.ownerComp.addScriptError(traceback.format_exc() + \
                    "Error in CallbacksExt __init__. See textport.")
            print()
            print("Error initializing callbacks - " + self.ownerComp.path)
            print(traceback.format_exc())
        # run onInit callback
        try:
            self.DoCallback('onInit', {'ownerComp':self.ownerComp})
        except:
            self.ownerComp.addScriptError(traceback.format_exc() + \
                    "Error in custom onInit callback. See textport.")
            print(traceback.format_exc())

        # the component to which data is stored
        self.dataComp = ownerComp.op('data')

        # stored items (persistent across saves and re-initialization):
        storedItems = [
            # Only 'name' is required...
            {'name': 'Data', 'default': None, 'readOnly': False,
                                     'property': True, 'dependable': True},
        ]
        self.stored = StorageManager(self, self.dataComp, storedItems)

        # Initialize version tracking mixin (creates Version param page if needed)
        AcroVersionExt.__init__(self, ownerComp)

        # reference to webserver dat
        self.webserverDat = ownerComp.op('webserver')

        # route table: (method, path) -> handler
        self.routes = {
            ('GET', '/'):               self._handleHealth,
            ('POST', '/api/exec'):      self._handleExec,
            ('GET', '/api/op'):         self._handleOp,
            ('GET', '/api/children'):   self._handleChildren,
            ('GET', '/api/par'):        self._handleGetPar,
            ('POST', '/api/par'):       self._handleSetPar,
            ('GET', '/api/top'):                self._handleTopPreview,
            ('GET', '/api/editor/pane'):        self._handleEditorPane,
            ('GET', '/api/editor/selection'):   self._handleEditorSelection,
            ('GET', '/api/bounds'):     self._handleBounds,
            ('GET', '/api/layout'):     self._handleLayout,
            ('GET', '/api/errors'):     self._handleErrors,
            ('GET', '/api/find-empty'): self._handleFindEmpty,
            ('POST', '/api/panel/start'): self._handlePanelCaptureStart,
            ('GET', '/api/panel/result'): self._handlePanelCaptureResult,
            ('POST', '/api/panel/click'): self._handlePanelClick,
        }

        # Reference to persistent opviewer for panel captures (must exist in component)
        self._panelOpViewer = self.ownerComp.op('panel_opviewer')
        self._panelCaptureState = None

        # Per-session secret every request must carry. Set by _registerInstance();
        # until then all requests are rejected.
        self._token = None

        # Register this instance in the shared registry
        try:
            self._registerInstance()
        except Exception as e:
            print(f"AcroMCP: Failed to register instance: {e}")
            print(traceback.format_exc())

    # -------------------------------------------------------------------------
    # Instance Registry Management
    # -------------------------------------------------------------------------

    def _getRegistryPath(self):
        """Get path to the shared instance registry file."""
        return os.path.join(tempfile.gettempdir(), 'acro-td-mcp-instances.json')

    def _readRegistry(self):
        """Read the instance registry, return empty list if missing."""
        path = self._getRegistryPath()
        if not os.path.exists(path):
            return []
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                return data.get('instances', [])
        except (json.JSONDecodeError, IOError):
            return []

    def _writeRegistry(self, instances):
        """Write the instance registry, readable by this user only (it holds the tokens)."""
        path = self._getRegistryPath()
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump({'instances': instances}, f, indent=2)
        if os.name != 'nt':
            # os.open's mode only applies when it creates the file
            os.chmod(path, 0o600)

    def _isPortListening(self, port):
        """True if something already accepts connections on the port."""
        import socket
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.2):
                return True
        except OSError:
            return False

    def _isProcessAlive(self, pid):
        """True if a process with this PID is running."""
        if not pid:
            return False
        if os.name == 'nt':
            # os.kill(pid, 0) isn't a probe on Windows (signal 0 is CTRL_C_EVENT)
            import ctypes
            from ctypes import wintypes
            kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel32.OpenProcess.restype = wintypes.HANDLE
            kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
            kernel32.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
            kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
            handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if not handle:
                return ctypes.get_last_error() == 5  # ERROR_ACCESS_DENIED: running, not ours
            try:
                code = wintypes.DWORD()
                kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
                return code.value == 259  # STILL_ACTIVE
            finally:
                kernel32.CloseHandle(handle)
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        return True

    def _cleanStaleEntries(self, instances):
        """Remove entries whose process has exited."""
        # Not a port test: on Windows, binding localhost succeeds while another
        # TD's webserver listens on 0.0.0.0, so live instances looked stale and
        # the next instance took their port.
        return [inst for inst in instances if self._isProcessAlive(inst.get('pid'))]

    def _isPortReserved(self, port):
        """
        True if the OS refuses to bind the port at all - on Windows, a range
        reserved by WinNAT (Hyper-V, WSL, Docker). Such a port looks free to
        netstat, but the webserver can never listen on it.
        """
        import socket
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('0.0.0.0', port))
        except PermissionError:
            return True
        except OSError:
            # In use - possibly by this instance's own webserver. The registry
            # already tracks other instances.
            return False
        return False

    def _findAvailablePort(self, instances, start=54200, max_port=54209):
        """
        Find the lowest port not used by other instances, not reserved by the OS,
        and with nothing else listening on it. TD's webserver will share a port
        that's already in use, so a bind test alone can't catch that.
        """
        used_ports = {inst.get('port') for inst in instances}
        # This instance's webserver may already be listening on its saved port
        own_port = self.ownerComp.par.Webserverport.eval() if hasattr(self.ownerComp.par, 'Webserverport') else None
        for port in range(start, max_port + 1):
            if port in used_ports or self._isPortReserved(port):
                continue
            if port != own_port and self._isPortListening(port):
                continue
            return port
        raise RuntimeError(f"No available ports in range {start}-{max_port}")

    def _registerInstance(self):
        """Register this TD instance in the shared registry."""
        instances = self._readRegistry()
        # On re-init (e.g. after editing this file) keep this process's port and
        # token, so the MCP client isn't stranded. Then drop the old entry.
        my_pid = os.getpid()
        mine = next((inst for inst in instances if inst.get('pid') == my_pid), {})
        instances = [inst for inst in instances if inst.get('pid') != my_pid]
        instances = self._cleanStaleEntries(instances)

        port = mine.get('port')
        if not port or port in {inst.get('port') for inst in instances}:
            port = self._findAvailablePort(instances)
        self._token = mine.get('token') or secrets.token_urlsafe(32)

        # Set the webserver port parameter
        if hasattr(self.ownerComp.par, 'Webserverport'):
            self.ownerComp.par.Webserverport = port

        # Add this instance to registry
        instances.append({
            'port': port,
            'project_name': project.name,
            'project_path': project.folder.replace('\\', '/'),
            'pid': os.getpid(),
            'started': mine.get('started') or datetime.now().isoformat(),
            'token': self._token,
        })

        self._writeRegistry(instances)
        print("=" * 60)
        print(f"AcroMCP - registered on port {port}")
        print("=" * 60)

    def _unregisterInstance(self):
        """Remove this TD instance from the shared registry."""
        instances = self._readRegistry()
        my_pid = os.getpid()
        instances = [inst for inst in instances if inst.get('pid') != my_pid]
        self._writeRegistry(instances)

    def Destroy(self):
        """Called when component is destroyed - unregister from registry."""
        try:
            self._unregisterInstance()
        except Exception:
            pass  # Don't let cleanup errors prevent shutdown

    def onExit(self):
        """Called by AcroCore when TD is closing - unregister from registry."""
        try:
            self._unregisterInstance()
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # HTTP Router
    # -------------------------------------------------------------------------

    def _checkAccess(self, request):
        """
        Return (status, message) to reject the request, or None to allow it.

        The token is the real protection. The webserverDAT listens on every
        network interface and a 'clientAddress' request header can overwrite
        the address it reports, so the address and Host checks are defense in
        depth. The Host check blocks DNS rebinding; the Origin check keeps web
        pages out (the MCP server never sends one).
        """
        if not _isLoopbackClient(request.get('clientAddress', '')):
            return 403, 'AcroMCP only accepts requests from this machine'
        if not _isLoopbackHost(_header(request, 'Host')):
            return 403, 'AcroMCP only accepts requests addressed to localhost'
        if _header(request, 'Origin'):
            return 403, 'AcroMCP does not accept requests from web pages'
        scheme, _, token = _header(request, 'Authorization').partition(' ')
        if (not self._token or scheme.lower() != 'bearer'
                or not hmac.compare_digest(token.strip().encode(), self._token.encode())):
            return 401, 'Missing or wrong AcroMCP token (it is in the instance registry)'
        if request.get('method') == 'POST':
            contentType = _header(request, 'Content-Type').split(';')[0].strip().lower()
            if contentType != 'application/json':
                return 415, 'POST bodies must be sent as Content-Type: application/json'
        return None

    def onHTTPRequestWebServer(self, webServerDAT, request, response):
        rejection = self._checkAccess(request)
        if rejection:
            status, message = rejection
            if status == 401:
                response['WWW-Authenticate'] = 'Bearer'
            return self._jsonResponse(response, status, {'error': message})

        uri = request['uri'].split('?')[0]
        method = request['method']

        handler = self.routes.get((method, uri))
        if handler:
            try:
                self.DoCallback('onRequest', {
                    'method': method,
                    'uri': uri,
                    'pars': request.get('pars', {}),
                })
                result = handler(request, response)
                return result
            except Exception as e:
                self.DoCallback('onError', {
                    'method': method,
                    'uri': uri,
                    'error': str(e),
                })
                return self._jsonResponse(response, 500, {
                    'error': str(e),
                    'traceback': traceback.format_exc()
                })
        else:
            return self._jsonResponse(response, 404, {
                'error': f'Not found: {method} {uri}'
            })

    # -------------------------------------------------------------------------
    # Response Helpers
    # -------------------------------------------------------------------------

    def _jsonResponse(self, response, status, data):
        response['statusCode'] = status
        response['statusReason'] = 'OK' if status == 200 else 'Error'
        response['data'] = dumps(data, default=str)
        return response

    def _parseBody(self, request):
        body = request.get('data', b'')
        if not body:
            return {}
        if isinstance(body, bytes):
            body = body.decode('utf-8')
        return loads(body)

    def _getQueryParam(self, request, name, default=None):
        pars = request.get('pars', {})
        return pars.get(name, default)

    # -------------------------------------------------------------------------
    # Handlers
    # -------------------------------------------------------------------------

    def _handleHealth(self, request, response):
        return self._jsonResponse(response, 200, {
            'status': 'ok',
            'td_version': app.version,
            'td_build': app.build,
            'project': project.name,
            'osName': app.osName,
        })

    def _handleExec(self, request, response):
        body = self._parseBody(request)
        code = body.get('code', '')
        if not code:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "code" in request body'
            })

        from_op = body.get('from_op', '/')
        context = op(from_op)
        if context is None:
            return self._jsonResponse(response, 404, {
                'error': f'Context operator not found: {from_op}'
            })

        # capture stdout/stderr
        stdout_capture = StringIO()
        stderr_capture = StringIO()
        old_stdout, old_stderr = sys.stdout, sys.stderr

        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture

            # try eval first (expressions), fall back to exec (statements)
            try:
                result = eval(code)
                return self._jsonResponse(response, 200, {
                    'success': True,
                    'result': TDJSON.serializeTDData(result),
                    'type': type(result).__name__,
                    'stdout': stdout_capture.getvalue(),
                    'stderr': stderr_capture.getvalue(),
                    'from_op': context.path,
                })
            except SyntaxError:
                pass

            # eval failed with SyntaxError, try exec
            exec_globals = {'__builtins__': __builtins__, 'me': context}
            exec_locals = {}
            exec(code, exec_globals, exec_locals)
            result = {k: str(v) for k, v in exec_locals.items()
                      if not k.startswith('_')}
            return self._jsonResponse(response, 200, {
                'success': True,
                'result': result if result else None,
                'type': 'exec',
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue(),
                'from_op': context.path,
            })
        except Exception as e:
            return self._jsonResponse(response, 400, {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc(),
                'stdout': stdout_capture.getvalue(),
                'stderr': stderr_capture.getvalue(),
                'from_op': from_op,
            })
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    def _handleOp(self, request, response):
        path = self._getQueryParam(request, 'path')
        if not path:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path" query parameter'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        extra = self._getQueryParam(request, 'extra', '*')
        op_data = TDJSON.opToJSONOp(target, extraAttrs=extra)

        return self._jsonResponse(response, 200, {
            'op': {
                'name': target.name,
                'path': target.path,
                'type': target.OPType,
                'family': target.family,
                'params': op_data,
            }
        })

    def _handleChildren(self, request, response):
        path = self._getQueryParam(request, 'path', '/')
        depth = int(self._getQueryParam(request, 'depth', '1'))
        tags_str = self._getQueryParam(request, 'tags')

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        kwargs = {'maxDepth': depth}
        if tags_str:
            kwargs['tags'] = [t.strip() for t in tags_str.split(',')]

        children = target.findChildren(**kwargs)
        child_list = []
        for child in children:
            child_list.append({
                'name': child.name,
                'path': child.path,
                'type': child.OPType,
                'family': child.family,
            })

        return self._jsonResponse(response, 200, {
            'path': target.path,
            'children': child_list,
        })

    def _handleGetPar(self, request, response):
        path = self._getQueryParam(request, 'path')
        name = self._getQueryParam(request, 'name')
        if not path or not name:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path" and/or "name" query parameters'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        par = getattr(target.par, name, None)
        if par is None:
            return self._jsonResponse(response, 404, {
                'error': f'Parameter not found: {name} on {path}'
            })

        return self._jsonResponse(response, 200, {
            'name': par.name,
            'value': par.eval(),
            'default': par.default,
            'type': par.style,
            'label': par.label,
            'page': par.page.name,
        })

    def _handleSetPar(self, request, response):
        body = self._parseBody(request)
        path = body.get('path')
        name = body.get('name')
        value = body.get('value')

        if not path or not name or value is None:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path", "name", or "value" in request body'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        par = getattr(target.par, name, None)
        if par is None:
            return self._jsonResponse(response, 404, {
                'error': f'Parameter not found: {name} on {path}'
            })

        par.val = value
        return self._jsonResponse(response, 200, {
            'ok': True,
            'name': par.name,
            'value': par.eval(),
        })

    def _handleTopPreview(self, request, response):
        path = self._getQueryParam(request, 'path')
        if not path:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path" query parameter'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        if target.family != 'TOP':
            return self._jsonResponse(response, 400, {
                'error': f'Operator is not a TOP: {path} (family: {target.family})'
            })

        # save TOP to a temp PNG file
        tmp_dir = tempfile.gettempdir()
        filename = f'td_top_preview_{target.name}.png'
        filepath = os.path.join(tmp_dir, filename)
        target.save(filepath)

        return self._jsonResponse(response, 200, {
            'path': target.path,
            'name': target.name,
            'type': target.OPType,
            'width': target.width,
            'height': target.height,
            'file': filepath,
        })

    # -------------------------------------------------------------------------
    # Panel Capture (Two-Phase)
    # -------------------------------------------------------------------------

    def _resetPanelOpViewer(self):
        """Reset opviewer to idle state (scheduled via run() after capture).
        Does NOT clear state - state is cleared when starting a new capture."""
        if self._panelOpViewer:
            self._panelOpViewer.par.opviewer = ''
            self._panelOpViewer.par.resolutionw = 4
            self._panelOpViewer.par.resolutionh = 4

    def _setPanelResolution(self):
        """Set resolution after path is set."""
        if self._panelCaptureState is None:
            return
        target = op(self._panelCaptureState['target_path'])
        if target:
            self._panelOpViewer.par.resolutionw = target.width if hasattr(target, 'width') else 1920
            self._panelOpViewer.par.resolutionh = target.height if hasattr(target, 'height') else 1080
        # Schedule save with extra time for panel content to render
        run('args[0]._savePanelCapture()', self, delayFrames=2)

    def _savePanelCapture(self):
        """Save the captured image."""
        if self._panelCaptureState is None:
            return

        filepath = self._panelCaptureState['file']
        self._panelOpViewer.save(filepath)
        self._panelCaptureState['width'] = self._panelOpViewer.width
        self._panelCaptureState['height'] = self._panelOpViewer.height
        self._panelCaptureState['ready'] = True

        # Don't clear state here - keep it for polling. State is cleared when next capture starts.
        # Schedule opviewer reset
        run('args[0]._resetPanelOpViewer()', self, delayFrames=2)

    def _handlePanelCaptureStart(self, request, response):
        body = self._parseBody(request)
        path = body.get('path')
        if not path:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path" in request body'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        if target.family != 'COMP':
            return self._jsonResponse(response, 400, {
                'error': f'Operator is not a COMP: {path} (family: {target.family})'
            })

        # Check if capture in progress (not yet ready)
        if self._panelCaptureState is not None and not self._panelCaptureState.get('ready'):
            return self._jsonResponse(response, 409, {
                'error': 'Capture already in progress'
            })

        # Generate output filepath
        tmp_dir = tempfile.gettempdir()
        filename = f'td_panel_preview_{target.name}.png'
        filepath = os.path.join(tmp_dir, filename)

        # Store capture state
        self._panelCaptureState = {
            'target_path': target.path,
            'target_name': target.name,
            'target_type': target.OPType,
            'file': filepath,
            'ready': False,
        }

        # Frame 0: Set path only (resolution set after delay)
        self._panelOpViewer.par.opviewer = target.path

        # Schedule resolution set with extra time for panel to load
        run('args[0]._setPanelResolution()', self, delayFrames=2)

        return self._jsonResponse(response, 202, {
            'status': 'capturing',
            'file': filepath,
        })

    def _handlePanelCaptureResult(self, request, response):
        if self._panelCaptureState is None:
            return self._jsonResponse(response, 404, {
                'error': 'No capture in progress'
            })

        if not self._panelCaptureState.get('ready'):
            return self._jsonResponse(response, 202, {'status': 'capturing'})

        state = self._panelCaptureState
        return self._jsonResponse(response, 200, {
            'status': 'ready',
            'path': state['target_path'],
            'name': state['target_name'],
            'type': state['target_type'],
            'width': state['width'],
            'height': state['height'],
            'file': state['file'],
        })

    def _handlePanelClick(self, request, response):
        """Simulate a mouse click on a panel COMP at normalized coordinates."""
        body = self._parseBody(request)
        path = body.get('path')
        u = body.get('u')
        v = body.get('v')

        if not path:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path" in request body'
            })
        if u is None or v is None:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "u" and/or "v" coordinates in request body'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        if not hasattr(target, 'interactMouse'):
            return self._jsonResponse(response, 400, {
                'error': f'Operator does not support interactMouse(): {path} (type: {target.OPType})'
            })

        # Optional parameters - use leftClick/middleClick/rightClick for number of clicks
        click_count = body.get('clickCount', 1)
        left = body.get('left', True)
        middle = body.get('middle', False)
        right = body.get('right', False)

        # Convert button flags to click counts for interactMouse
        left_click = click_count if left else 0
        middle_click = click_count if middle else 0
        right_click = click_count if right else 0

        try:
            target.interactMouse(u, v, leftClick=left_click, middleClick=middle_click, rightClick=right_click)
            return self._jsonResponse(response, 200, {
                'ok': True,
                'path': target.path,
                'u': u,
                'v': v,
                'clickCount': click_count,
            })
        except Exception as e:
            return self._jsonResponse(response, 500, {
                'error': str(e),
                'traceback': traceback.format_exc()
            })

    def _handleEditorPane(self, request, response):
        try:
            pane = ui.panes.current
            if pane is None or pane.type != PaneType.NETWORKEDITOR:
                return self._jsonResponse(response, 200, {'pane': None})

            return self._jsonResponse(response, 200, {
                'pane': {
                    'networkPath': pane.owner.path,
                    'x': pane.x,
                    'y': pane.y,
                    'zoom': pane.zoom,
                    'name': pane.name,
                }
            })
        except Exception as e:
            return self._jsonResponse(response, 200, {'pane': None})

    def _handleEditorSelection(self, request, response):
        try:
            pane = ui.panes.current
            if pane is None or pane.owner is None:
                return self._jsonResponse(response, 200, {'operators': []})

            operators = []
            for o in pane.owner.selectedChildren:
                operators.append({
                    'path': o.path,
                    'name': o.name,
                    'type': o.OPType,
                    'family': o.family,
                })

            return self._jsonResponse(response, 200, {
                'operators': operators,
            })
        except Exception as e:
            return self._jsonResponse(response, 200, {'operators': []})

    # -------------------------------------------------------------------------
    # Utility Helpers
    # -------------------------------------------------------------------------

    def _getBounds(self, target):
        """Get AABB bounding box for an operator including its docked ops."""
        x = target.nodeX
        y = target.nodeY
        w = target.nodeWidth
        h = target.nodeHeight

        min_x, min_y = x, y
        max_x, max_y = x + w, y + h

        docked = []
        for d in target.docked:
            dx, dy = d.nodeX, d.nodeY
            dw, dh = d.nodeWidth, d.nodeHeight
            min_x = min(min_x, dx)
            min_y = min(min_y, dy)
            max_x = max(max_x, dx + dw)
            max_y = max(max_y, dy + dh)
            docked.append({
                'name': d.name, 'path': d.path,
                'x': dx, 'y': dy, 'width': dw, 'height': dh,
            })

        return {
            'x': min_x, 'y': min_y,
            'width': max_x - min_x, 'height': max_y - min_y,
            'docked': docked,
        }

    def _getAllBounds(self, base):
        """Get bounds for all direct children of a component."""
        results = []
        for child in base.findChildren(maxDepth=1):
            b = self._getBounds(child)
            b['name'] = child.name
            b['path'] = child.path
            results.append(b)
        return results

    def _checkOverlap(self, b1, b2):
        """Test if two AABB bounding boxes overlap."""
        if b1['x'] + b1['width'] <= b2['x']:
            return False
        if b2['x'] + b2['width'] <= b1['x']:
            return False
        if b1['y'] + b1['height'] <= b2['y']:
            return False
        if b2['y'] + b2['height'] <= b1['y']:
            return False
        return True

    def _findEmptyArea(self, base, w, h, start_x=0, start_y=0, margin=50):
        """Find a clear position in base that doesn't overlap existing children."""
        all_bounds = self._getAllBounds(base)

        if not all_bounds:
            return [start_x, start_y]

        # generate candidate positions: start pos + offset from each child
        candidates = [(start_x, start_y)]
        for b in all_bounds:
            # to the right of this child
            candidates.append((b['x'] + b['width'] + margin, b['y']))
            # below this child
            candidates.append((b['x'], b['y'] + b['height'] + margin))

        # sort by distance from start position
        candidates.sort(key=lambda c: (c[0] - start_x)**2 + (c[1] - start_y)**2)

        for cx, cy in candidates:
            test = {'x': cx, 'y': cy, 'width': w, 'height': h}
            # add margin to existing bounds for overlap test
            overlaps = False
            for b in all_bounds:
                padded = {
                    'x': b['x'] - margin, 'y': b['y'] - margin,
                    'width': b['width'] + margin * 2,
                    'height': b['height'] + margin * 2,
                }
                if self._checkOverlap(test, padded):
                    overlaps = True
                    break
            if not overlaps:
                return [cx, cy]

        # fallback: place far to the right of rightmost child
        max_right = max(b['x'] + b['width'] for b in all_bounds)
        return [max_right + margin, start_y]

    # -------------------------------------------------------------------------
    # Utility Route Handlers
    # -------------------------------------------------------------------------

    def _handleBounds(self, request, response):
        path = self._getQueryParam(request, 'path')
        if not path:
            return self._jsonResponse(response, 400, {
                'error': 'Missing "path" query parameter'
            })

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        bounds = self._getBounds(target)
        return self._jsonResponse(response, 200, {
            'path': target.path,
            'name': target.name,
            'bounds': bounds,
        })

    def _handleLayout(self, request, response):
        path = self._getQueryParam(request, 'path', '/')
        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        children = []
        for child in target.findChildren(maxDepth=1):
            children.append({
                'name': child.name,
                'path': child.path,
                'type': child.OPType,
                'family': child.family,
                'x': child.nodeX,
                'y': child.nodeY,
                'width': child.nodeWidth,
                'height': child.nodeHeight,
            })

        # sort by X then Y
        children.sort(key=lambda c: (c['x'], c['y']))

        return self._jsonResponse(response, 200, {
            'path': target.path,
            'children': children,
        })

    def _handleErrors(self, request, response):
        path = self._getQueryParam(request, 'path', '/')
        recurse_str = self._getQueryParam(request, 'recurse', 'true')
        recurse = recurse_str.lower() != 'false'

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        errors_list = []

        def collect(o):
            err_str = o.errors()
            warn_str = o.warnings()
            errs = err_str.split('\n') if err_str else []
            warns = warn_str.split('\n') if warn_str else []
            errs = [e.strip() for e in errs if e.strip()]
            warns = [w.strip() for w in warns if w.strip()]
            if errs or warns:
                errors_list.append({
                    'path': o.path,
                    'name': o.name,
                    'type': o.OPType,
                    'errors': errs,
                    'warnings': warns,
                })

        collect(target)
        if recurse and hasattr(target, 'findChildren'):
            for child in target.findChildren():
                collect(child)

        return self._jsonResponse(response, 200, {
            'path': target.path,
            'count': len(errors_list),
            'errors': errors_list,
        })

    def _handleFindEmpty(self, request, response):
        path = self._getQueryParam(request, 'path', '/')
        w = int(self._getQueryParam(request, 'w', '300'))
        h = int(self._getQueryParam(request, 'h', '200'))
        margin = int(self._getQueryParam(request, 'margin', '50'))

        target = op(path)
        if target is None:
            return self._jsonResponse(response, 404, {
                'error': f'Operator not found: {path}'
            })

        position = self._findEmptyArea(target, w, h, margin=margin)

        return self._jsonResponse(response, 200, {
            'path': target.path,
            'position': {'x': position[0], 'y': position[1]},
        })

    # -------------------------------------------------------------------------
    # WebSocket Handlers (unchanged)
    # -------------------------------------------------------------------------

    def onWebSocketOpenWebServer(self, webServerDAT, client, uri):
        return

    def onWebSocketCloseWebServer(self, webServerDAT, client):
        return

    def onWebSocketReceiveTextWebServer(self, webServerDAT, client, data):
        webServerDAT.webSocketSendText(client, data)
        return

    def onWebSocketReceiveBinaryWebServer(self, webServerDAT, client, data):
        webServerDAT.webSocketSendBinary(client, data)
        return

    def onWebSocketReceivePingWebServer(self, webServerDAT, client, data):
        webServerDAT.webSocketSendPong(client, data=data)
        return

    def onWebSocketReceivePongWebServer(self, webServerDAT, client, data):
        return

    def onServerStartWebServer(self, webServerDAT):
        return

    def onServerStopWebServer(self, webServerDAT):
        return

    # pulse parameter to open extension
    def pulse_Editextension(self):
        self.ownerComp.op('AcroMCP').par.edit.pulse()
