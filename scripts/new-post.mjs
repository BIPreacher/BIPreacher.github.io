import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const args = process.argv.slice(2).filter(arg => arg !== '--');
const title = args[0];
if (!title || args.length > 2) {
  console.error('用法：pnpm new "今天的思考" [可选英文短链接]');
  process.exit(1);
}
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const slug = (args[1] || title).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80);
if (!slug) { console.error('标题或短链接至少需要一个文字或数字。'); process.exit(1); }
const file = resolve('src/content/blog', `${date}-${slug}.md`);
const content = `---\ntitle: ${JSON.stringify(title)}\ndescription: "用一句话概括今天的思考"\npubDate: ${date}\ntags: ["日常思考"]\ndraft: true\n---\n\n## 今天发生了什么\n\n写下一个值得记住的片段。\n\n## 我的思考\n\n它让我想到了什么？\n\n## 接下来想尝试\n\n一个小小的行动。\n`;
await mkdir(dirname(file), { recursive: true });
try { await writeFile(file, content, { flag: 'wx' }); }
catch (error) { if (error.code === 'EEXIST') { console.error('同名文章已存在，请换一个短链接；原文件未修改。'); process.exit(1); } throw error; }
console.log(`已创建草稿：${file}\n写完后将 draft: true 改为 draft: false，再提交推送。`);
