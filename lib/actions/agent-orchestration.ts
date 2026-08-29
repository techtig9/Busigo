'use server';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildPlan, validatePlan } from '@/lib/agents/orchestrator';

export async function createOrchestration(goal:string){
  const supabase=createServerSupabase(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error('Unauthorized'); if(!goal?.trim()) throw new Error('Goal is required');
  const tasks=buildPlan(goal); validatePlan(tasks);
  const {data,error}=await supabase.from('agent_orchestrations').insert({user_id:user.id,goal,status:'planned',tasks}).select('id,goal,status,tasks').single();
  if(error) throw new Error(error.message); return data;
}
