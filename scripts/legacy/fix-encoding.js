const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory() && f !== 'node_modules') walk(full).forEach(x => files.push(x));
    else if (f.endsWith('.js') || f.endsWith('.jsx')) files.push(full);
  }
  return files;
}

const files = walk('C:/Projects/VALERIE/src');
let fixedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Remove control characters that break JSX (keep newline=10, tab=9, CR=13)
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Fix replacement characters in known string contexts
  content = content
    .replace(/let�s/g, "let's")
    .replace(/don�t/g, "don't")
    .replace(/can�t/g, "can't")
    .replace(/you�re/g, "you're")
    .replace(/it�s/g, "it's")
    .replace(/won�t/g, "won't")
    .replace(/�/g, '');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    fixedCount++;
    console.log('Fixed: ' + path.basename(file));
  }
}
console.log('Total: ' + fixedCount + ' files fixed');
