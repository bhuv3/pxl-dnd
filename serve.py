# Serves the pxl-map folder (map editor and game) on http://localhost:8765, telling browsers to check every file
# for changes before using a cached copy, so a reload never mixes old scripts with new ones.
# Run from anywhere: python3 serve.py   (in the pxl-map folder)
import functools
import http.server
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8765


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(NoCache, directory=ROOT)
    print(f'Serving {ROOT} on http://localhost:{PORT}')
    http.server.ThreadingHTTPServer(('', PORT), handler).serve_forever()
