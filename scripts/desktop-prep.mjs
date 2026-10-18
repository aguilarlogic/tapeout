// Copies the built game (dist/index.html) into the desktop app as desktop/app/Tapeout.html, adding a Content Security
// Policy meta tag that only the exe gets: everything comes from the page itself, so nothing can be fetched.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const CSP = "default-src 'self' 'unsafe-inline' data: blob:";
const html = readFileSync('dist/index.html', 'utf8');
if (!html.includes('<head>')) throw new Error('dist/index.html has no <head>; run npm run build first');
mkdirSync('desktop/app', { recursive: true });
writeFileSync('desktop/app/Tapeout.html', html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`));
console.log('wrote desktop/app/Tapeout.html');
