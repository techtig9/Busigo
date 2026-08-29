import { NextResponse } from 'next/server';
import { createOrchestration } from '@/lib/actions/agent-orchestration';
export async function POST(req:Request){ try { const body=await req.json(); const data=await createOrchestration(body.goal); return NextResponse.json(data,{status:201}); } catch(e){ return NextResponse.json({error:e instanceof Error?e.message:'Unable to orchestrate'},{status:400}); } }
