import { spawnSync } from 'node:child_process';

const repository = 'BIPreacher/BIPreacher.github.io';
const credentials = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
});
if (credentials.status !== 0) throw new Error('请先通过 Git Credential Manager 登录 GitHub');
const token = credentials.stdout.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
if (!token) throw new Error('未找到 GitHub 登录凭据');
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
const endpoint = `https://api.github.com/repos/${repository}`;
const current = await fetch(`${endpoint}/pages`, { headers });
if (current.status !== 404 && !current.ok) throw new Error(`读取 Pages 失败：HTTP ${current.status}`);
const response = await fetch(`${endpoint}/pages`, {
  method: current.status === 404 ? 'POST' : 'PUT', headers,
  body: JSON.stringify({ build_type: 'workflow' }),
});
if (!response.ok) {
  const result = await response.json();
  throw new Error(`配置 Pages 失败：HTTP ${response.status} ${result.message}`);
}
console.log('GitHub Pages 已设置为 GitHub Actions 发布：https://bipreacher.github.io/');
if (process.argv.includes('--dispatch')) {
  const dispatched = await fetch(`${endpoint}/actions/workflows/deploy.yml/dispatches`, { method: 'POST', headers, body: JSON.stringify({ ref: 'main' }) });
  if (!dispatched.ok) throw new Error(`启动部署失败：HTTP ${dispatched.status}`);
  console.log('已启动 Deploy Blog 工作流');
}
