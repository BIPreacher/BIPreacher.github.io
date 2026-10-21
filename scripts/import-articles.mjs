import { readdir, readFile, writeFile, mkdir, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const articleTypes = new Set(['.md', '.markdown', '.txt', '.docx']);
const mediaTypes = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.mp3', '.m4a', '.wav', '.ogg', '.pdf']);
const digest = value => createHash('sha256').update(value).digest('hex');
const articleId = relative => `auto-${digest(relative).slice(0, 20)}`;
const dateInShanghai = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);

export async function inputFiles(directory) {
  const files = [];
  await mkdir(directory, { recursive: true });
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (/^[._~]/.test(entry.name)) continue;
      if (entry.isSymbolicLink()) throw new Error(`投稿目录不能包含符号链接：${entry.name}`);
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  await walk(directory);
  return files.sort();
}

async function writeChanged(file, content) {
  const bytes = Buffer.from(content);
  try { if ((await readFile(file)).equals(bytes)) return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, bytes);
  await rename(`${file}.tmp`, file);
}

export async function importArticles(root = projectRoot) {
  const inbox = path.join(root, '文章');
  const files = await inputFiles(inbox);
  const available = new Set(files);
  const manifestFile = path.join(root, '.blog-sync/manifest.json');
  let previous = { articles: {} };
  try { previous = JSON.parse(await readFile(manifestFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const manifest = { articles: {} };
  const outputs = new Map();
  const notices = [];
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    const relative = path.relative(inbox, file).split(path.sep).join('/');
    if (!articleTypes.has(extension)) {
      if (!mediaTypes.has(extension)) notices.push(`未导入 ${relative}，支持 Markdown、UTF-8 TXT 和 DOCX。`);
      continue;
    }
    const id = articleId(relative);
    let body;
    if (extension === '.docx') {
      const result = await mammoth.convertToHtml({ path: file }, {
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(async image => {
          const imageExtension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }[image.contentType];
          if (!imageExtension) throw new Error(`${relative} 中的图片格式不支持：${image.contentType}`);
          const bytes = await image.read();
          const name = `${digest(bytes).slice(0, 24)}${imageExtension}`;
          outputs.set(`public/uploads/${name}`, bytes);
          return { src: `../../uploads/${name}` };
        }),
      });
      body = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(result.value);
      notices.push(...result.messages.map(message => `${relative}：${message.message}`));
    } else {
      body = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file)).replace(/^\uFEFF/, '');
    }
    let metadata = {};
    if (extension !== '.txt' && /^---\r?\n/.test(body)) {
      const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!match) throw new Error(`${relative} 的文章信息缺少结束分隔线 ---`);
      metadata = parse(match[1]) ?? {};
      if (typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(`${relative} 的文章信息格式有误`);
      body = body.slice(match[0].length);
    }
    if (metadata.draft === true) continue;
    if (metadata.draft !== undefined && metadata.draft !== false) throw new Error(`${relative} 的 draft 只能为 true 或 false`);
    if (!body.trim()) throw new Error(`${relative} 为空，等待文件写入完成`);
    const fileStat = await stat(file);
    const savedDate = previous.articles[relative]?.date;
    const date = metadata.pubDate ? new Date(metadata.pubDate) : new Date(`${savedDate || dateInShanghai(fileStat.birthtimeMs > 0 ? fileStat.birthtime : fileStat.mtime)}T00:00:00+08:00`);
    if (Number.isNaN(date.valueOf())) throw new Error(`${relative} 的 pubDate 无效`);
    const title = metadata.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(file, path.extname(file));
    const description = metadata.description ?? body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#>*`\[\]~_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const tags = metadata.tags ?? ['日常思考'];
    if (typeof title !== 'string' || typeof description !== 'string' || !Array.isArray(tags) || tags.some(tag => typeof tag !== 'string')) throw new Error(`${relative} 的标题、简介或标签格式有误`);
    async function asset(url) {
      if (typeof url !== 'string') throw new Error(`${relative} 的资源地址应为字符串`);
      if (/^(https?:\/\/|#)/i.test(url)) return url;
      if (url.startsWith('../../uploads/') && outputs.has(`public/${url.slice(6)}`)) return url;
      const local = path.resolve(path.dirname(file), decodeURIComponent(url));
      if (!available.has(local) || !mediaTypes.has(path.extname(local).toLowerCase())) throw new Error(`${relative} 找不到附件：${url}。请使用投稿目录内的相对路径或完整 https 地址。`);
      const bytes = await readFile(local);
      if (bytes.length > 50 * 1024 * 1024) throw new Error(`${relative} 的附件超过 50MB，请改用外部地址`);
      const name = `${digest(bytes).slice(0, 24)}${path.extname(local).toLowerCase()}`;
      outputs.set(`public/uploads/${name}`, bytes);
      return `../../uploads/${name}`;
    }
    const processor = unified().use(remarkParse).use(remarkStringify);
    const tree = extension === '.txt'
      ? { type: 'root', children: body.trim().split(/\r?\n\s*\r?\n/).map(value => ({ type: 'paragraph', children: [{ type: 'text', value }] })) }
      : processor.parse(body);
    const nodes = [];
    visit(tree, node => {
      if (['image', 'definition', 'link'].includes(node.type) && node.url && !/^(https?:\/\/|mailto:|#)/i.test(node.url)) nodes.push(node);
    });
    for (const node of nodes) {
      const [target, anchor] = node.url.split('#');
      const linkedFile = path.resolve(path.dirname(file), decodeURIComponent(target));
      if (node.type !== 'image' && available.has(linkedFile) && articleTypes.has(path.extname(linkedFile).toLowerCase())) {
        node.url = `../${articleId(path.relative(inbox, linkedFile).split(path.sep).join('/'))}/${anchor ? `#${anchor}` : ''}`;
      } else node.url = await asset(node.url);
    }
    const data = { title, description, pubDate: dateInShanghai(date), tags, draft: false };
    for (const key of ['image', 'audio']) if (metadata[key]) {
      const url = await asset(metadata[key]);
      data[key] = url.startsWith('../../') ? url.slice(5) : url;
    }
    outputs.set(`src/content/blog/${id}.md`, `---\n${stringify(data)}---\n\n${processor.stringify(tree)}`);
    manifest.articles[relative] = { id, date: data.pubDate };
  }
  for (const entry of Object.values(previous.articles)) if (!/^auto-[a-f0-9]{20}$/.test(entry.id)) throw new Error('导入记录损坏，请检查 manifest.json');
  for (const [relative, bytes] of outputs) await writeChanged(path.join(root, relative), bytes);
  const currentIds = new Set(Object.values(manifest.articles).map(entry => entry.id));
  for (const entry of Object.values(previous.articles)) if (!currentIds.has(entry.id)) {
    try { await unlink(path.join(root, 'src/content/blog', `${entry.id}.md`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeChanged(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { count: currentIds.size, notices };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await importArticles()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
