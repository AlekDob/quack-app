/**
 * Empty module polyfill for Node.js built-ins
 *
 * This file provides empty exports for Node.js modules (fs, path, os, crypto)
 * that some npm packages try to import but don't actually need in the browser.
 *
 * Used by vite.config.ts resolve.alias to prevent "Module name does not resolve to a valid URL" errors.
 *
 * @module polyfills/empty-module
 */

// Export common fs functions as no-ops
export const readFileSync = () => '';
export const writeFileSync = () => {};
export const existsSync = () => false;
export const mkdirSync = () => {};
export const readdirSync = () => [];
export const statSync = () => ({ isDirectory: () => false, isFile: () => false });
export const unlinkSync = () => {};
export const readFile = () => Promise.resolve('');
export const writeFile = () => Promise.resolve();
export const mkdir = () => Promise.resolve();
export const readdir = () => Promise.resolve([]);
export const stat = () => Promise.resolve({ isDirectory: () => false, isFile: () => false });
export const unlink = () => Promise.resolve();
export const access = () => Promise.resolve();
export const constants = {};

// Export common path functions
export const join = (...args: string[]) => args.join('/');
export const resolve = (...args: string[]) => args.join('/');
export const dirname = (p: string) => p.split('/').slice(0, -1).join('/');
export const basename = (p: string) => p.split('/').pop() || '';
export const extname = (p: string) => {
  const base = p.split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx) : '';
};
export const sep = '/';
export const delimiter = ':';
export const isAbsolute = () => false;
export const relative = () => '';
export const normalize = (p: string) => p;
export const parse = () => ({ root: '', dir: '', base: '', ext: '', name: '' });
export const format = () => '';

// Export common os functions
export const homedir = () => '/';
export const tmpdir = () => '/tmp';
export const platform = () => 'browser';
export const arch = () => 'unknown';
export const cpus = () => [];
export const freemem = () => 0;
export const totalmem = () => 0;
export const hostname = () => 'localhost';
export const type = () => 'Browser';
export const release = () => '0.0.0';
export const networkInterfaces = () => ({});
export const userInfo = () => ({ username: 'unknown', uid: -1, gid: -1, shell: '', homedir: '/' });
export const EOL = '\n';

// Export common crypto functions (browser-compatible)
export const randomBytes = (size: number) => new Uint8Array(size);
export const createHash = () => ({
  update: () => ({ digest: () => '' }),
});
export const createHmac = () => ({
  update: () => ({ digest: () => '' }),
});

// Export common url functions
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export const fileURLToPath = (url: string | URL) => typeof url === 'string' ? url : url.pathname;
export const pathToFileURL = (path: string) => new globalThis.URL(`file://${path}`);

// Export common util functions
export const promisify = (fn: Function) => (...args: unknown[]) =>
  new Promise((resolve, reject) =>
    fn(...args, (err: Error | null, result: unknown) => err ? reject(err) : resolve(result))
  );
export const inherits = () => {};
export const deprecate = (fn: Function) => fn;

// Default export for CommonJS compatibility
export default {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  unlink,
  access,
  constants,
  join,
  resolve,
  dirname,
  basename,
  extname,
  sep,
  delimiter,
  isAbsolute,
  relative,
  normalize,
  parse,
  format,
  homedir,
  tmpdir,
  platform,
  arch,
  cpus,
  freemem,
  totalmem,
  hostname,
  type,
  release,
  networkInterfaces,
  userInfo,
  EOL,
  randomBytes,
  createHash,
  createHmac,
  // url
  URL,
  URLSearchParams,
  fileURLToPath,
  pathToFileURL,
  // util
  promisify,
  inherits,
  deprecate,
};
