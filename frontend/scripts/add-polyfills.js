import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workerPath = path.resolve(__dirname, '../public/pdfjs/pdf.worker.min.mjs');

const polyfill = `// Polyfill for TC39 Uint8Array methods & Promise.withResolvers
if (typeof Uint8Array !== 'undefined') {
  if (!Uint8Array.prototype.toHex) {
    Uint8Array.prototype.toHex = function () {
      let hex = '';
      for (let i = 0; i < this.length; i++) {
        hex += this[i].toString(16).padStart(2, '0');
      }
      return hex;
    };
  }
  if (!Uint8Array.fromBase64) {
    Uint8Array.fromBase64 = function (b64) {
      const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      return arr;
    };
  }
}
if (typeof Promise !== 'undefined' && !Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
`;

if (fs.existsSync(workerPath)) {
  let content = fs.readFileSync(workerPath, 'utf8');
  if (!content.includes('Uint8Array.prototype.toHex')) {
    fs.writeFileSync(workerPath, polyfill + '\n' + content, 'utf8');
    console.log('Polyfill added to worker successfully');
  } else {
    console.log('Worker already contains polyfill');
  }
} else {
  console.error('Worker file not found at:', workerPath);
}
