"""Single-pair relay. Bind locally behind an HTTPS reverse proxy; never expose plain HTTP."""
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Relay(BaseHTTPRequestHandler):
    token = ''
    state = None
    lock = threading.Lock()

    def reply(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        if self.path != '/state':
            self.reply(404, {'error': 'unknown endpoint'})
            return False
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer '+self.token):
            self.reply(401, {'error': 'unauthorized'})
            return False
        return True

    def do_GET(self):
        if not self.authorized():
            return
        with self.lock:
            state = self.state
        self.reply(200 if state else 404, state or {'error': 'no boat state yet'})

    def do_PUT(self):
        if not self.authorized():
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > 65536:
                self.reply(413, {'error': 'invalid size'})
                return
            state = json.loads(self.rfile.read(size))
            if not isinstance(state, dict) or state.get('protocol') != 'nautic-twin-v1':
                raise ValueError()
            if not isinstance(state.get('sentAt'), int) or any(not isinstance(state.get('camera'+id), dict) for id in ('42', '44')):
                raise ValueError()
        except (ValueError, UnicodeError):
            self.reply(400, {'error': 'invalid telemetry'})
            return
        with self.lock:
            type(self).state = state
        self.reply(200, {'ok': True})

    def log_message(self, *args):
        pass

if __name__ == '__main__':
    Relay.token = os.environ.get('NAUTIC_TWIN_TOKEN', '')
    if len(Relay.token) < 24:
        raise SystemExit('Set NAUTIC_TWIN_TOKEN to a random shared secret of at least 24 characters')
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('NAUTIC_TWIN_PORT', '8787'))), Relay).serve_forever()
