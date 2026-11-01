import assert from "node:assert/strict";
import test from "node:test";
import { pushLines } from "../out/lines.js";

test("splits on LF and keeps a partial line", () => {
  const lines = [];
  let buffer = pushLines("", "one\r\ntwo", (line) => lines.push(line));
  buffer = pushLines(buffer, "\nthree", (line) => lines.push(line));
  assert.deepEqual(lines, ["one", "two"]);
  assert.equal(buffer, "three");
});
