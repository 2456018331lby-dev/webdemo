import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionDist = path.join(repoRoot, 'apps', 'extension', 'dist');
const sidePanelMarker = '求职投递助手';
const edgeProfilePrefix = 'job-assistant-edge-smoke-';

let edgeProcess;
let profileDir;

try {
  assertDistReady();
  const edgePath = findEdgeExecutable();
  const port = await getFreePort();
  profileDir = mkdtempSync(path.join(os.tmpdir(), edgeProfilePrefix));
  edgeProcess = launchEdge(edgePath, profileDir, port);

  await waitForDevtools(port);
  const sidepanelTarget = await openExtensionSidePanel(port, profileDir);
  const client = await connectCdp(sidepanelTarget.webSocketDebuggerUrl);

  try {
    await client.send('Runtime.enable');
    await waitForSidePanelReady(client);
    await clearExtensionStorage(client);

    const defaultState = await sendRuntimeMessage(client, { type: 'GET_STATE' });
    assert(defaultState.state?.policy?.mode === 'dry-run', `Expected default policy mode dry-run, got ${defaultState.state?.policy?.mode}`);
    assert(defaultState.state?.policy?.requireResearchBeforeAuto === true, 'Expected requireResearchBeforeAuto to default to true');

    const text = await evaluate(client, 'document.body.innerText');
    for (const marker of ['简历画像', '投递策略', '全网资料', '投递队列']) {
      assert(text.includes(marker), `Expected side panel to contain ${marker}`);
    }

    const nowIso = new Date().toISOString();
    const resume = {
      targetTitles: ['前端工程师'],
      targetLocations: ['上海'],
      skills: ['React', 'TypeScript'],
      industries: ['SaaS'],
      rawText: '求职意向：前端工程师；期望城市：上海；技能：React TypeScript；行业：SaaS。'
    };
    const jobs = makeSmokeJobs(nowIso);

    await sendRuntimeMessage(client, { type: 'SAVE_RESUME', resume });
    const queued = await sendRuntimeMessage(client, { type: 'QUEUE_JOBS', jobs });
    const queuedItems = queued.state?.queue?.items ?? [];
    const queuedIds = queuedItems.map((item) => item.job.id);
    assert(queuedIds[0] === 'edge-high-salary', `Expected high salary job first, got ${queuedIds.join(', ')}`);
    assert((queuedItems[0]?.score?.compensationScore ?? 0) > (queuedItems[1]?.score?.compensationScore ?? 0), 'Expected high salary compensation score to beat low salary score');

    const rescannedLowSalaryAsBetterJob = {
      ...jobs[1],
      salary: { min: 50_000, max: 60_000, currency: 'CNY', period: 'month', raw: '50-60K' },
      description: 'React TypeScript 核心平台研发，五险一金，16薪，周末双休，带薪年假。',
      tags: ['React', 'TypeScript', '五险一金', '16薪', '双休', '带薪年假']
    };
    const rescanned = await sendRuntimeMessage(client, { type: 'QUEUE_JOBS', jobs: [rescannedLowSalaryAsBetterJob] });
    const rescannedItems = rescanned.state?.queue?.items ?? [];
    const updatedLowSalary = rescannedItems.find((item) => item.job.id === 'edge-low-salary');
    assert(updatedLowSalary?.job?.salary?.raw === '50-60K', `Expected rescanned job salary to update, got ${updatedLowSalary?.job?.salary?.raw}`);
    assert(updatedLowSalary?.score?.score > queuedItems[1].score.score, 'Expected rescanned job score to improve after richer salary/details');

    const dryRun = await sendRuntimeMessage(client, { type: 'RUN_NEXT_DRY_RUN' });
    const completedFirst = dryRun.state?.queue?.items?.find((item) => item.status === 'completed');
    assert(completedFirst?.job?.id === rescannedItems[0]?.job?.id, `Expected dry-run to execute current top-ranked item ${rescannedItems[0]?.job?.id}, got ${completedFirst?.job?.id}`);
    assert(dryRun.state?.auditLog?.[0]?.message?.includes('不会点击投递按钮'), 'Expected dry-run audit log to state no real click happened');

    const summary = {
      edge: await getBrowserVersion(port),
      extensionId: getExtensionId(sidepanelTarget.url),
      defaultMode: defaultState.state.policy.mode,
      rankedJobIds: queuedIds,
      rescannedTopJobId: rescannedItems[0]?.job?.id,
      highSalaryScore: queuedItems[0].score.score,
      lowSalaryScoreBeforeRescan: queuedItems[1].score.score,
      lowSalaryScoreAfterRescan: updatedLowSalary.score.score,
      dryRunStatus: completedFirst.status,
      dist: extensionDist
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    client.close();
  }
} finally {
  if (edgeProcess) killProcessTree(edgeProcess.pid);
  if (profileDir) await removeOwnedTempProfile(profileDir);
  cleanGeneratedOutputsExceptExtensionDist();
}

function assertDistReady() {
  for (const file of ['manifest.json', 'sidepanel.html', 'popup.html', path.join('background', 'service-worker.js'), path.join('content', 'main.js')]) {
    const fullPath = path.join(extensionDist, file);
    assert(existsSync(fullPath), `Missing ${fullPath}. Run npm run build first.`);
  }
}

function findEdgeExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.platform === 'darwin' ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : undefined,
    process.platform === 'linux' ? '/usr/bin/microsoft-edge' : undefined,
    process.platform === 'linux' ? '/usr/bin/microsoft-edge-stable' : undefined
  ].filter(Boolean);

  const edgePath = candidates.find((candidate) => existsSync(candidate));
  assert(edgePath, 'Microsoft Edge not found. Set EDGE_PATH to msedge.exe and rerun npm run test:edge.');
  return edgePath;
}

function launchEdge(edgePath, userDataDir, port) {
  mkdirSync(userDataDir, { recursive: true });
  return spawn(edgePath, [
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    `--load-extension=${extensionDist}`,
    `--disable-extensions-except=${extensionDist}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], {
    detached: false,
    stdio: 'ignore'
  });
}

async function openExtensionSidePanel(port, userDataDir) {
  const tried = new Set();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const existingTargets = targets.filter((target) => target.url?.includes('/sidepanel.html') && target.webSocketDebuggerUrl);
    for (const target of existingTargets) {
      if (await targetContainsMarker(port, target)) return target;
      await closeTarget(port, target.id);
    }

    for (const id of getCandidateExtensionIds(targets, userDataDir)) {
      if (tried.has(id)) continue;
      tried.add(id);
      const url = `chrome-extension://${id}/sidepanel.html`;
      const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
      if (!target.webSocketDebuggerUrl) continue;

      if (await targetContainsMarker(port, target)) return target;
      await closeTarget(port, target.id);
    }
    await sleep(250);
  }

  throw new Error('Could not discover loaded extension side panel in Edge.');
}

async function targetContainsMarker(port, target) {
  const client = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const text = await evaluate(client, 'document.body.innerText');
      if (text.includes(sidePanelMarker)) return true;
      await sleep(250);
    }
    return false;
  } catch {
    return false;
  } finally {
    client.close();
  }
}

function getCandidateExtensionIds(targets, userDataDir) {
  const preferredIds = new Set();
  for (const file of [
    path.join(userDataDir, 'Default', 'Secure Preferences'),
    path.join(userDataDir, 'Default', 'Preferences')
  ]) {
    for (const id of getExtensionIdsFromPreferences(file)) preferredIds.add(id);
  }

  if (preferredIds.size > 0) return Array.from(preferredIds);

  const ids = new Set();
  for (const target of targets) {
    const match = target.url?.match(/^chrome-extension:\/\/([a-p]{32})\//);
    if (match) ids.add(match[1]);
  }

  for (const dir of [
    path.join(userDataDir, 'Default', 'Local Extension Settings'),
    path.join(userDataDir, 'Default', 'Sync Extension Settings')
  ]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (/^[a-p]{32}$/.test(name)) ids.add(name);
    }
  }

  return Array.from(ids);
}

function getExtensionIdsFromPreferences(file) {
  if (!existsSync(file)) return [];

  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const settings = data?.extensions?.settings ?? {};
    return Object.entries(settings)
      .filter(([id, value]) => /^[a-p]{32}$/.test(id) && isLoadedFromDist(value))
      .map(([id]) => id);
  } catch {
    return [];
  }
}

function isLoadedFromDist(value) {
  const extensionPath = typeof value?.path === 'string' ? path.resolve(value.path) : '';
  return normalizePath(extensionPath) === normalizePath(extensionDist);
}

function normalizePath(value) {
  return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

async function waitForSidePanelReady(client) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const text = await evaluate(client, 'document.body.innerText');
    if (text.includes(sidePanelMarker)) return;
    await sleep(200);
  }
  throw new Error('Side panel did not render expected title.');
}

async function clearExtensionStorage(client) {
  await evaluate(client, 'new Promise((resolve) => chrome.storage.local.clear(resolve))');
}

async function sendRuntimeMessage(client, message) {
  const payload = await evaluate(
    client,
    `new Promise((resolve) => chrome.runtime.sendMessage(${JSON.stringify(message)}, (response) => resolve({ response, lastError: chrome.runtime.lastError?.message })))`
  );
  assert(!payload?.lastError, `${message.type} chrome.runtime error: ${payload?.lastError}`);
  assert(payload?.response?.ok, `${message.type} failed: ${JSON.stringify(payload)}`);
  return payload.response;
}

function makeSmokeJobs(nowIso) {
  return [
    {
      id: 'edge-high-salary',
      platform: 'boss',
      title: '前端工程师',
      company: { name: '高薪云科技', industry: 'SaaS', location: '上海', tags: ['五险一金', '双休'] },
      location: '上海',
      salary: { min: 35000, max: 45000, currency: 'CNY', period: 'month', raw: '35-45K' },
      description: 'React TypeScript SaaS 平台研发，五险一金，年终奖，周末双休，带薪年假。',
      requirements: ['React', 'TypeScript'],
      tags: ['React', 'TypeScript', '五险一金', '年终奖', '双休', '带薪年假'],
      url: 'https://www.zhipin.com/job_detail/edge-high-salary.html',
      scrapedAt: nowIso
    },
    {
      id: 'edge-low-salary',
      platform: 'boss',
      title: '前端工程师',
      company: { name: '低薪外包科技', industry: 'SaaS', location: '上海', tags: [] },
      location: '上海',
      salary: { min: 8000, max: 10000, currency: 'CNY', period: 'month', raw: '8-10K' },
      description: 'React 页面开发。',
      requirements: ['React'],
      tags: ['React'],
      url: 'https://www.zhipin.com/job_detail/edge-low-salary.html',
      scrapedAt: nowIso
    }
  ];
}

async function connectCdp(webSocketDebuggerUrl) {
  assert(typeof WebSocket === 'function', 'This smoke test requires Node.js with global WebSocket support. Use Node 22+ or current Node 24.');
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (!data.id || !pending.has(data.id)) return;
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(`${data.error.message}: ${data.error.data ?? ''}`));
    else resolve(data);
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out connecting to Edge DevTools target.')), 5000);
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    socket.addEventListener('error', (event) => {
      clearTimeout(timeout);
      reject(event.error ?? new Error('WebSocket error'));
    }, { once: true });
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
    }
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.result.exceptionDetails) {
    throw new Error(result.result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return result.result.result.value;
}

async function waitForDevtools(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      await fetchJson(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Edge DevTools port did not become ready.');
}

async function getBrowserVersion(port) {
  const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
  return version.Browser;
}

async function closeTarget(port, targetId) {
  if (!targetId) return;
  try {
    await fetchJson(`http://127.0.0.1:${port}/json/close/${targetId}`);
  } catch {
    // Closing a failed probe target is best-effort only.
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : undefined;
      server.close(() => port ? resolve(port) : reject(new Error('Could not allocate a local port.')));
    });
  });
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may have already exited.
    }
  }
}

async function removeOwnedTempProfile(dir) {
  const resolved = path.resolve(dir);
  const tempRoot = path.resolve(os.tmpdir());
  assert(resolved.startsWith(tempRoot), `Refusing to delete outside temp: ${resolved}`);
  assert(path.basename(resolved).startsWith(edgeProfilePrefix), `Refusing to delete unowned temp profile: ${resolved}`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return;
    } catch (error) {
      if (attempt === 19) {
        console.warn(`Warning: could not remove temporary Edge profile ${resolved}: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await sleep(250);
    }
  }
}

function cleanGeneratedOutputsExceptExtensionDist() {
  for (const target of [
    path.join(repoRoot, 'packages', 'shared', 'dist'),
    path.join(repoRoot, 'apps', 'extension', 'node_modules', '.vite'),
    path.join(repoRoot, 'apps', 'extension', 'node_modules', '.vite-temp'),
    path.join(repoRoot, 'packages', 'shared', 'node_modules', '.vite'),
    path.join(repoRoot, 'packages', 'shared', 'node_modules', '.vite-temp')
  ]) {
    const resolved = path.resolve(target);
    assert(resolved.startsWith(repoRoot), `Refusing to delete outside repo: ${resolved}`);
    rmSync(resolved, { recursive: true, force: true });
  }

  for (const target of [
    path.join(repoRoot, 'apps', 'extension', 'node_modules'),
    path.join(repoRoot, 'packages', 'shared', 'node_modules')
  ]) {
    const resolved = path.resolve(target);
    if (!existsSync(resolved)) continue;
    assert(resolved.startsWith(repoRoot), `Refusing to delete outside repo: ${resolved}`);
    if (readdirSync(resolved).length === 0) rmSync(resolved, { recursive: true, force: true });
  }
}

function getExtensionId(extensionUrl) {
  return extensionUrl?.match(/^chrome-extension:\/\/([a-p]{32})\//)?.[1];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
