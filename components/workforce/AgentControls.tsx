"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
const CAPABILITIES = [["read","business_data"],["read","documents"],["read","crm"],["write","crm"],["send","email"],["create","calendar_event"],["create","workflow"],["publish","marketing"],["finance","invoices"]];
export function AgentControls({ agent, permissions, saveAction }: { agent:any; permissions:any[]; saveAction:(formData:FormData)=>void }) {
 const initial=CAPABILITIES.map(([capability,resource])=>{const f=permissions.find(p=>p.capability===capability&&p.resource===resource);return {capability,resource,allowed:f?.allowed??false,requires_approval:f?.requires_approval??true};});
 const [rows,setRows]=useState(initial); const [open,setOpen]=useState(false);
 const update=(i:number,k:"allowed"|"requires_approval",v:boolean)=>setRows(r=>r.map((x,j)=>j===i?{...x,[k]:v}:x));
 return <div className="mt-4"><Button type="button" variant="secondary" onClick={()=>setOpen(!open)}>{open?"Hide controls":"Permissions & controls"}</Button>{open&&<form action={saveAction} className="mt-4 space-y-3 rounded border border-hairline bg-surface p-4"><input type="hidden" name="agent_id" value={agent.id}/><input type="hidden" name="permissions" value={JSON.stringify(rows)}/>{rows.map((row,i)=><div key={`${row.capability}-${row.resource}`} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-ink"><strong>{row.capability}</strong> {row.resource}</span><span className="flex gap-4 text-xs text-slate"><label><input type="checkbox" checked={row.allowed} onChange={e=>update(i,"allowed",e.target.checked)}/> allowed</label><label><input type="checkbox" checked={row.requires_approval} onChange={e=>update(i,"requires_approval",e.target.checked)}/> approval</label></span></div>)}<Button type="submit">Save permissions</Button></form>}</div>;
}
