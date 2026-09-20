#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = ['scripts/agent-team.mjs', 'agent-team/prompts/builder.md', 'agent-team/prompts/reviewer.md', 'agent-team/prompts/fixer.md', 'agent-team/prompts/director.md', 'agent-team/schemas/review.schema.json'];

function run(command, args, timeout = 15_000) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => err += d);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('error', error => { clearTimeout(timer); resolve({ code: 127, out, err: error.message }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code: code ?? 1, out, err }); });
  });
}
let failed = false;
function result(label, ok, detail = '') { console.log(`${ok ? 'OK' : 'ERREUR'}  ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed = true; }

for (const file of required) {
  try { await access(path.join(root, file), constants.R_OK); result(file, true); }
  catch { result(file, false, 'absent ou illisible'); }
}
try {
  const schema = JSON.parse(await readFile(path.join(root, 'agent-team/schemas/review.schema.json'), 'utf8'));
  result('schéma JSON', schema?.properties?.verdict?.enum?.join(',') === 'GO,FIX,BLOCKED');
} catch (error) { result('schéma JSON', false, error.message); }
for (const [label, command, args] of [
  ['Git', 'git', ['--version']], ['Node', 'node', ['--version']], ['npm', 'npm', ['--version']],
  ['Cursor CLI', 'agent', ['--version']], ['Codex CLI', 'codex', ['--version']],
  ['authentification Cursor', 'agent', ['status']], ['authentification Codex', 'codex', ['login', 'status']]
]) {
  const check = await run(command, args);
  result(label, check.code === 0, check.code === 0 ? check.out.trim().split('\n')[0] : `code ${check.code}`);
}
const syntax = await run(process.execPath, ['--check', 'scripts/agent-team.mjs']);
result('syntaxe orchestrateur', syntax.code === 0, syntax.err.trim());
const regressions = await run(process.execPath, ['scripts/agent-team.mjs', 'self-test']);
result('tests de régression secrets/snapshot/logs', regressions.code === 0, regressions.code === 0 ? regressions.out.trim() : regressions.err.trim());
const status = await run('git', ['status', '--porcelain=v1', '--untracked-files=all']);
result('état du dépôt', status.code === 0, status.out.trim() ? 'changements présents (normal pendant installation)' : 'propre');
process.exitCode = failed ? 1 : 0;
