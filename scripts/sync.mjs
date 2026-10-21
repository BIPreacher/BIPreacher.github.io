import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { projectRoot, inputFiles, importArticles } from './import-articles.mjs';

const expectedRemote = 'https://github.com/BIPreacher/BIPreacher.github.io.git';
const stateDirectory = path.join(projectRoot, '.blog-sync');
const isGenerated = file => /^src\/content\/blog\/auto-[a-f0-9]{20}\.md$/.test(file) || /^public\/uploads\/[a-f0-9]{24}\.[a-z0-9]+$/.test(file);
const watching = process.argv.includes('--watch');
await mkdir(stateDirectory, { recursive: true });

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: projectRoot, encoding: 'utf8', timeout: 180000, windowsHide: true,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 失败：${result.stderr || result.error?.message || result.status}`);
  return result.stdout ?? '';
}

const git = (...args) => run('git', ['-c', `safe.directory=${projectRoot.replaceAll('\\', '/')}`, '-c', 'core.quotePath=false', ...args], true).trimEnd();
async function status(state, message) {
  const value = { state, message, time: new Date().toISOString(), pid: process.pid };
  await writeFile(path.join(stateDirectory, 'status.json'), JSON.stringify(value, null, 2));
  console.log(`[${value.time}] ${message}`);
}
async function fingerprint() {
  const checksum = createHash('sha256');
  for (const file of await inputFiles(path.join(projectRoot, '文章'))) {
    checksum.update(path.relative(projectRoot, file));
    checksum.update(await readFile(file));
  }
  return checksum.digest('hex');
}

async function sync(expectedFingerprint) {
  if (git('remote', 'get-url', 'origin') !== expectedRemote) throw new Error('origin 与已授权的博客仓库不一致');
  if (git('branch', '--show-current') !== 'main') throw new Error('请切换到 main 后再同步');
  git('rev-parse', '--verify', 'HEAD');
  if (git('diff', '--cached', '--name-only')) throw new Error('暂存区有其他操作，请先完成该提交');
  const dirty = git('status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0').filter(Boolean).map(line => line.slice(3));
  if (dirty.some(file => !isGenerated(file))) throw new Error('项目代码存在未提交改动，请先完成代码提交再自动发布');
  const imported = await importArticles();
  imported.notices.forEach(notice => console.warn(notice));
  git('fetch', 'origin', 'main');
  const [ahead, behind] = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split(/\s+/).map(Number);
  if (behind) throw new Error('GitHub 上有新提交，请先手动同步远端更改');
  run(process.execPath, [path.join(projectRoot, 'node_modules/astro/bin/astro.mjs'), 'check']);
  run(process.execPath, [path.join(projectRoot, 'node_modules/astro/bin/astro.mjs'), 'build']);
  if (await fingerprint() !== expectedFingerprint) throw new Error('文件仍在变化，等待保存稳定后重试');
  const changedBeforeStage = git('status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0').filter(Boolean).map(line => line.slice(3));
  if (changedBeforeStage.some(file => !isGenerated(file))) throw new Error('构建期间项目代码发生改动，停止自动提交');
  if (changedBeforeStage.length) git('add', '-A', '--', 'src/content/blog', 'public/uploads');
  const changed = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  if (changed.some(file => !isGenerated(file))) throw new Error('检测到自动导入范围之外的文件，停止提交');
  if (changed.length) git('commit', '-m', `自动发布：同步 ${imported.count} 篇每日思考`);
  if (changed.length || ahead) git('push', 'origin', 'HEAD:main');
  await status('synced', `${changed.length || ahead ? '已推送 GitHub，等待 Actions 发布' : '已同步，无需发布'}；文章 ${imported.count} 篇${imported.notices.length ? '；注意：' + imported.notices.join('；') : ''}`);
}

const lockFile = path.join(stateDirectory, 'sync.lock');
let lock;
try { lock = await open(lockFile, 'wx'); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const pid = Number(await readFile(lockFile, 'utf8'));
  if (!Number.isInteger(pid) || pid < 1) throw new Error('同步锁异常，请检查 .blog-sync/sync.lock');
  let alive = true;
  try { process.kill(pid, 0); }
  catch (checkError) { if (checkError.code === 'ESRCH') alive = false; else throw checkError; }
  if (alive) { console.log(`同步程序已运行（PID ${pid}）`); process.exit(0); }
  await unlink(lockFile);
  lock = await open(lockFile, 'wx');
}
await lock.writeFile(String(process.pid));
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
try {
  if (!watching) await sync(await fingerprint());
  else {
    await status('watching', '自动发布已启动；文件保存稳定 10 秒后同步');
    let last = '', completed = '', stableSince = Date.now(), retryAt = 0;
    while (!stopping) {
      try {
        const current = await fingerprint();
        if (current !== last) { last = current; stableSince = Date.now(); }
        if (current !== completed && Date.now() - stableSince >= 10000 && Date.now() >= retryAt) {
          await sync(current);
          completed = current;
          retryAt = 0;
        }
      } catch (error) {
        await status('error', error.message);
        retryAt = Date.now() + 60000;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
} catch (error) { await status('error', error.message); process.exitCode = 1; }
finally { await lock.close(); await unlink(lockFile); }
