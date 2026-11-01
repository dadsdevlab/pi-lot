const thread = document.querySelector("#thread");
const form = document.querySelector("#composer");
const input = document.querySelector("#input");
const send = document.querySelector("#send");
const model = document.querySelector("#model");
const think = document.querySelector("#think");
const selection = document.querySelector("#selection");
const inTokens = document.querySelector("#in-tokens");
const outTokens = document.querySelector("#out-tokens");
const context = document.querySelector("#context");

const host = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
const windows = { "pi-lot-small": 8000, "pi-lot": 32000, "pi-lot-large": 128000 };
let tokensIn = 0;
let tokensOut = 0;
let contextWindow = windows["pi-lot"];
let turn = null;
let filling = false;

const starters = [
  "Explain this file",
  "Find the bug",
  "Draft a commit message",
];

let busy = false;

function scrollThread() {
  thread.scrollTop = thread.scrollHeight;
}

function line(kind, text) {
  const p = document.createElement("p");
  if (kind === "system") {
    p.className = "system";
    p.textContent = text;
  } else {
    const who = document.createElement("b");
    who.className = kind === "user" ? "me" : "buddy";
    who.textContent = kind === "user" ? "You: " : "Pi-lot: ";
    p.append(who, document.createTextNode(text));
  }
  thread.append(p);
  scrollThread();
  return p;
}

function replyLine() {
  const p = document.createElement("p");
  const who = document.createElement("b");
  who.className = "buddy";
  who.textContent = "Pi-lot: ";
  const dots = document.createElement("span");
  dots.className = "dots";
  dots.setAttribute("aria-label", "still working");
  const body = document.createTextNode("");
  p.append(who, dots, body);
  return { p, dots, body };
}

function thinkBlock(after) {
  const details = document.createElement("details");
  details.className = "think-block";
  details.open = true;
  details.innerHTML = "<summary>Thinking</summary><p></p>";
  after.after(details);
  return { details, thought: details.querySelector("p") };
}

function assistantTurn(reply, thought, open) {
  const row = line("assistant", reply);
  const block = thinkBlock(row);
  block.details.open = open;
  block.thought.textContent = thought;
}

function count(text) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function showExample() {
  thread.replaceChildren();
  const user = "Explain this file";
  const thought = "The file is a chat mock, not the extension. They want the layout, not a rewrite.";
  const reply = "This is the Pi-lot side panel: a transcript, a composer, and a status bar for tokens.";
  line("user", user);
  assistantTurn(reply, thought, false);
  tokensIn = count(user);
  tokensOut = count(thought) + count(reply);
  paintUsage();
}

function showEmpty() {
  thread.replaceChildren();
  line("system", "You have just entered a chat with Pi-lot.");
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const label of starters) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => ask(label));
    chips.append(button);
  }
  thread.append(chips);
  tokensIn = 0;
  tokensOut = 0;
  paintUsage();
}

function paintUsage() {
  const used = tokensIn + tokensOut;
  const pct = Math.min(100, Math.round((used / (windows[model.value] || contextWindow)) * 100));
  inTokens.textContent = `In: ${tokensIn}`;
  outTokens.textContent = `Out: ${tokensOut}`;
  context.textContent = `Ctx: ${pct}%`;
  selection.textContent = `${model.value} ${think.value}`;
}

function replyFor(text) {
  const lower = text.toLowerCase();
  if (lower.includes("commit")) return "fix: keep the chat panel in the secondary sidebar";
  if (lower.includes("bug")) return "Nothing is wired to a model yet. This reply is the mock.";
  return `brb, pretending to know about "${text}"`;
}

function beginTurn(value) {
  busy = true;
  send.disabled = true;
  if (thread.querySelector(".chips")) thread.querySelector(".chips").remove();
  line("user", value);
  input.value = "";
  const current = replyLine();
  thread.append(current.p);
  scrollThread();
  turn = { blocks: [], pending: null, current };
}

function fillSelect(select, items, selected) {
  filling = true;
  select.replaceChildren();
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === selected;
    select.append(option);
  }
  filling = false;
  paintUsage();
}

function ask(text) {
  const value = text.trim();
  if (!value || busy) return;
  if (host) {
    beginTurn(value);
    host.postMessage({ type: "prompt", text: value });
    return;
  }
  busy = true;
  send.disabled = true;
  if (thread.querySelector(".chips")) thread.querySelector(".chips").remove();
  line("user", value);
  input.value = "";
  tokensIn += count(value);
  paintUsage();
  outTokens.textContent = "Out: …";
  const current = replyLine();
  thread.append(current.p);
  scrollThread();
  setTimeout(() => {
    const reply = replyFor(value);
    const thought = `${think.value}: looked at "${value}" and kept the answer short.`;
    current.dots.remove();
    current.body.data = reply;
    const block = thinkBlock(current.p);
    block.details.open = false;
    block.thought.textContent = thought;
    tokensOut += count(thought) + count(reply);
    paintUsage();
    busy = false;
    send.disabled = false;
    input.focus();
  }, 500);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  ask(input.value);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelector("#new-chat").addEventListener("click", () => {
  if (host) {
    host.postMessage({ type: "new" });
    return;
  }
  busy = false;
  send.disabled = false;
  input.value = "";
  showEmpty();
  input.focus();
});

model.addEventListener("change", () => {
  if (filling) return;
  if (host) {
    const [provider, id] = model.value.split("\t");
    host.postMessage({ type: "model", provider, id });
    return;
  }
  paintUsage();
  if (!thread.querySelector(".chips")) line("system", `Switched to ${model.value} ${think.value}.`);
});

think.addEventListener("change", () => {
  if (filling) return;
  if (host) {
    host.postMessage({ type: "think", level: think.value });
    return;
  }
  paintUsage();
  if (!thread.querySelector(".chips")) line("system", `Switched to ${model.value} ${think.value}.`);
});

if (host) {
  thread.replaceChildren();
  line("system", "Connecting to Pi…");
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "models") {
      contextWindow = msg.contextWindow || contextWindow;
      fillSelect(model, msg.models.map((item) => ({ value: `${item.provider}\t${item.id}`, label: item.name })), msg.model);
      fillSelect(think, msg.thinking.map((level) => ({ value: level, label: level })), msg.think);
      const usage = msg.stats?.tokens;
      const ctx = msg.stats?.contextUsage;
      if (usage) {
        tokensIn = usage.input || 0;
        tokensOut = usage.output || 0;
        paintUsage();
        if (ctx?.percent != null) context.textContent = `Ctx: ${Math.round(ctx.percent)}%`;
      }
      if (thread.querySelector(".system")?.textContent === "Connecting to Pi…") showEmpty();
    } else if (msg.type === "thinking" && turn) {
      if (!turn.pending) {
        turn.pending = thinkBlock(turn.current.p);
        turn.blocks.push(turn.pending);
      }
      turn.pending.thought.textContent += msg.delta;
      scrollThread();
    } else if (msg.type === "text" && turn) {
      turn.current.dots.remove();
      turn.current.body.data += msg.delta;
      scrollThread();
    } else if (msg.type === "final" && turn) {
      if (msg.thought) {
        if (!turn.pending) {
          turn.pending = thinkBlock(turn.current.p);
          turn.blocks.push(turn.pending);
        }
        turn.pending.thought.textContent = msg.thought;
      }
      if (msg.text) {
        turn.current.dots.remove();
        turn.current.body.data = msg.text;
        turn.pending = null;
        turn.current = replyLine();
        thread.append(turn.current.p);
      }
      scrollThread();
    } else if (msg.type === "settled") {
      if (turn) {
        for (const block of turn.blocks) block.details.open = false;
        if (!turn.current.body.data) turn.current.p.remove();
      }
      turn = null;
      busy = false;
      send.disabled = false;
      input.focus();
    } else if (msg.type === "cleared") {
      turn = null;
      busy = false;
      send.disabled = false;
      showEmpty();
      input.focus();
    } else if (msg.type === "error") {
      line("system", msg.text);
      busy = false;
      send.disabled = false;
    }
  });
} else {
  showExample();
}
