// Build the family physics application independently of unrelated exam services.
import {cpSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import path from 'node:path'
const out=process.argv[2]||'/build'
mkdirSync(out,{recursive:true})
for(const item of ['app/physics','app/api/physics','app/globals.css','components/MathRenderer.tsx','public','postcss.config.mjs','tailwind.config.ts']){
 try{mkdirSync(path.dirname(path.join(out,item)),{recursive:true});cpSync(item,path.join(out,item),{recursive:true})}catch(e){if(e.code!=='ENOENT')throw e}
}
writeFileSync(path.join(out,'app/layout.tsx'),`import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}`)
writeFileSync(path.join(out,'app/page.tsx'),`import {redirect} from 'next/navigation';export default function Home(){redirect('/physics')}`)
writeFileSync(path.join(out,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],strict:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',plugins:[{name:'next'}],paths:{'@/*':['./*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}))
writeFileSync(path.join(out,'next.config.js'),`module.exports={output:'standalone',experimental:{cpus:1},eslint:{ignoreDuringBuilds:true}}`)
const lock=JSON.parse(readFileSync('package-lock.json','utf8'))
const deps={};for(const name of ['next','react','react-dom','katex','typescript','@types/node','@types/react','@types/react-dom','tailwindcss','postcss','autoprefixer'])deps[name]=lock.packages['node_modules/'+name].version
// Latest patch releases verified from the npm registry for these existing release lines.
deps.next='15.1.12';deps.react='19.0.9';deps['react-dom']='19.0.9'
writeFileSync(path.join(out,'package.json'),JSON.stringify({name:'family-physics',private:true,version:'1.0.0',scripts:{build:'next build'},dependencies:deps},null,2))
