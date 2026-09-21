import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "seoblog compatibility "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const plugin = path.join(root, "installed plugin");
  cpSync(path.join(source, "scripts"), path.join(plugin, "scripts"), { recursive: true });
  writeFileSync(path.join(plugin, "package.json"), '{"type":"module"}');
  const configDir = path.join(root, "config", "seoblog");
  mkdirSync(configDir, { recursive: true });
  const mock = path.join(root, "mock.mjs");
  writeFileSync(mock, `
    import { writeFileSync } from 'node:fs';
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const original = childProcess.execFileSync;
    childProcess.execFileSync = (file, ...args) => {
      if (file === 'security') throw new Error('No test keychain');
      return original(file, ...args);
    };
    syncBuiltinESMExports();
    globalThis.fetch = async (url, opts = {}) => {
      if (new URL(url).hostname !== 'cms.test') throw new Error('Unexpected network request');
      if (opts.method) {
        const body = JSON.parse(opts.body);
        writeFileSync(process.env.TEST_REQUEST, JSON.stringify(body));
        return Response.json({id: '42', slug: 'test-article', ...body});
      }
      return Response.json([
        {id: '42', title: 'Article', slug: 'test-article', status: 'draft'},
        {id: '43', title: 'Assets', slug: 'sc-assets-hidden', status: 'draft'}
      ]);
    };
  `);
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    XDG_CONFIG_HOME: path.dirname(configDir),
    FAL_API_KEY: 'test-only',
    SEOBLOG_SITE_TEST_API_KEY: 'test-only',
    SOCIALCUE_CLI: path.join(root, 'missing-cli.js'),
    TEST_REQUEST: path.join(root, 'request.json'),
  };
  function config(value) { writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(value)); }
  function run(script, ...args) {
    const result = spawnSync(process.execPath, ['--import', mock, path.join(plugin, 'scripts', script), ...args], { cwd: root, env, encoding: 'utf8' });
    assert.ifError(result.error);
    return { status: result.status, data: JSON.parse(result.stdout), stderr: result.stderr };
  }
  function socialcue() {
    const dir = path.join(root, 'socialcue');
    mkdirSync(path.join(dir, 'lib'), { recursive: true });
    mkdirSync(path.join(dir, 'node_modules', 'better-sqlite3'), { recursive: true });
    writeFileSync(path.join(dir, 'node_modules', 'better-sqlite3', 'index.js'), 'module.exports = class { close() {} };');
    env.SOCIALCUE_CLI = path.join(dir, 'lib', 'cli.js');
    writeFileSync(env.SOCIALCUE_CLI, `
      const fs = require('node:fs');
      if (process.argv[3] === 'list') console.log('[]');
      else {
        fs.writeFileSync(process.env.TEST_REQUEST, fs.readFileSync(0, 'utf8'));
        console.log('draft-123');
      }
    `);
    mkdirSync(path.join(root, '.socialdiscovery'));
    writeFileSync(path.join(root, '.socialdiscovery', 'config.json'), JSON.stringify({brands: [{name: 'Example', id: 'example'}]}));
  }
  return {root, env, config, run, socialcue};
}
const site = { defaultSite: 'test', sites: { test: { baseUrl: 'https://cms.test', author: 'Test', niche: 'Testing' } } };

test('blog preflight rejects missing setup, invalid site, malformed config and unknown workflow', t => {
  const f = fixture(t);
  for (const args of [['--workflow', 'blog'], ['--workflow', 'blog', '--site', 'missing'], ['--workflow', 'typo']]) {
    assert.equal(f.run('doctor.mjs', ...args, '--text-only').status, 1);
  }
  f.config(site);
  assert.equal(f.run('doctor.mjs', '--workflow', 'blog', '--site', 'missing', '--text-only').status, 1);
  writeFileSync(path.join(f.env.XDG_CONFIG_HOME, 'seoblog', 'config.json'), '{');
  const bad = f.run('doctor.mjs', '--workflow', 'blog', '--site', 'test', '--text-only');
  assert.equal(bad.status, 1);
  assert.equal(bad.data.checks.find(c => c.name === 'config file').ok, false);
});

test('image packages required only when FAL images enabled; no-key fallback and text-only succeed', t => {
  const f = fixture(t); f.config(site);
  assert.equal(f.run('doctor.mjs', '--workflow', 'blog').status, 1);
  assert.equal(f.run('doctor.mjs', '--workflow', 'blog', '--text-only').status, 0);
  delete f.env.FAL_API_KEY;
  assert.equal(f.run('doctor.mjs', '--workflow', 'blog').status, 0);
  f.config({sites: {}});
  assert.equal(f.run('doctor.mjs').status, 0); // legacy setup/status mode
});

test('SocialCue text workflow discovers caller store and saves draft without CMS or image packages', t => {
  const f = fixture(t); f.config({sites: {broken: {}}});
  assert.equal(f.run('doctor.mjs', '--workflow', 'socialcue', '--text-only').status, 1);
  f.socialcue();
  assert.equal(f.run('doctor.mjs', '--workflow', 'socialcue', '--text-only').status, 0);
  const located = f.run('socialcue.mjs', 'locate');
  assert.equal(realpathSync(located.data.storeDir), realpathSync(path.join(f.root, '.socialdiscovery')));
  const file = path.join(f.root, 'item.json');
  writeFileSync(file, JSON.stringify({title: 'Original article', body: 'Body', brandName: 'Example', status: 'draft', media: []}));
  const saved = f.run('socialcue.mjs', 'add', '--file', file);
  assert.equal(saved.status, 0); assert.equal(saved.data.id, 'draft-123');
  assert.equal(JSON.parse(readFileSync(f.env.TEST_REQUEST)).status, 'draft');
});

test('CMS creates drafts first, filters asset holders, and supports explicit publication', t => {
  const f = fixture(t); f.config(site);
  const file = path.join(f.root, 'article.json');
  writeFileSync(file, JSON.stringify({title: 'Article', body: '<p>Original</p>', status: 'published'}));
  assert.equal(f.run('cms.mjs', 'create', '--file', file).status, 0);
  assert.equal(JSON.parse(readFileSync(f.env.TEST_REQUEST)).status, 'draft');
  const drafts = f.run('cms.mjs', 'list', '--status', 'draft', '--exclude-assets');
  assert.deepEqual(drafts.data.articles.map(a => a.id), ['42']);
  writeFileSync(file, JSON.stringify({status: 'published'}));
  assert.equal(f.run('cms.mjs', 'update', '--id', '42', '--file', file).status, 0);
  assert.equal(JSON.parse(readFileSync(f.env.TEST_REQUEST)).status, 'published');
});
