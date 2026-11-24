// language: Node.js, file: scraper/_audit-site.js, purpose: audit local HTML/CSS image and script references plus page headings
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '_scratch', 'drafts', 'frontend-tools']);
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && SKIP.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && (ent.name.endsWith('.html') || ent.name.endsWith('.css'))) files.push(full);
  }
}
walk(ROOT);
const missing = [];
const noH1 = [];
const multiH1 = [];
let imageCount = 0;
let htmlCount = 0;
function decode(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
}
function existsRef(fromFile, raw) {
  const value = decode(raw.trim().split(/[?#]/)[0]);
  if (!value || value.startsWith('#') || /^(?:https?:|data:|blob:|mailto:|javascript:|\/\/)/i.test(value)) return true;
  const target = path.resolve(path.dirname(fromFile), value.replaceAll('/', path.sep));
  if (fs.existsSync(target)) return true;
  if (!path.extname(target) && fs.existsSync(path.join(target, 'index.html'))) return true;
  return false;
}
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    htmlCount++;
    const h1s = [...text.matchAll(/<h1\b/gi)].length;
    if (!h1s) noH1.push(path.relative(ROOT, file));
    if (h1s > 1) multiH1.push(`${path.relative(ROOT, file)} (${h1s})`);
    for (const match of text.matchAll(/<(?:img|source|video)\b[^>]*?\b(?:src|poster)=["']([^"']+)["']/gi)) {
      imageCount++;
      if (!existsRef(file, match[1])) missing.push(`${path.relative(ROOT, file)} -> ${match[1]}`);
    }
    for (const match of text.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)) {
      if (!existsRef(file, match[1])) missing.push(`${path.relative(ROOT, file)} -> ${match[1]}`);
    }
    for (const match of text.matchAll(/<a\b[^>]*?\bhref=["']([^"']+)["']/gi)) {
      const ref = match[1];
      if (/^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(ref)) continue;
      if (!existsRef(file, ref)) missing.push(`${path.relative(ROOT, file)} -> href:${ref}`);
    }
  } else {
    for (const match of text.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/gi)) {
      const ref = match[1].trim();
      if (/^(?:https?:|data:|#)/i.test(ref)) continue;
      if (!existsRef(file, ref)) missing.push(`${path.relative(ROOT, file)} -> url(${ref})`);
    }
  }
}
console.log(JSON.stringify({
  htmlPages: htmlCount,
  localImageRefs: imageCount,
  missingLocalRefs: missing.length,
  missingSamples: missing.slice(0, 40),
  pagesWithoutH1: noH1.slice(0, 30),
  pagesWithMultipleH1: multiH1.slice(0, 30)
}, null, 2));
