#!/usr/bin/env python3
"""Statische server voor Splitsracer.

Serveert de projectmap, maar blokkeert verborgen bestanden (zoals .git) en
mapoverzichten. Alleen de Python 3-stdlib is nodig.

Voorbeelden:
    python3 tools/serve.py --bind 127.0.0.1 --port 8080
    python3 tools/serve.py --bind 0.0.0.0 --port 8080
"""
from __future__ import annotations

import argparse
import functools
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class SafeRequestHandler(SimpleHTTPRequestHandler):
    """Serveert alleen zichtbare bestanden en geeft geen mapoverzichten."""

    def _blocked(self) -> bool:
        path = unquote(urlsplit(self.path).path)
        return any(part.startswith(".") for part in path.split("/") if part)

    def do_GET(self):
        if self._blocked():
            self.send_error(404, "Not Found")
            return
        super().do_GET()

    def do_HEAD(self):
        if self._blocked():
            self.send_error(404, "Not Found")
            return
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404, "Not Found")
        return None


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def lan_ip() -> str:
    """Bepaal het LAN-IP zonder daadwerkelijk verkeer te versturen."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.168.1.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Veilige statische server voor Splitsracer")
    parser.add_argument("--bind", default="0.0.0.0", help="adres om op te luisteren")
    parser.add_argument("--port", type=int, default=8080, help="poort (standaard 8080)")
    parser.add_argument("--directory", default=ROOT, help="map om te serveren")
    args = parser.parse_args()

    directory = os.path.abspath(args.directory)
    handler = functools.partial(SafeRequestHandler, directory=directory)
    server = Server((args.bind, args.port), handler)

    host = "localhost" if args.bind in ("127.0.0.1", "localhost") else lan_ip()
    print(f"Splitsracer draait op http://{host}:{args.port}/", flush=True)
    print(f"Projectmap: {directory}", flush=True)
    print("Verborgen bestanden en mapoverzichten zijn geblokkeerd.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gestopt.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
