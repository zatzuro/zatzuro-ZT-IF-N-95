import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

interface SourceStatus {
 sheet_name:string; expected_rows:number; stored_rows:number;
 row_class:string; reconcile_state:string; batch_status:string;
}
interface Observation {kind:string;provenance:string}
const summary=(rows:Observation[])=>rows.reduce<Record<string,number>>((acc,row)=>{
 acc[row.kind]=(acc[row.kind]||0)+1;return acc;
},{});
export default function SourceMigration({client}:{client:SupabaseClient}){
 const [sources,setSources]=useState<SourceStatus[]>([]);
 const [observations,setObservations]=useState<Observation[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    const [a,b]=await Promise.all([
     client.from('source_migration_status').select('sheet_name,expected_rows,stored_rows,row_class,reconcile_state,batch_status').order('sheet_name'),
     client.from('financial_source_observations').select('kind,provenance').limit(1000)
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;
    if(active){setSources(a.data||[]);setObservations(b.data||[]);}
   }catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo comprobar el archivo privado.');}
   finally{if(active)setLoading(false);}
  }
  void load();return()=>{active=false;};
 },[client]);
 if(loading)return <section className="fs-panel">Comprobando el archivo histórico privado…</section>;
 if(error)return <section className="fs-panel" role="alert">No se puede comprobar el archivo histórico: {error}</section>;
 const complete=sources.length===13&&sources.every(s=>s.expected_rows===s.stored_rows&&s.batch_status==='verified');
 const totals=summary(observations);
 return <section className="fs-panel">
  <h2>Archivo privado de las 13 pestañas</h2>
  <p><strong>{complete?'Fuente íntegra y cotejada':'Fuente pendiente de cotejo'}</strong> · {sources.length}/13 pestañas · {sources.reduce((n,s)=>n+s.stored_rows,0)} filas conservadas.</p>
  <p>Archivo íntegro no implica contabilidad conciliada: créditos y fechas históricas requieren actualización; cuotas futuras, presupuestos y depósitos a inversión no son pagos ni gastos confirmados.</p>
  <div className="fs-table-wrap"><table><thead><tr><th>Origen</th><th>Filas fuente</th><th>Archivadas</th><th>Control</th></tr></thead>
  <tbody>{sources.map(s=><tr key={s.sheet_name}><td>{s.sheet_name}</td><td>{s.expected_rows}</td><td>{s.stored_rows}</td><td>{s.reconcile_state==='complete'?'Sin contenido':s.expected_rows===s.stored_rows?'Archivo completo · conciliación pendiente':'Diferencias'}</td></tr>)}</tbody>
  </table></div>
  <h3>Referencias financieras identificadas</h3>
  <p>{Object.entries(totals).map(([kind,n])=>kind.replaceAll('_',' ') + ': '+n).join(' · ')||'No se materializaron referencias.'}</p>
  <small>El detalle bancario permanece en Supabase protegido por propietario; las observaciones se muestran separadas del libro mayor.</small>
 </section>;
}
