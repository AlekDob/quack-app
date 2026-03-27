// Brain: sdk-requires-node22-disposable
// CJS polyfill for Symbol.dispose / Symbol.asyncDispose
// Loaded via --require BEFORE ESM modules, solving the hoisting problem:
// The Claude Agent SDK captures Symbol.dispose at module level during ESM loading.
// An inline polyfill in stream-daemon.js arrives too late because ESM imports
// are hoisted above all other code. This CJS file runs before any ESM evaluation.
//
// Only needed for Node.js 20-21. Node 22+ has native Symbol.dispose.

if (typeof Symbol.dispose === 'undefined') {
  Symbol.dispose = Symbol('Symbol.dispose');
}
if (typeof Symbol.asyncDispose === 'undefined') {
  Symbol.asyncDispose = Symbol('Symbol.asyncDispose');
}
