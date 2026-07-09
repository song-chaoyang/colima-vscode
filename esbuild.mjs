import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: [
    {
      out: 'extension',
      in: 'src/extension.ts'
    },
    {
      out: 'test/runTest',
      in: 'src/test/runTest.ts'
    },
    {
      out: 'test/suite/index',
      in: 'src/test/suite/index.ts'
    }
  ],
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: 'node',
  outfile: undefined,
  outdir: 'dist',
  external: ['vscode'],
  logLevel: 'info',
  target: 'node18',
  tsconfig: 'tsconfig.json'
});

if (watch) {
  await ctx.watch();
  console.log('[esbuild] watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('[esbuild] build complete');
}
