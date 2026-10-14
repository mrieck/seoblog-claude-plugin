// Structural checks on the skill and command markdown: frontmatter, relative
// links, and the humanize pattern list (numbering, §references, length).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(plugin, "skills");
const commandsDir = path.join(plugin, "commands");
const HUMANIZE_MAX_WORDS = 4500;

function skillDirs() {
  return readdirSync(skillsDir).filter((d) => statSync(path.join(skillsDir, d)).isDirectory());
}

function frontmatter(file) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${file} has no frontmatter`);
  const fm = m[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  // Folded (>-) and literal (|) block scalars continue on indented lines; stop at the next top-level key.
  const description = fm.match(/(?:^|\n)description:\s*([\s\S]*?)(?=\n\S|$)/)?.[1]?.replace(/^[>|]-?\s*/, "").replace(/\s+/g, " ").trim();
  return { name, description, body: text.slice(m[0].length) };
}

function markdownFiles() {
  const files = [];
  for (const d of skillDirs()) {
    for (const f of readdirSync(path.join(skillsDir, d))) if (f.endsWith(".md")) files.push(path.join(skillsDir, d, f));
  }
  for (const f of readdirSync(commandsDir)) if (f.endsWith(".md")) files.push(path.join(commandsDir, f));
  return files;
}

test("every skill has a name matching its directory and a description", () => {
  for (const d of skillDirs()) {
    const { name, description } = frontmatter(path.join(skillsDir, d, "SKILL.md"));
    assert.equal(name, d, `skills/${d}/SKILL.md name`);
    assert.ok(description && description.length > 20, `skills/${d}/SKILL.md description`);
  }
});

test("relative markdown links in skills and commands resolve", () => {
  const broken = [];
  for (const file of markdownFiles()) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\]\((\.{1,2}\/[^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = path.resolve(path.dirname(file), m[1]);
      if (!existsSync(target)) broken.push(`${path.relative(plugin, file)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("humanize pattern list is numbered 1..N, §refs are in range, and the skill stays short", () => {
  const file = path.join(skillsDir, "humanize", "SKILL.md");
  const text = readFileSync(file, "utf8");
  const numbers = [...text.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1]));
  assert.ok(numbers.length >= 20, "expected at least 20 patterns");
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1), "pattern headings must run 1..N with no gaps");
  const max = numbers.length;
  const refs = [...text.matchAll(/§(\d+)/g)].map((m) => Number(m[1]));
  const outOfRange = refs.filter((n) => n < 1 || n > max);
  assert.deepEqual(outOfRange, [], `§references out of 1..${max}`);
  const words = text.split(/\s+/).filter(Boolean).length;
  assert.ok(words <= HUMANIZE_MAX_WORDS, `humanize/SKILL.md is ${words} words (max ${HUMANIZE_MAX_WORDS}); it is read on every run`);
  assert.ok(existsSync(path.join(skillsDir, "humanize", "NOTICE.md")), "MIT attribution notice missing");
});

test("both orchestrators run humanize between write and images", () => {
  for (const [skill, pattern] of [
    ["seo-blog", /write → humanize\s*\n?\s*→ images/],
    ["social-article", /write \(markdown\) → humanize\s*\n?\s*→ images/],
  ]) {
    const { body } = frontmatter(path.join(skillsDir, skill, "SKILL.md"));
    assert.match(body, pattern, `${skill} pipeline diagram`);
    assert.match(body, /\]\(\.\.\/humanize\/SKILL\.md\)/, `${skill} links the humanize skill`);
    assert.match(body, /\*\*HUMANIZE\*\*/, `${skill} has a HUMANIZE step`);
  }
  const writing = readFileSync(path.join(skillsDir, "seo-writing", "SKILL.md"), "utf8");
  assert.match(writing, /## Write like a person/);
});
