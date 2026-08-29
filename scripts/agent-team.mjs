#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, chmod, access, rm, mkdtemp, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import os from 'node:os';

const ROOT = process.cwd();
const RUNS = path.join(ROOT, '.agent-runs');
const MAX_ROUNDS = 2;
const SECRET_NAME = /(^|\/)(\.env(?:\.|$)|.*(?:credential|private[-_]?key|\.pem$|\.p12$|\.jks$|\.keystore$))/i;
const PLACEHOLDER = /(\.\.\.|…|<[^>]+>|\b(?:your|example|placeholder|redacted|dummy|sample|changeme|ton[_-]|xxx+)\b|\$\{[^}]+\})/i;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*([A-Za-z0-9_./+~=-]{8,})/i,
  /\bBearer\s+([A-Za-z0-9._~+\/-]{16,})/i,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,})\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/
];
const REDACTIONS = [
  [/(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)[\s\S]*?(-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g, '$1\n[REDACTED]\n$2'],
  [/((?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*)[^\s"']+/gi, '$1[REDACTED]'],
  [/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[REDACTED]'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,})\b/g, '[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]']
];
const redact = value => REDACTIONS.reduce((text, [regex, replacement]) => text.replace(regex, replacement), String(value));

class SecretError extends Error {
  constructor(findings) {
    super(`Secret ajouté suspecté : ${findings.map(item => `${item.path}:${item.line}`).join(', ')} (valeur masquée).`);
    this.name = 'SecretError'; this.findings = findings;
  }
}
function run(command, args, { cwd = ROOT, timeout = 120_000, input, env = {}, allow = [0] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, settled = false, timer;
    child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
    const finish = (code, error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      const result = { code: code ?? 1, stdout, stderr, timedOut };
      if (error || !allow.includes(result.code)) reject(Object.assign(error || new Error(`${command} a échoué (${result.code})`), { result })); else resolve(result);
    };
    child.on('error', error => finish(127, error)); child.on('close', code => finish(code));
    timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.stdin.end(input || '');
  });
}
const git = (args, options = {}) => run('git', args, options);
const read = relative => readFile(path.join(ROOT, relative), 'utf8');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const allExitCodes = Array.from({ length: 256 }, (_, index) => index);
const phase = message => console.log(`[agent-team] ${message}`);

async function assertClean() {
  const { stdout } = await git(['status', '--porcelain=v1', '--untracked-files=all']);
  if (stdout) throw new Error('Le dépôt principal doit être totalement propre avant et pendant une mission.');
}
async function assertToolsAndAuth() {
  for (const [command, args] of [['git',['--version']],['node',['--version']],['npm',['--version']],['agent',['--version']],['codex',['--version']],['agent',['status']],['codex',['login','status']]]) await run(command, args, { timeout: 15_000 });
}
async function changedFiles(worktree) {
  const { stdout } = await git(['-C', worktree, 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const records = stdout.split('\0').filter(Boolean), files = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index], statusCode = record.slice(0, 2), name = record.slice(3);
    files.push({ status: statusCode, name });
    if ((statusCode.includes('R') || statusCode.includes('C')) && records[index + 1]) index++;
  }
  return files;
}
function secretInLine(line) {
  if (PLACEHOLDER.test(line)) return false;
  return SECRET_PATTERNS.some(regex => regex.test(line));
}
function scanAddedLines(patch, files = []) {
  const findings = [];
  let currentPath = '', newLine = 0, inHunk = false;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ ')) { currentPath = line.slice(4).replace(/^b\//, ''); inHunk = false; continue; }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { newLine = Number(hunk[1]); inHunk = true; continue; }
    if (!inHunk) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      if (secretInLine(line.slice(1))) findings.push({ path: currentPath, line: newLine, reason: 'contenu sensible ajouté', value: '[REDACTED]' });
      newLine++; continue;
    }
    if (line.startsWith('-') && !line.startsWith('---')) continue;
    if (line.startsWith(' ')) newLine++;
    else if (line.startsWith('diff --git') || line.startsWith('Binary files')) inHunk = false;
  }
  for (const file of files.filter(item => item.status === '??' && SECRET_NAME.test(item.name))) {
    if (!findings.some(item => item.path === file.name)) findings.push({ path: file.name, line: 1, reason: 'nom de fichier sensible ajouté', value: '[REDACTED]' });
  }
  return findings;
}
function redactPatch(patch, findings) {
  const targets = new Set(findings.map(item => `${item.path}:${item.line}`));
  let currentPath = '', newLine = 0, inHunk = false;
  return patch.split('\n').map(line => {
    if (line.startsWith('+++ ')) { currentPath = line.slice(4).replace(/^b\//, ''); inHunk = false; return line; }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { newLine = Number(hunk[1]); inHunk = true; return line; }
    if (inHunk && line.startsWith('+') && !line.startsWith('+++')) {
      const masked = targets.has(`${currentPath}:${newLine}`) ? '+[REDACTED: secret suspect]' : redact(line);
      newLine++; return masked;
    }
    if (inHunk && line.startsWith('-') && !line.startsWith('---')) return redact(line);
    if (inHunk && line.startsWith(' ')) newLine++;
    return redact(line);
  }).join('\n');
}

async function snapshot(worktree) {
  const files = await changedFiles(worktree);
  const { stdout: trackedPatch } = await git(['-C', worktree, 'diff', '--binary', 'HEAD', '--', '.']);
  let patch = trackedPatch;
  for (const file of files.filter(item => item.status === '??')) {
    const result = await git(['-C', worktree, 'diff', '--binary', '--no-index', '--', '/dev/null', file.name], { allow: [0, 1] });
    patch += result.stdout;
  }
  const { stdout: trackedStat } = await git(['-C', worktree, 'diff', '--stat', 'HEAD', '--', '.']);
  const untracked = files.filter(item => item.status === '??').map(item => item.name), untrackedStat = [];
  for (const name of untracked) {
    let size = 0; try { size = (await stat(path.join(worktree, name))).size; } catch {}
    untrackedStat.push(` ${name} | nouveau fichier non suivi (${size} octets)`);
  }
  return { files, patch, stat: [trackedStat.trimEnd(), ...untrackedStat].filter(Boolean).join('\n'), untracked };
}
function assertNoAddedSecrets(snap) {
  const findings = scanAddedLines(snap.patch, snap.files);
  if (findings.length) throw new SecretError(findings);
}
async function makeGuard(runDir) {
  const bin = path.join(runDir, 'guard-bin'); await mkdir(bin, { recursive: true });
  const gitGuard = `#!/bin/sh\ncase "$1" in add|am|apply|bisect|branch|checkout|cherry-pick|clean|clone|commit|fetch|merge|mv|pull|push|rebase|reset|restore|revert|rm|stash|switch|tag|worktree) echo "Git mutable interdit" >&2; exit 126;; esac\nexec /usr/bin/git "$@"\n`;
  const deny = name => `#!/bin/sh\necho "${name} interdit par agent-team" >&2\nexit 126\n`;
  await writeFile(path.join(bin, 'git'), gitGuard); await chmod(path.join(bin, 'git'), 0o755);
  for (const name of ['gh','wrangler','vercel','netlify','firebase']) { await writeFile(path.join(bin, name), deny(name)); await chmod(path.join(bin, name), 0o755); }
  return bin;
}
async function cursorPass({ worktree, runDir, prompt, logName, guard }) {
  const result = await run('agent', ['-p', '--output-format', 'text', '--sandbox', 'enabled', '--auto-review', '--trust', '--workspace', worktree, prompt], { cwd: worktree, timeout: 30 * 60_000, env: { PATH: `${guard}:${process.env.PATH}`, CI: '1' }, allow: allExitCodes });
  await writeFile(path.join(runDir, logName), redact(`STDOUT\n${result.stdout}\nSTDERR\n${result.stderr}\nEXIT ${result.code}\n`));
  return { report: redact(result.stdout.trim()), exitCode: result.code, timedOut: result.timedOut, error: result.code === 0 ? '' : `Cursor a échoué (code ${result.code}${result.timedOut ? ', timeout' : ''}).` };
}
async function codexPass({ worktree, runDir, prompt, outputName, logName }) {
  const output = path.join(runDir, outputName);
  const result = await run('codex', ['exec', '--ephemeral', '--sandbox', 'read-only', '--cd', worktree, '--output-schema', path.join(ROOT, 'agent-team/schemas/review.schema.json'), '--output-last-message', output, '-'], { cwd: worktree, timeout: 30 * 60_000, input: prompt, allow: allExitCodes });
  await writeFile(path.join(runDir, logName), redact(`STDOUT\n${result.stdout}\nSTDERR\n${result.stderr}\nEXIT ${result.code}\n`));
  if (result.code !== 0) return { exitCode: result.code, timedOut: result.timedOut, error: `Codex a échoué (code ${result.code}).` };
  try {
    const data = JSON.parse(await readFile(output, 'utf8'));
    if (!['GO','FIX','BLOCKED'].includes(data.verdict)) return { exitCode: result.code, error: 'Verdict Codex invalide.' };
    return { ...data, exitCode: result.code, timedOut: result.timedOut };
  } catch (error) { return { exitCode: result.code, error: `Réponse Codex illisible : ${error.message}` }; }
}
async function runValidations(worktree, runDir, label = 'candidate') {
  const pkg = JSON.parse(await readFile(path.join(worktree, 'package.json'), 'utf8'));
  const names = Object.keys(pkg.scripts || {}), selected = [];
  for (const candidate of ['lint','typecheck','type-check','check:types','test','build']) if (names.includes(candidate)) selected.push(candidate);
  for (const name of names.filter(name => /^test:/.test(name) && !/^test:(watch|ui|dev)(:|$)/.test(name))) if (!selected.includes(name)) selected.push(name);
  const results = [];
  for (const name of selected) {
    phase(`${label} — ${name}`);
    let result;
    const unsafe = /(^|[;&|]\s*|\bnpx\s+)(?:git\s+(?:commit|push|pull|merge|reset|rebase|stash|clean)|gh\b|wrangler\b|vercel\b|netlify\b|firebase\b)|\bdeploy\b/i.test(pkg.scripts[name]);
    if (unsafe) result = { code: 126, stdout: '', stderr: `Script refusé : ${name}`, timedOut: false };
    else try { result = await run('npm', ['run', name], { cwd: worktree, timeout: name === 'build' ? 10 * 60_000 : 5 * 60_000, env: { CI: '1' } }); }
    catch (error) { result = error.result || { code: 1, stdout: '', stderr: error.message, timedOut: false }; }
    results.push({ name, code: result.code, timedOut: result.timedOut });
    await writeFile(path.join(runDir, `${label}-${name.replace(/[^a-z0-9]/gi, '-')}.log`), redact(`STDOUT\n${result.stdout}\nSTDERR\n${result.stderr}\nEXIT ${result.code}\n`));
  }
  const diff = await run('git', ['diff', '--check', 'HEAD'], { cwd: worktree, allow: allExitCodes });
  results.push({ name: 'git diff --check', code: diff.code, timedOut: diff.timedOut });
  await writeFile(path.join(runDir, `${label}-diff-check.log`), redact(`STDOUT\n${diff.stdout}\nSTDERR\n${diff.stderr}\nEXIT ${diff.code}\n`));
  return results;
}
function validationComparison(baseline, candidate) {
  const byName = new Map(baseline.map(item => [item.name, item])), comparison = [], regressions = [], preexisting = [], flaky = [];
  for (const item of candidate) {
    const before = byName.get(item.name);
    if (item.code === 0) { comparison.push({ name: item.name, classification: before?.code ? 'fixed' : 'pass' }); continue; }
    if (before && before.code !== 0) { comparison.push({ name: item.name, classification: 'preexisting-warning' }); preexisting.push(item); }
    else { comparison.push({ name: item.name, classification: 'candidate-regression' }); regressions.push(item); }
  }
  return { comparison, regressions, preexisting, flaky };
}
const bullets = items => items?.length ? items.map(item => `- ${item}`).join('\n') : '- Aucun';
async function writeStatus(runDir, data) {
  await writeFile(path.join(runDir, 'status.json'), JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
}
async function writeReport({ runDir, runId, mission, worktree, cursorRuns, reviews, fixes, director, tests, finalVerdict, snap, error, secretFindings = [], baseline = [], validations = [], comparisons = [], preexisting = [], fixers = 0 }) {
  const classified = predicate => snap.files.filter(file => predicate(file.status)).map(file => file.name);
  const patch = secretFindings.length ? redactPatch(snap.patch, secretFindings) : snap.patch;
  const patchNote = secretFindings.length ? 'Patch expurgé : un secret ajouté est suspecté. Le diff brut reste uniquement consultable dans le worktree.' : 'Patch binaire complet des fichiers suivis et non suivis.';
  const cursorText = cursorRuns.map((run,index) => `### Passage ${index + 1} — exécuté, code ${run.exitCode}${run.timedOut ? ' (timeout)' : ''}\n\n${run.report || run.error || 'Voir le journal.'}`).join('\n\n') || 'Non exécuté.';
  const reviewText = reviews.map((review,index) => `### Revue ${index + 1}: ${review.verdict || 'ERREUR'} — code ${review.exitCode}\n\nConstats:\n${bullets(review.findings)}\n\nCorrections requises:\n${bullets(review.required_fixes)}\n\nRisques:\n${bullets(review.risks)}${review.error ? `\n\nErreur : ${review.error}` : ''}`).join('\n\n') || 'Non exécuté.';
  const directorText = director ? `**${director.verdict || 'ERREUR'}** — code ${director.exitCode}\n\n${bullets(director.findings)}\n\nRisques:\n${bullets(director.risks)}\n\nCorrections requises:\n${bullets(director.required_fixes)}${director.error ? `\n\nErreur : ${director.error}` : ''}` : 'Non exécuté.';
  const formatResults = results => results.length ? results.map(item => `- \`${item.name}\`: code ${item.code}${item.timedOut ? ' (timeout)' : ''}`).join('\n') : '- Aucun script pertinent exécuté.';
  const comparisonText = comparisons.length ? comparisons.flatMap((item,index) => [`### Comparaison candidat ${index + 1}`, bullets(item.comparison.map(entry => `${entry.name}: ${entry.classification}`))]).join('\n\n') : '- Aucune.';
  const content = `# Rapport Agent Team — ${runId}\n\n## Mission initiale\n\n${mission}\n\n## Verdict final\n\n**${finalVerdict}**${error ? ` — ${redact(error)}` : ''}\n\n## Fichiers ajoutés\n\n${bullets(classified(code => code === '??' || code.includes('A')))}\n\n## Fichiers modifiés\n\n${bullets(classified(code => code.includes('M')))}\n\n## Fichiers supprimés\n\n${bullets(classified(code => code.includes('D')))}\n\n## Travail de Cursor\n\n${cursorText}\n\n## Avis du premier Codex\n\n${reviewText}\n\n## Corrections automatiques\n\n${fixes.length ? fixes.map((item,index) => `### Boucle ${index + 1} — origine ${item.origin}\n${bullets(item.details)}`).join('\n\n') : 'Aucune.'}\n\n## Validations baseline (HEAD propre)\n\n${formatResults(baseline)}\n\n## Validations candidat\n\n${validations.map(item => `### ${item.label}\n${formatResults(item.results)}`).join('\n\n') || '- Aucune.'}\n\n## Comparaison baseline / candidat\n\n${comparisonText}\n\n## Problèmes préexistants non causés par la mission\n\n${bullets(preexisting.map(item => `${item.name}: code ${item.code}`))}\n\n## Nombre global de boucles\n\n${fixers} fixer(s), maximum global ${MAX_ROUNDS}.\n\n## Avis du directeur technique\n\n${directorText}\n\n## Tests et builds\n\n${formatResults(tests)}\n\n## Secrets suspectés\n\n${secretFindings.length ? secretFindings.map(item => `- ${item.path}:${item.line} — valeur masquée`).join('\n') : '- Aucun.'}\n\n## Risques et limites\n\n${bullets([...(reviews.at(-1)?.risks || []), ...(director?.risks || []), 'Aucun patch n’a été appliqué au dépôt principal.', 'Le worktree est conservé pour décision manuelle.'])}\n\n## git diff --stat\n\n\`\`\`text\n${snap.stat || '(aucun changement)'}\n\`\`\`\n\n## Patch\n\n${patchNote} Copie : \`changes.patch\` (${Buffer.byteLength(patch)} octets).\n\n\`\`\`diff\n${patch || '(patch vide — aucun changement dans le worktree)'}\n\`\`\`\n\n## Fichiers non suivis\n\n${bullets(snap.untracked)}\n\n## Emplacement du worktree\n\n\`${worktree}\`\n`;
  await writeFile(path.join(runDir, 'changes.patch'), patch);
  await writeFile(path.join(runDir, 'FINAL_REPORT.md'), redact(content));
  await writeStatus(runDir, { runId, status: 'FINISHED', finalVerdict, worktree, report: path.join(runDir, 'FINAL_REPORT.md') });
}

let activeRun = null;
async function interrupted(signal) {
  if (!activeRun) { process.exitCode = 130; return; }
  try {
    await writeStatus(activeRun.runDir, { runId: activeRun.runId, status: 'INTERRUPTED', finalVerdict: 'BLOCKED', worktree: activeRun.worktree, reason: signal });
    console.error(`[agent-team] ${signal}: mission interrompue; worktree conservé: ${activeRun.worktree}`);
  } finally { process.exitCode = 130; process.exit(); }
}
process.on('SIGINT', () => { void interrupted('SIGINT'); });
process.on('SIGTERM', () => { void interrupted('SIGTERM'); });

async function selfTest() {
  const removed = 'password=real-looking-token-123456';
  const added = 'password=real-looking-token-123456';
  const placeholder = 'password=${MY_PASSWORD}';
  const patch = `diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1,3 +1,3 @@\n-${removed}\n+${placeholder}\n context\n`;
  const removedOnly = `diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-${removed}\n+safe text\n`;
  const realPatch = `diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-old\n+${added}\n`;
  if (scanAddedLines(removedOnly, [{ status: ' M', name: 'docs/example.md' }]).length) throw new Error('régression: ligne supprimée bloquée');
  if (scanAddedLines(patch, [{ status: ' M', name: 'docs/example.md' }]).length) throw new Error('régression: placeholder bloqué');
  const findings = scanAddedLines(realPatch, [{ status: ' M', name: 'docs/example.md' }]);
  if (findings.length !== 1 || findings[0].path !== 'docs/example.md' || findings[0].line !== 1 || findings[0].value !== '[REDACTED]') throw new Error('régression: secret ajouté non bloqué/masqué');
  const snap = { files: [{ status: ' M', name: 'docs/example.md' }], patch: realPatch, stat: ' docs/example.md | 1 +', untracked: [] };
  if (!snap.patch || !redactPatch(snap.patch, findings).includes('[REDACTED: secret suspect]')) throw new Error('régression: snapshot expurgé vide');
  if (redact('Bearer abcdefghijklmnop-secret') .includes('abcdefghijklmnop-secret')) throw new Error('régression: secret brut dans les logs');
  const sameFail = validationComparison([{ name: 'test', code: 1 }], [{ name: 'test', code: 1 }]);
  if (sameFail.regressions.length || sameFail.preexisting.length !== 1) throw new Error('régression: baseline identique non classée préexistante');
  if (validationComparison([{ name: 'test', code: 0 }], [{ name: 'test', code: 1 }]).regressions.length !== 1) throw new Error('régression: nouveau test non classé régression');
  const origins = ['validation', 'reviewer', 'director'];
  if (origins.length !== 3 || MAX_ROUNDS !== 2) throw new Error('régression: origines/limite des fixers');
  const preexistingDetails = validationComparison([{ name: 'test', code: 1 }], [{ name: 'test', code: 1 }]);
  if (preexistingDetails.regressions.length !== 0 && preexistingDetails.preexisting.length !== 1) throw new Error('régression: échec préexistant transmis au fixer');
  console.log('REGRESSION TESTS OK — secrets ajoutés/supprimés/placeholders, snapshot et logs');
}

async function mission(args) {
  const dryRun = args.includes('--dry-run');
  const missionText = args.filter(arg => arg !== '--dry-run').join(' ').trim();
  if (!missionText) throw new Error('La mission ne doit pas être vide.');
  if (SECRET_PATTERNS.some(regex => regex.test(missionText)) && !PLACEHOLDER.test(missionText)) throw new Error('La mission semble contenir un secret et ne sera pas transmise.');
  if (dryRun) { for (const file of ['builder','reviewer','fixer','director']) await access(path.join(ROOT, `agent-team/prompts/${file}.md`)); JSON.parse(await read('agent-team/schemas/review.schema.json')); console.log('DRY-RUN OK — aucun agent ni worktree lancé.'); return; }
  await assertClean(); await assertToolsAndAuth();
  const runId = `${stamp()}-${crypto.randomBytes(3).toString('hex')}`, runDir = path.join(RUNS, runId), worktree = path.join(runDir, 'worktree');
  await mkdir(runDir, { recursive: true });
  await writeStatus(runDir, { runId, status: 'STARTING', worktree });
  console.log(runId); activeRun = { runId, runDir, worktree };
  try { await git(['worktree', 'add', '--detach', worktree, 'HEAD']); } catch (error) { await writeStatus(runDir, { runId, status: 'FINISHED', finalVerdict: 'BLOCKED', worktree, error: error.message }); throw error; }
  await writeStatus(runDir, { runId, status: 'ACTIVE', worktree });
  const cursorRuns = [], reviews = [], fixes = [], tests = [], validations = [], comparisons = [], preexisting = [];
  let director = null, finalVerdict = 'BLOCKED', fatal = '', secretFindings = [], snap = await snapshot(worktree), fixers = 0;
  try {
    phase('Baseline — validations HEAD propre');
    const baseline = await runValidations(worktree, runDir, 'baseline'); validations.push({ label: 'baseline', results: baseline });
    phase('Cursor — développement');
    const builder = await read('agent-team/prompts/builder.md');
    const cursor = await cursorPass({ worktree, runDir, guard: await makeGuard(runDir), logName: 'cursor-builder.log', prompt: `${builder}\n\nMISSION:\n${missionText}` });
    cursorRuns.push(cursor);
    try { assertNoAddedSecrets(await snapshot(worktree)); } catch (error) { if (error instanceof SecretError) { secretFindings = error.findings; throw error; } throw error; }
    let cycle = 0;
    while (true) {
      cycle++; phase(`Revue Codex — passage ${cycle}`); snap = await snapshot(worktree);
      const reviewer = await read('agent-team/prompts/reviewer.md');
      const review = await codexPass({ worktree, runDir, prompt: `${reviewer}\n\nMISSION:\n${missionText}\n\nFICHIERS:\n${snap.files.map(file => `${file.status} ${file.name}`).join('\n')}`, outputName: `review-${cycle}.json`, logName: `codex-review-${cycle}.log` });
      reviews.push(review);
      phase('Validations — candidat'); const candidate = await runValidations(worktree, runDir, `candidate-${cycle}`); validations.push({ label: `candidate-${cycle}`, results: candidate });
      const compared = validationComparison(baseline, candidate); comparisons.push(compared); preexisting.push(...compared.preexisting);
      const important = [...compared.regressions, ...(review.verdict === 'FIX' ? [{ name: 'reviewer', code: 1, details: review.required_fixes || [] }] : [])];
      phase('Directeur Codex'); snap = await snapshot(worktree);
      director = await codexPass({ worktree, runDir, prompt: `${await read('agent-team/prompts/director.md')}\n\nMISSION:\n${missionText}\n\nREVUE:\n${JSON.stringify(review)}\n\nVALIDATIONS:\n${JSON.stringify(candidate)}\n\nFICHIERS:\n${snap.files.map(file => `${file.status} ${file.name}`).join('\n')}`, outputName: `director-${cycle}.json`, logName: `codex-director-${cycle}.log` });
      const directorFixes = director.verdict === 'FIX' ? (director.required_fixes || []) : [];
      if (!important.length && !directorFixes.length && review.verdict === 'GO' && director.verdict === 'GO' && compared.regressions.length === 0 && candidate.every(item => item.code === 0 || item.name !== 'git diff --check')) { finalVerdict = 'GO'; break; }
      if (fixers >= MAX_ROUNDS) { finalVerdict = important.length || directorFixes.length ? 'BLOCKED' : 'GO'; break; }
      fixers++; const origin = directorFixes.length ? 'director' : (compared.regressions.length ? 'validation' : 'reviewer');
      const details = directorFixes.length ? directorFixes : (compared.regressions.length ? compared.regressions.map(item => `${item.name}: code ${item.code}`) : (review.required_fixes || []));
      phase(`Correction Cursor — boucle ${fixers} (${origin})`); fixes.push({ origin, details });
      const fixer = await read('agent-team/prompts/fixer.md');
      cursorRuns.push(await cursorPass({ worktree, runDir, guard: path.join(runDir, 'guard-bin'), logName: `cursor-fix-${fixers}.log`, prompt: `${fixer}\n\nMISSION STRICTE:\n${missionText}\n\nORIGINE: ${origin}\n\nCORRECTIONS OBLIGATOIRES:\n${details.map(item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n')}\n\nNe corrige jamais un échec préexistant de la baseline.` }));
      try { assertNoAddedSecrets(await snapshot(worktree)); } catch (error) { if (error instanceof SecretError) { secretFindings = error.findings; throw error; } throw error; }
    }
    tests.push(...(validations.at(-1)?.results || []));
  } catch (error) { fatal = error.message; finalVerdict = 'BLOCKED'; if (error instanceof SecretError) secretFindings = error.findings; }
  snap = await snapshot(worktree);
  await writeReport({ runDir, runId, mission: missionText, worktree, cursorRuns, reviews, fixes, director, tests, finalVerdict, snap, error: fatal, secretFindings, baseline: validations[0]?.results || [], validations: validations.slice(1), comparisons, preexisting, fixers });
  await writeStatus(runDir, { runId, status: 'FINISHED', finalVerdict, worktree, report: path.join(runDir, 'FINAL_REPORT.md') });
  activeRun = null; await assertClean(); phase(`Rapport — ${path.join(runDir, 'FINAL_REPORT.md')}`); console.log(`Verdict: ${finalVerdict}\nWorktree conservé: ${worktree}`);
  if (finalVerdict === 'BLOCKED') process.exitCode = 2;
}
async function statusCommand(args) {
  const id = args[0]?.trim(); if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('Run id invalide ou absent.');
  console.log(await readFile(path.join(RUNS, id, 'status.json'), 'utf8'));
}
async function cleanup(args) {
  const id = args[0]?.trim(); if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('Run id invalide ou absent.');
  const runDir = path.join(RUNS, id), worktree = path.join(runDir, 'worktree');
  if (path.relative(RUNS, runDir).startsWith('..')) throw new Error('Chemin hors .agent-runs refusé.');
  let current; try { current = JSON.parse(await readFile(path.join(runDir, 'status.json'), 'utf8')); } catch { throw new Error('Run introuvable ou statut illisible.'); }
  if (current.status === 'STARTING' || current.status === 'ACTIVE') throw new Error('Run actif : nettoyage refusé.');
  await git(['worktree', 'remove', worktree]); await rm(runDir, { recursive: true, force: false });
  console.log(`Run supprimé : ${id}`);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'self-test') await selfTest();
  else if (command === 'mission') await mission(args);
  else if (command === 'status') await statusCommand(args);
  else if (command === 'cleanup') await cleanup(args);
  else throw new Error('Usage: agent-team.mjs mission|status <run-id>|cleanup <run-id>|self-test');
} catch (error) { console.error(`[agent-team] ERREUR: ${redact(error.message)}`); process.exitCode = process.exitCode || 1; }
