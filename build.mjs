import { build } from 'esbuild'
import { copyFile } from 'node:fs/promises'
await copyFile('src/theme.css', '.build/theme.css')
await build({entryPoints:['.build/index.js'],outfile:'dist/index.js',bundle:true,platform:'node',format:'cjs',target:'node18',external:['@angular/*','tabby-*','rxjs','rxjs/*'],loader:{'.css':'text'}})
