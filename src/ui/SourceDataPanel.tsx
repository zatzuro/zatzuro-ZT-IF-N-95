import {useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {documentComparison,inventory,orderedFamily,realNumber,type Family,type SourceRecord,type SourceSheet} from '../domain/sourceIntelligence';
type Mode='home'|Family;
const currency=(value:number|string|null,iso:'COP'|'USD')=>value===null?'Sin valor documentado':new Intl.NumberFormat('es-CO',{style:'currency',currency:iso,maximumFractionDigits:iso==='USD'?2:0}).format(Number(value));
const label=(kind:SourceRecord['kind'])=>({
 income_document:'Ingreso histórico',expense_document:'Egreso de origen',credit_balance:'Saldo de crédito',
 card_statement:'Extracto de tarjeta',investment_deposit:'Depósito a inversión',
 investment_position:'Posición sin valorar',budget_income:'Ingreso previsto',budget_expense:'Gasto presupuestado',
 loan_projection:'Cuota proyectada'
}[kind]);
const trust=(kind:SourceRecord['provenance'])=>kind==='documented'?'Documentado (sin conciliar)':kind==='estimated'?'Proyección / estimación':'Revisión pendiente';
async function readObservations(client:SupabaseClient):Promise<SourceRecord[]>{
 const all:SourceRecord[]=[];
 for(let index=0;index<50000;index+=400){
  const {data,error}=await client.from('financial_source_observations')
   .select('id,sheet_name,source_row,kind,description,event_date,amount_cop,amount_usd,provenance')
   .order('sheet_name').order('source_row').order('kind').range(index,index+399);
  if(error)throw error;
  all.push(...(data||[]) as SourceRecord[]);
  if(!data||data.length<400)return all;
 }
 throw new Error('Archivo superior al límite de visualización: ninguna cifra se presenta como total.');
}
const info:Record<Mode,string>={
 home:'Lectura directa de la copia verificada de Google Sheets ya archivada en Supabase. No incluye saldos actuales ni movimientos bancarios conciliados.',
 income:'Ingresos históricos documentados. El registro de nómina no confirma el abono en una cuenta bancaria.',
 expenses:'Salidas documentales y gastos por clasificar. No se asumen como consumo confirmado ni como pagos con tarjeta.',
 budget:'Presupuesto de origen: intenciones y proyecciones, nunca egresos ejecutados. No se suma automáticamente al gasto real.',
 debts:'Saldos de créditos y facturas con fecha histórica; las cuotas de los calendarios son previsiones, no pagos reales.',
 investments:'Depósitos históricos y posiciones eToro sin cotización financiera actual comprobada. No inferimos patrimonio, utilidad ni conversión USD/COP.'
};
const title:Record<Mode,string>={
 home:'Datos de tu base histórica en Supabase',income:'Histórico de ingresos migrados',
 expenses:'Histórico de egresos migrados',budget:'Presupuesto histórico migrado',
 debts:'Créditos y cronogramas migrados',investments:'eToro e inversiones migradas'
};
export default function SourceDataPanel({client,mode,referenceDate}:{client:SupabaseClient;mode:Mode;referenceDate:string}){
 const [rows,setRows]=useState<SourceRecord[]>([]);
 const [sheets,setSheets]=useState<SourceSheet[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState('');
 const [limit,setLimit]=useState(30);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');setRows([]);setSheets([]);
  Promise.all([
   readObservations(client),
   client.from('source_migration_status').select('sheet_name,expected_rows,stored_rows,row_class,reconcile_state,batch_status,verified_at').order('sheet_name')
  ]).then(([observations,status])=>{
   if(status.error)throw status.error;
   if(!live)return;
   if(!status.data||!status.data.length)throw new Error('Archivo original no disponible para este usuario.');
   setRows(observations);setSheets(status.data as SourceSheet[]);
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Sin lectura de archivo privado.')})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[client]);
 const meta=useMemo(()=>inventory(sheets,rows),[sheets,rows]);
 const historical=useMemo(()=>documentComparison(rows),[rows]);
 const selected=useMemo(()=>{
  if(mode==='home')return rows.filter(r=>r.kind==='income_document'||r.kind==='expense_document');
  return orderedFamily(rows,mode,referenceDate);
 },[rows,mode,referenceDate]);
 const filtered=useMemo(()=>selected.filter(row=>!filter||[row.description,row.sheet_name,row.kind,row.event_date||''].some(text=>text.toLocaleLowerCase('es-CO').includes(filter.toLocaleLowerCase('es-CO')))),[selected,filter]);
 const known=selected.filter(r=>r.provenance==='documented').length;
 const estimated=selected.filter(r=>r.provenance==='estimated').length;
 const unverified=selected.filter(r=>r.provenance==='unverified').length;
 const hasMore=filtered.length>limit;
 if(loading)return <section className="fs-panel fs-source" role="status">Consultando el archivo histórico protegido en Supabase…</section>;
 if(error)return <section className="fs-panel fs-source" role="alert">No se pudo consultar la información migrada. No se muestran cifras de ejemplo: {error}</section>;
 return <section className="fs-panel fs-source" aria-label={title[mode]}>
  <div className="fs-source-head"><div><small className="fs-source-kicker">FUENTE MIGRADA · SUPABASE</small><h2>{title[mode]}</h2><p>{info[mode]}</p></div><span className={'fs-source-status '+(meta.complete?'ok':'not-ok')}>{meta.complete?'Archivo verificado':'Revisión de archivo pendiente'}</span></div>
  {mode==='home'&&<>
   <div className="fs-source-kpis">
    <div><strong>{meta.tabCount}/13</strong><span>Hojas almacenadas</span></div>
    <div><strong>{meta.archived.toLocaleString('es-CO')}</strong><span>Filas originales</span></div>
    <div><strong>{meta.observations.toLocaleString('es-CO')}</strong><span>Referencias clasificadas</span></div>
    <div><strong>{meta.unverified}</strong><span>Referencias por revisar</span></div>
   </div>
   <p className="fs-source-disclaimer">Conservación de datos: {meta.archived} de {meta.expected} filas. El histórico NO equivale a saldos reconciliados de cuentas. Para nuevas operaciones utiliza las secciones operativas del dashboard.</p>
   {historical.length>0&&<div className="fs-source-chart"><div className="fs-source-section-title"><h3>Ingresos y egresos del archivo</h3><span>Últimos 6 meses con referencias · COP · documental, NO flujo de caja confirmado</span></div>
    <ResponsiveContainer width="100%" height={238}><BarChart data={historical}><CartesianGrid vertical={false} stroke="#edf2f5"/><XAxis dataKey="period"/><YAxis tickFormatter={v=>String(Math.round(Number(v)/1000000))+' M'}/><Tooltip formatter={v=>currency(Number(v),'COP')}/><Bar dataKey="income" name="Ingresos documentados" fill="#119b79" radius={[4,4,0,0]}/><Bar dataKey="expenses" name="Egresos documentados" fill="#5d8de8" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
   </div>}
  </>}
  {mode!=='home'&&<div className="fs-source-kpis fs-source-kpis-three">
   <div><strong>{selected.length}</strong><span>Referencias de origen</span></div>
   <div><strong>{known}</strong><span>Documentadas, por conciliar</span></div>
   <div><strong>{estimated+unverified}</strong><span>Estimadas / por verificar</span></div>
  </div>}
  {mode==='debts'&&<p className="fs-source-disclaimer">Los saldos de los cinco créditos ya están en el módulo operativo de créditos. La siguiente tabla permite consultar sus documentos y las cuotas previstas sin sumarlas de nuevo.</p>}
  {mode==='investments'&&<p className="fs-source-disclaimer">Una transferencia a eToro no es consumo; una posición histórica no demuestra valor de mercado actual. COP y USD se muestran separados y no se suman.</p>}
  {mode==='budget'&&<p className="fs-source-disclaimer">El archivo permite revisar partidas presupuestadas; antes de activar un límite mensual operativo debe conciliarse período, categoría y versión. No se han creado presupuestos falsos.</p>}
  <div className="fs-source-section-title"><h3>{mode==='home'?'Comprobantes de ingresos y egresos':'Detalle histórico por documento'}</h3><label>Buscar referencia<input aria-label={'Buscar en '+title[mode]} placeholder="Concepto, hoja o fecha" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(30)}}/></label></div>
  <div className="fs-table-wrap"><table><thead><tr><th>Referencia</th><th>Concepto</th><th>Fecha</th><th>Importe original</th><th>Calidad del dato</th></tr></thead><tbody>
   {filtered.slice(0,limit).map(r=><tr key={r.id}><td><strong>{label(r.kind)}</strong><small className="fs-source-cell-sub">{r.sheet_name} · fila {r.source_row}</small></td><td>{r.description}</td><td>{r.event_date||'Sin fecha acreditada'}</td>
    <td>{realNumber(r.amount_cop)!==null?currency(r.amount_cop,'COP'):'Sin COP válido'}{realNumber(r.amount_usd)!==null&&<small className="fs-source-cell-sub">{currency(r.amount_usd,'USD')} · moneda independiente</small>}</td><td>{trust(r.provenance)}</td></tr>)}
   {!filtered.length&&<tr><td colSpan={5}>No hay referencias con el filtro actual. No se sustituyen por valores ficticios.</td></tr>}
  </tbody></table></div>
  <div className="fs-source-foot"><span>Mostrando {Math.min(filtered.length,limit)} de {filtered.length} referencias filtradas · {selected.length} en esta sección.</span>{hasMore&&<button type="button" className="fs-small" onClick={()=>setLimit(n=>n+50)}>Mostrar 50 más</button>}</div>
 </section>;
}
