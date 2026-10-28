const http = require('http');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as WebAssembly, so Metro must serve `.wasm`
// files as assets.
config.resolver.assetExts.push('wasm');

// expo-sqlite's web worker needs SharedArrayBuffer, which browsers only expose
// on cross-origin-isolated pages. `server.enhanceMiddleware` only wraps Metro's
// own routes, while Expo CLI serves the HTML page from earlier middleware — and
// the page's headers are what count. This file is loaded in the dev-server
// process, so add the headers to every response it sends. Dev server only;
// a hosted web build would need its host to send these headers itself.
const originalWriteHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  return originalWriteHead.apply(this, args);
};

// expo-secure-store has no web implementation, so on web only, route it to a
// localStorage-backed dev shim. Native platforms resolve the real module.
const secureStoreWebShim = path.resolve(__dirname, 'src/lib/secureStoreWebShim.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return { type: 'sourceFile', filePath: secureStoreWebShim };
  }
  // pdf-lib's tslib resolves to its `modules/index.js` ESM wrapper on web,
  // which crashes under Metro's CJS interop ("Cannot destructure '__extends'
  // of tslib.default"). Point it straight at the self-contained ES build.
  if (platform === 'web' && moduleName === 'tslib') {
    return context.resolveRequest(context, 'tslib/tslib.es6.js', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
