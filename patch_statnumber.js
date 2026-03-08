const fs = require('fs');
const path = '/home/yozorua/VocaRank/website/src/components/StatNumber.tsx';
let source = fs.readFileSync(path, 'utf8');
source = source.replace(/<span ref=\{ref\}>\s*\{new Intl\.NumberFormat\('en-US'\)\.format\(display\)\}\s*\{' '\}\s*\{suffix\}\s*<\/span>/, 
    `<span ref={ref} dir="auto" className="inline-flex items-center">\n            <bdi>{new Intl.NumberFormat('en-US').format(display)}</bdi>\n            <span className="mx-1"></span>\n            <bdi>{suffix}</bdi>\n        </span>`);
fs.writeFileSync(path, source);
