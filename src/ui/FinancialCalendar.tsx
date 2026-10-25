import {useState,type FormEvent} from 'react';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {formatCop} from '../domain/ledger';

export type CalendarEventRow={
 id:string;description:string;event_kind:'salary'|'commission'|'bonus'|'expense'|'card_payment'|'loan_payment'|'credit_advance'|'transfer'|'other';
 due_date:string;amount_cop:number|string;direction:'in'|'out';certainty:'confirmed'|'estimated';
 status:'pending'|'paid'|'cancelled'|'unverified';channel:'bank'|'payroll_deduction';
 source_reference:string|null;linked_movement_id:string|null;
};
const initial={description:'',event_kind:'expense',due_date:'',amount_cop:'',direction:'out',certainty:'estimated',channel:'bank',source_reference:''};

export default function FinancialCalendar({client,user,events,refresh}:{client:SupabaseClient;user:User;events:CalendarEventRow[];refresh:()=>Promise<void>}){
 const [form,setForm]=useState(initial);const [error,setError]=useState('');
 const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);
 const choose=(key:keyof typeof initial,value:string)=>setForm(current=>({...current,[key]:value}));
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError('');setMessage('');
  const amount=Number(form.amount_cop);
  if(!form.description.trim()||form.description.length>160||!Number.isFinite(amount)||amount<=0||
     !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date)||Number.isNaN(Date.parse(form.due_date))){
   setError('Se requiere descripción, fecha válida e importe positivo.');return;
  }
  if(form.certainty==='confirmed'&&!form.source_reference.trim()){
   setError('Un compromiso confirmado necesita referencia documental.');return;
  }
  setSaving(true);
  try{
   const {error:writeError}=await client.from('financial_calendar_events').insert({
    owner_id:user.id,description:form.description.trim(),event_kind:form.event_kind,
    due_date:form.due_date,amount_cop:amount,direction:form.direction,
    certainty:form.certainty,status:'pending',channel:form.channel,
    source_reference:form.source_reference.trim()||null
   });
   if(writeError)throw writeError;
   setForm(initial);setMessage('Evento planificado guardado en Supabase. No se creó un movimiento bancario.');await refresh();
  }catch(e){setError('No se guardó el evento: '+(e instanceof Error?e.message:String(e)));}
  finally{setSaving(false);}
 };
 const cancel=async(id:string)=>{
  if(!window.confirm('¿Cancelar este evento futuro? No elimina pagos ni registros bancarios.'))return;
  setSaving(true);setError('');setMessage('');
  try{
   const {data,error:e}=await client.from('financial_calendar_events').update({status:'cancelled'}).eq('owner_id',user.id).eq('id',id).select('id');
   if(e)throw e;
   if(!data?.length)throw new Error('El evento no se actualizó; verificar autorización.');
   setMessage('Evento cancelado y auditado.');await refresh();
  }catch(e){setError('No se canceló: '+(e instanceof Error?e.message:String(e)));}
  finally{setSaving(false);}
 };
 const visible=[...events].sort((a,b)=>a.due_date.localeCompare(b.due_date));
 return <section className="fs-calendar"><div className="fs-panel"><h2>Calendario de compromisos</h2>
  <p>Planifica futuros cobros y obligaciones. La tabla de programación NO modifica movimientos operativos y no confirma ningún pago. No cargues nuevamente gastos que ya estén registrados.</p>
  {error&&<div className="fs-warning" role="alert">{error}</div>}
  {message&&<div className="fs-success" role="status">{message}</div>}
  <form onSubmit={e=>void submit(e)} className="fs-calendar-form">
   <label>Concepto<input required value={form.description} maxLength={160} onChange={e=>choose('description',e.target.value)} placeholder="Ej.: factura mensual" /></label>
   <label>Tipo<select value={form.event_kind} onChange={e=>choose('event_kind',e.target.value)}>
    <option value="expense">Gasto comprometido</option><option value="card_payment">Pago de tarjeta</option>
    <option value="loan_payment">Cuota de deuda</option><option value="salary">Nómina neta</option>
    <option value="commission">Comisión neta por recibir</option><option value="bonus">Prima u otro bono</option>
    <option value="other">Otro ingreso/egreso</option>
   </select></label>
   <label>Fecha de vencimiento<input required type="date" value={form.due_date} onChange={e=>choose('due_date',e.target.value)} /></label>
   <label>Importe COP<input required type="number" min="0.01" step="0.01" value={form.amount_cop} onChange={e=>choose('amount_cop',e.target.value)}/></label>
   <label>Impacto<select value={form.direction} onChange={e=>choose('direction',e.target.value)}>
    <option value="out">Salida bancaria</option><option value="in">Entrada a caja</option>
   </select></label>
   <label>Certeza<select value={form.certainty} onChange={e=>choose('certainty',e.target.value)}>
    <option value="estimated">Estimado</option><option value="confirmed">Documentado</option>
   </select></label>
   <label>Canal<select value={form.channel} onChange={e=>choose('channel',e.target.value)}>
    <option value="bank">Cuenta bancaria</option><option value="payroll_deduction">Descuento de nómina (no segunda salida bancaria)</option>
   </select></label>
   <label>Referencia de soporte<input value={form.source_reference} onChange={e=>choose('source_reference',e.target.value)} placeholder="Archivo/fecha, sin números privados" /></label>
   <button className="fs-primary" disabled={saving} type="submit">Guardar evento futuro</button>
  </form></div>
  <section className="fs-panel"><h2>Eventos programados · {visible.length}</h2>
   <div className="fs-table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe COP</th><th>Estado</th><th>Fuente</th><th>Acción</th></tr></thead><tbody>
    {visible.map(event=><tr key={event.id}>
     <td>{event.due_date}</td><td>{event.description}<small className="fs-source-cell-sub">{event.event_kind} · {event.channel}</small></td>
     <td>{formatCop(Number(event.amount_cop))}<small className="fs-source-cell-sub">{event.direction==='in'?'Entrada':'Salida'}</small></td>
     <td>{event.status} · {event.certainty}</td><td>{event.source_reference||'Referencia pendiente'}</td>
     <td>{event.status==='pending'?<button type="button" disabled={saving} className="fs-text-button" onClick={()=>void cancel(event.id)}>Cancelar</button>:'Sin acción'}</td>
    </tr>)}
    {!visible.length&&<tr><td colSpan={6}>Sin fechas comprometidas verificadas o proyectadas.</td></tr>}
   </tbody></table></div>
  </section></section>;
}
