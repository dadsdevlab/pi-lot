import * as vscode from "vscode";
import { PiRpc, type PiEvent } from "./pi-rpc";

const viewId = "pi-lot.chat";

export function activate(context: vscode.ExtensionContext) {
  const pi = new PiRpc();
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionUri.fsPath;
  let webview: vscode.Webview | undefined;
  let tools = "";

  const post = (message: unknown) => webview?.postMessage(message);

  pi.onExit = (error) => post({ type: "error", text: error.message });
  pi.onEvent = (event) => {
    const message = toView(event, () => tools, (next) => (tools = next));
    if (message) post(message);
    if (event.type === "agent_settled") {
      void sendModels(pi, post).catch((error: Error) => post({ type: "error", text: error.message }));
    }
  };
  pi.start(cwd);

  context.subscriptions.push({ dispose: () => pi.stop() });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(viewId, new ChatView(context.extensionUri, pi, (next) => {
      webview = next;
      void sendModels(pi, post).catch((error: Error) => post({ type: "error", text: error.message }));
    })),
    vscode.commands.registerCommand("pi-lot.open", () =>
      vscode.commands.executeCommand(`${viewId}.focus`),
    ),
  );
}

class ChatView implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly pi: PiRpc,
    private readonly onView: (webview: vscode.Webview) => void,
  ) {}

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    const webview = webviewView.webview;
    const poc = vscode.Uri.joinPath(this.extensionUri, "poc");
    webview.options = { enableScripts: true, localResourceRoots: [poc] };
    webview.html = await panelHtml(webview, poc);
    this.onView(webview);
    webview.onDidReceiveMessage((message) => void this.onMessage(webview, message));
  }

  private async onMessage(webview: vscode.Webview, message: { type?: string; text?: string; provider?: string; id?: string; level?: string }) {
    const post = (body: unknown) => webview.postMessage(body);
    try {
      if (message.type === "prompt" && message.text) {
        await this.pi.call("prompt", { message: message.text });
      } else if (message.type === "model" && message.provider && message.id) {
        await this.pi.call("set_model", { provider: message.provider, modelId: message.id });
        await sendModels(this.pi, post);
      } else if (message.type === "think" && message.level) {
        await this.pi.call("set_thinking_level", { level: message.level });
        await sendModels(this.pi, post);
      } else if (message.type === "new") {
        await this.pi.call("new_session");
        post({ type: "cleared" });
        await sendModels(this.pi, post);
      }
    } catch (error) {
      post({ type: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function sendModels(pi: PiRpc, post: (message: unknown) => void) {
  const [models, thinking, state, stats] = await Promise.all([
    pi.call("get_available_models"),
    pi.call("get_available_thinking_levels"),
    pi.call("get_state"),
    pi.call("get_session_stats"),
  ]);
  const model = (state as { model?: { provider?: string; id?: string; name?: string; contextWindow?: number } }).model;
  post({
    type: "models",
    models: ((models as { models?: unknown[] }).models ?? []).map((item) => {
      const model = item as { provider: string; id: string; name?: string; contextWindow?: number };
      return { provider: model.provider, id: model.id, name: model.name || model.id, contextWindow: model.contextWindow };
    }),
    thinking: (thinking as { levels?: string[] }).levels ?? [],
    model: model ? `${model.provider}\t${model.id}` : "",
    modelName: model?.name || model?.id || "",
    think: (state as { thinkingLevel?: string }).thinkingLevel ?? "off",
    contextWindow: model?.contextWindow,
    stats,
  });
}

function toView(event: PiEvent, tools: () => string, setTools: (next: string) => void) {
  const update = event.assistantMessageEvent as { type?: string; delta?: string } | undefined;
  if (event.type === "message_update" && update?.type === "thinking_delta") {
    return { type: "thinking", delta: update.delta ?? "" };
  }
  if (event.type === "message_update" && update?.type === "text_delta") {
    return { type: "text", delta: update.delta ?? "" };
  }
  if (event.type === "tool_execution_start") {
    const note = `\n[${event.toolName}]`;
    setTools(tools() + note);
    return { type: "thinking", delta: note };
  }
  if (event.type === "message_end") {
    const message = event.message as { role?: string; content?: unknown };
    if (message?.role !== "assistant") return undefined;
    return { type: "final", text: textOf(message.content), thought: thoughtOf(message.content) + tools() };
  }
  if (event.type === "agent_settled") {
    setTools("");
    return { type: "settled" };
  }
  if (event.type === "extension_error") return { type: "error", text: String(event.error) };
  return undefined;
}

function blocks(content: unknown, type: string) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && typeof block === "object" && (block as { type?: string }).type === type)
    .map((block) => String((block as { text?: string; thinking?: string }).text ?? (block as { thinking?: string }).thinking ?? ""))
    .join("");
}

function textOf(content: unknown) {
  return typeof content === "string" ? content : blocks(content, "text");
}

function thoughtOf(content: unknown) {
  return blocks(content, "thinking");
}

async function panelHtml(webview: vscode.Webview, poc: vscode.Uri) {
  const css = webview.asWebviewUri(vscode.Uri.joinPath(poc, "styles.css"));
  const js = webview.asWebviewUri(vscode.Uri.joinPath(poc, "app.js"));
  const page = new TextDecoder().decode(
    await vscode.workspace.fs.readFile(vscode.Uri.joinPath(poc, "index.html")),
  );
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} https://unpkg.com data:`,
    "font-src https://unpkg.com",
    `script-src ${webview.cspSource}`,
  ].join("; ");
  return page
    .replace("<html lang=\"en\">", "<html lang=\"en\" class=\"extension\">")
    .replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`)
    .replace('href="styles.css"', `href="${css}"`)
    .replace('src="app.js"', `src="${js}"`);
}
