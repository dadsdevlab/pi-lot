import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { pushLines } from "./lines";

export type PiEvent = { type: string; [key: string]: unknown };

export class PiRpc {
  private child: ChildProcessWithoutNullStreams | undefined;
  private buffer = "";
  private seq = 0;
  private pending = new Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void }>();
  onEvent: (event: PiEvent) => void = () => {};
  onExit: (error: Error) => void = () => {};

  start(cwd: string) {
    this.child = spawn("pi", ["--mode", "rpc", "--no-session"], {
      cwd,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer = pushLines(this.buffer, chunk, (line) => this.onLine(line));
    });
    this.child.on("error", (error) => this.failAll(error));
    this.child.on("exit", (code) => this.failAll(new Error(`pi exited (${code ?? "signal"})`)));
  }

  call(type: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    const id = String(++this.seq);
    const child = this.child;
    if (!child?.stdin.writable) return Promise.reject(new Error("pi is not running"));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, type, ...extra }) + "\n");
    });
  }

  stop() {
    this.child?.kill();
  }

  private onLine(line: string) {
    let msg: PiEvent;
    try {
      msg = JSON.parse(line) as PiEvent;
    } catch {
      return;
    }
    const id = typeof msg.id === "string" ? msg.id : undefined;
    if (msg.type === "response" && id && this.pending.has(id)) {
      const waiter = this.pending.get(id)!;
      this.pending.delete(id);
      if (msg.success) waiter.resolve(msg.data);
      else waiter.reject(new Error(errorText(msg.error)));
      return;
    }
    if (msg.type !== "response") this.onEvent(msg);
  }

  private failAll(error: Error) {
    this.onExit(error);
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }
}

function errorText(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "pi command failed";
}
