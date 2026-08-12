// Serveur statique minimal.
//
// Behind n'a aucune dépendance et aucune étape de compilation : il suffit
// de servir le dossier pour que le jeu tourne.
//
//   node tools/serve.js [port]

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 8000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, url === '/' ? 'index.html' : url);

  // On ne sert rien en dehors du dossier du jeu.
  if (!file.startsWith(root)) {
    res.writeHead(403).end('Interdit');
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Introuvable');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`\nBehind tourne sur  http://localhost:${port}`);
  // Le jeu se joue aussi au doigt : on affiche l'adresse à taper sur le
  // téléphone, sinon il faut aller la chercher soi-même.
  for (const [, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) {
        console.log(`Sur le téléphone   http://${a.address}:${port}  (même réseau)`);
      }
    }
  }
  console.log('');
});
