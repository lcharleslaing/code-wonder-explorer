import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ignoreDirs = ['node_modules', 'dist', '.git', 'release', 'snapshots'];
const ignoreFilePatterns = [
  /^\.env/, // .env, .env.*, etc
  /\.png$/i, /\.jpg$/i, /\.jpeg$/i, /\.gif$/i, /\.ico$/i, /\.svg$/i, /\.webp$/i, // images
  /\.pdf$/i, /\.lockb$/i, // binary
];

const now = new Date();
const date = now.toLocaleDateString('en-US').replace(/\//g, '-'); // MM-DD-YYYY
const time = now.toLocaleTimeString('en-US', { hour12: true }).replace(/:/g, '-').replace(/ /g, '');
const timestamp = `${date}_${time}`;

const snapshotDir = 'snapshots';
const snapshotFile = `project-snapshot-${timestamp}.md`;
const fullPath = path.join(snapshotDir, snapshotFile);

const __filename = fileURLToPath(import.meta.url);

function isIgnored(fileOrDir) {
  // Ignore by directory name
  if (ignoreDirs.some(dir => fileOrDir === dir)) return true;
  // Ignore by file pattern
  return ignoreFilePatterns.some(pattern => pattern.test(fileOrDir));
}

function isBinaryFile(filePath) {
  // Simple check: if extension is in ignoreFilePatterns, treat as binary
  return ignoreFilePatterns.some(pattern => pattern.test(filePath));
}

function getLanguageFromExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.js' || ext === '.cjs' || ext === '.mjs') return 'javascript';
  if (ext === '.ts') return 'typescript';
  if (ext === '.tsx') return 'tsx';
  if (ext === '.json') return 'json';
  if (ext === '.md') return 'markdown';
  if (ext === '.css') return 'css';
  if (ext === '.html') return 'html';
  if (ext === '.sh') return 'bash';
  if (ext === '.yml' || ext === '.yaml') return 'yaml';
  if (ext === '.toml') return 'toml';
  if (ext === '.lockb') return ''; // don't include
  return '';
}

function walkAndCapture(dir, relDir = '.') {
  let output = '';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (isIgnored(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      output += `\n## Directory: ${rel}\n`;
      output += walkAndCapture(full, rel);
    } else if (!isBinaryFile(entry.name)) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        const lang = getLanguageFromExtension(entry.name);
        output += `\n### File: ${rel}\n`;
        output += `\n${lang}\n${content}\n\n`;
        // Debugging output
        console.log(`Included file: ${rel}`);
      } catch (e) {
        output += `\n### File: ${rel} (Could not read: ${e.message})\n`;
        console.log(`Could not read file: ${rel}`);
      }
    }
  }
  return output;
}

function generateSnapshot() {
  if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir);
  let snapshot = `# Project Structure and Contents\n\n`;
  snapshot += walkAndCapture('.', '.').replace(/\u007F\u007F\u007F/g, '```');
  fs.writeFileSync(fullPath, snapshot, 'utf8');
  console.log(`📸 Snapshot saved: ${fullPath}`);
}

generateSnapshot();
