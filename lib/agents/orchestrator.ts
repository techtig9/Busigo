export type AgentRole = 'chief_of_staff'|'sales'|'support'|'marketing'|'operations'|'finance'|'analyst';
export type OrchestrationTask = { id:string; title:string; role:AgentRole; dependsOn:string[]; risk:'low'|'medium'|'high'; approvalRequired:boolean };

const ROLE_KEYWORDS: Record<AgentRole,string[]> = {
  chief_of_staff:['coordinate','plan','manage','delegate','summarize'], sales:['lead','sales','prospect','crm','follow up'], support:['support','ticket','customer','complaint'], marketing:['marketing','campaign','content','social','newsletter'], operations:['operations','inventory','process','schedule'], finance:['invoice','payment','finance','expense','cashflow'], analyst:['analyze','report','kpi','metric','forecast']
};

export function selectAgentRoles(goal:string): AgentRole[] {
  const text=goal.toLowerCase(); const roles:AgentRole[]=[];
  (Object.keys(ROLE_KEYWORDS) as AgentRole[]).forEach(r=>{ if(ROLE_KEYWORDS[r].some(k=>text.includes(k))) roles.push(r); });
  if(!roles.length) roles.push('chief_of_staff');
  return Array.from(new Set(['chief_of_staff', ...roles]));
}

export function buildPlan(goal:string): OrchestrationTask[] {
  const roles=selectAgentRoles(goal); return roles.map((role,i)=>({id:`task_${i+1}`,title:i===0?'Coordinate objective':`Execute ${role.replaceAll('_',' ')} work`,role,dependsOn:i?['task_1']:[],risk:role==='finance'?'high':'low',approvalRequired:role==='finance'}));
}

export function validatePlan(tasks:OrchestrationTask[], maxDepth=5){
  if(tasks.length>20) throw new Error('Plan exceeds task limit');
  if(tasks.some(t=>t.dependsOn.includes(t.id))) throw new Error('Task cannot depend on itself');
  if(tasks.some(t=>t.dependsOn.length>5)) throw new Error('Dependency fan-in exceeds limit');
  const risky=tasks.filter(t=>t.risk!=='low' && !t.approvalRequired); if(risky.length) throw new Error('Risky tasks require approval');
  if(maxDepth<1) throw new Error('Invalid orchestration depth');
  return true;
}
