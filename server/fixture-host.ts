import { build } from 'esbuild';
import { createServer } from 'node:http';
import path from 'node:path';
import ts from 'typescript';
import { ROOT } from './config.js';

const fixtureCss = `*{box-sizing:border-box}body{margin:0;background:#e7f1ef;color:#182536;font:14px/1.5 system-ui,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:18px}form{background:#fff;border:1px solid #dce6e3;border-radius:10px;padding:24px;display:grid;gap:14px;width:330px;max-width:100%}.form-eyebrow{font-size:10px;letter-spacing:1.4px;color:#536d68;font-weight:700}h1{font-size:22px;letter-spacing:-.8px;line-height:1.2;margin:0 0 2px}.form-subtitle{font-size:12px;color:#566779;margin:0 0 24px}.field{display:grid;gap:5px;margin:0}.field label,.field span{font-size:12px;font-weight:600}input:not([type=checkbox]){height:36px;border:1px solid #b6c5c2;border-radius:5px;padding:0 10px;width:100%;font:13px system-ui}input:focus-visible,button:focus-visible{outline:3px solid #126b61;outline-offset:3px}.terms{display:flex;align-items:center;gap:7px;font-size:11px;margin:0}.terms input{accent-color:#126b61;width:15px;height:15px}.submit{display:block;width:100%;text-align:center;border:0;border-radius:5px;background:#126b61;color:#fff;padding:11px;font:600 13px system-ui;cursor:pointer}.form-footnote{text-align:center;color:#566779;font-size:10px;margin:16px 0 0}.form-error{color:#ad3442;font-size:12px}.receipt{background:white;padding:32px;border-radius:10px;text-align:center}`;

export async function compileFixture(source: string): Promise<string> {
  if (Buffer.byteLength(source) > 40_000) throw new Error('Component exceeds the 40 KB source limit.');
  const parsed = ts.createSourceFile('Signup.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inspect = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (specifier && (!ts.isStringLiteral(specifier) || !['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(specifier.text))) throw new Error('Only React imports are supported in a standalone component.');
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) throw new Error('Dynamic imports and require are not supported in a standalone component.');
    ts.forEachChild(node, inspect);
  };
  inspect(parsed);
  // esbuild strips types; it does not reject semantic TypeScript errors.
  const file = path.join(ROOT, 'AccessFixComponent.tsx');
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, strict: true, esModuleInterop: true,
    skipLibCheck: true, noEmit: true, types: ['react'],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => path.resolve(name) === file
    ? ts.createSourceFile(file, source, languageVersion, true, ts.ScriptKind.TSX)
    : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  host.readFile = name => path.resolve(name) === file ? source : readFile(name);
  host.fileExists = name => path.resolve(name) === file || fileExists(name);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host))
    .filter(item => item.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length) {
    const details = diagnostics.slice(0, 4).map(item => {
      const line = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start).line + 1 : undefined;
      return `${line ? `Line ${line}: ` : ''}TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, ' ')}`;
    });
    throw new Error(`Component failed strict TypeScript checking (${diagnostics.length} errors). ${details.join(' ')} Fix the types without disabling checks.`);
  }
  const result = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Signup from 'accessfix-component';
      const events = []; Object.defineProperty(window, '__ACCESSFIX_EVENTS__', {value:events});
      function App(){const [done,setDone]=React.useState(false);return <main>{done ? <section className="receipt" role="status"><h1>Account created</h1><p>Your signup journey is complete.</p></section> : <Signup onSubmit={value=>{events.push(JSON.parse(JSON.stringify(value)));setDone(true)}}/>}</main>}
      createRoot(document.getElementById('root')).render(<App/>);`, loader: 'tsx', resolveDir: ROOT },
    bundle: true, write: false, format: 'iife', platform: 'browser', minify: true,
    define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic', logLevel: 'silent',
    plugins: [{ name: 'bounded-component', setup(builder) {
      builder.onResolve({ filter: /^accessfix-component$/ }, () => ({ path: 'Signup.tsx', namespace: 'component' }));
      builder.onLoad({ filter: /.*/, namespace: 'component' }, () => ({ contents: source, loader: 'tsx', resolveDir: ROOT }));
      builder.onResolve({ filter: /.*/, namespace: 'component' }, args => {
        if (!['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(args.path)) return { errors: [{ text: 'Only React imports are supported in a standalone component.' }] };
        return { path: path.join(ROOT, 'node_modules', args.path === 'react' ? 'react/index.js' : `${args.path}.js`) };
      });
    } }],
  });
  // Escape closing script sequences in source so a candidate cannot escape its script element.
  const bundle = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AccessFix signup fixture</title><style>${fixtureCss}</style></head><body><div id="root"></div><script>${bundle}</script></body></html>`;
}

export async function startFixture(html: string) {
  const server = createServer((req, res) => {
    if (req.url !== '/') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'" });
    res.end(html);
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start isolated fixture.');
  return { url: `http://127.0.0.1:${address.port}/`, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
