import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function handle(req: NextRequest, context: {params: Promise<{path: string[]}>}) {
  if(req.method==='POST') {
    let validOrigin=false
    try { validOrigin=!!req.headers.get('origin') && new URL(req.headers.get('origin')!).host===req.headers.get('host') } catch {}
    if(!validOrigin) return NextResponse.json({error:'请从本应用提交操作'},{status:403})
  }
  try {
    if(Number(req.headers.get('content-length') || 0)>100000) return NextResponse.json({error:'请求过大'},{status:413})
    const data = req.method==='POST'?await req.json():Object.fromEntries(req.nextUrl.searchParams)
    if(JSON.stringify(data).length>100000) return NextResponse.json({error:'请求过大'},{status:413})
    const token=req.cookies.get('physics_session')?.value || ''
    const args={expectedUser:req.headers.get('x-physics-user'),method:req.method,path:(await context.params).path,data,token:createHash('sha256').update(token).digest('hex')}
    const result=await new Promise<{status:number,data:Record<string,unknown>}>((resolve,reject)=>{
      const child=spawn(process.env.PHYSICS_PYTHON || path.join(process.cwd(),'.venv/bin/python'),[path.join(process.cwd(),'physics-exam-papers/_scripts/family_physics.py')],{stdio:['pipe','pipe','pipe']})
      let out=''; const timer=setTimeout(()=>{child.kill();reject(new Error('timeout'))},120000)
      child.stdout.on('data',b=>{out+=b.toString();if(out.length>8e6){child.kill();reject(new Error('large response'))}})
      child.stderr.resume();child.on('error',e=>{clearTimeout(timer);reject(e)})
      child.on('close',()=>{clearTimeout(timer);try{resolve(JSON.parse(out))}catch{reject(new Error('invalid response'))}})
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(args))
    })
    if(result.data._file){
      const file=await realpath(String(result.data._file));const bank=await realpath(process.env.PHYSICS_BANK_ROOT || path.join(process.cwd(),'physics-exam-papers/question-bank'))
      if(!file.startsWith(bank+path.sep)) throw new Error('invalid file')
      const ext=path.extname(file).toLowerCase();const type=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'} as Record<string,string>)[ext]
      if(!type) throw new Error('invalid type')
      return new NextResponse(await readFile(file),{headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
    }
    const session=result.data._session;const logout=result.data._logout;delete result.data._session;delete result.data._logout
    const response=NextResponse.json(result.data,{status:result.status,headers:{'Cache-Control':'no-store'}})
    if(session || logout) response.cookies.set('physics_session',session?String(session):'',{httpOnly:true,sameSite:'lax',secure:req.nextUrl.protocol==='https:' || req.headers.get('x-forwarded-proto')==='https',path:'/',maxAge:session?30*86400:0})
    return response
  } catch { return NextResponse.json({error:'服务暂时不可用，请稍后重试'},{status:500}) }
}
export const GET=handle
export const POST=handle
