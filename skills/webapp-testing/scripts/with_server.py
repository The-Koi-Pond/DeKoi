#!/usr/bin/env python3
"""
Start one or more local servers, wait for them to be ready, run a command, then
clean up the started servers.

Example:
  python skills/webapp-testing/scripts/with_server.py \
    --server "pnpm dev --host 127.0.0.1 --port 5173" --port 5173 \
    -- python scratch/proof.py
"""

import argparse
import socket
import subprocess
import sys
import time


def is_server_ready(port: int, timeout: int) -> bool:
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.5)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a command with one or more temporary local servers",
    )
    parser.add_argument(
        "--server",
        action="append",
        dest="servers",
        required=True,
        help="Server command. Can be repeated.",
    )
    parser.add_argument(
        "--port",
        action="append",
        dest="ports",
        type=int,
        required=True,
        help="Port for the matching --server. Can be repeated.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Timeout in seconds per server. Default: 30.",
    )
    parser.add_argument(
        "command",
        nargs=argparse.REMAINDER,
        help="Command to run after all servers are ready.",
    )
    args = parser.parse_args()

    command = args.command[1:] if args.command and args.command[0] == "--" else args.command
    if not command:
        print("Error: no command specified to run", file=sys.stderr)
        sys.exit(1)

    if len(args.servers) != len(args.ports):
        print("Error: number of --server and --port values must match", file=sys.stderr)
        sys.exit(1)

    server_processes: list[subprocess.Popen[bytes]] = []
    try:
        for index, (server_command, port) in enumerate(zip(args.servers, args.ports), start=1):
            print(f"Starting server {index}/{len(args.servers)}: {server_command}")
            process = subprocess.Popen(
                server_command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            server_processes.append(process)

            print(f"Waiting for server on port {port}...")
            if not is_server_ready(port, args.timeout):
                raise RuntimeError(
                    f"Server failed to start on port {port} within {args.timeout}s",
                )
            print(f"Server ready on port {port}")

        print(f"\nAll {len(server_processes)} server(s) ready")
        print(f"Running: {' '.join(command)}\n")
        result = subprocess.run(command, check=False)
        sys.exit(result.returncode)
    finally:
        print(f"\nStopping {len(server_processes)} server(s)...")
        for index, process in enumerate(server_processes, start=1):
            try:
                process.terminate()
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            print(f"Server {index} stopped")
        print("All servers stopped")


if __name__ == "__main__":
    main()
