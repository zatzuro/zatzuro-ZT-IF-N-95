import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
interface Observation {
 id:string;sheet_name:string;source_row:number;kind:string;description:string;event_date:string|null;
 amount_cop:number|string|null;amount_usd:number|string|null;provenance:'documented'|'estimated'|'unverified'
}
const fmt=(amount:number|string|null,currency:'COP'|'USD')=>amount==null?'Sin importe documentado':new Intl.NumberFormat('es-CO',{style:'currency',currency,maximumFractionDigits:currency==='USD'?2:0}).format(Number(amount));
export default function SourceObservations({client,kinds,title}:{client:SupabaseClient;kinds:string[];title:string}){
 const [data,setData]=useState<Observation[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let live=true;
  async function load(){
   try{
    let all:Observation[]=[];
    for(let offset=0;offset<5000;offset+=500){
     const {data:page,error}=await client.from('financial_source_observations')
      .select('id,sheet_name,source_row,kind,description,event_date,amount_cop,amount_usd,provenance')
      .in('kind',kinds).order('sheet_name').order('source_row').range(offset,offset+499);
     if(error)throw error;
     all=all.concat((page||[]) as Observation[]);
     if(!page||page.length<500)break;
    }
    if(live)setData(all);
   }catch(e){if(live)setError(e instanceof Error?e.message:'Consulta rechazada');}
   finally{if(live)setLoading(false);}
  }
  void load();return()=>{live=false;};
 },[client,kinds.join('|')]);
 return <section className="fs-panel">
  <h2>{title}</h2>
  <p>Información conservada de la fuente, no necesariamente conciliada con efectivo o patrimonio actual. Las cuotas futuras NO son pagos efectuados.</p>
  {loading?<p>Consultando referencias protegidas…</p>:error?<p role="alert">{error}</p>:
  <><p><strong>{data.length}</strong> referencias privadas · {data.filter(r=>r.provenance==='estimated').length} estimadas · {data.filter(r=>r.provenance==='unverified').length} sin conciliación</p>
  <div className="fs-table-wrap"><table><thead><tr><th>Fuente</th><th>Concepto</th><th>Fecha</th><th>Valor / moneda</th><th>Estado</th></tr></thead>
  <tbody>{data.slice(0,100).map(r=><tr key={r.id}><td>{r.sheet_name} · fila {r.source_row}</td><td>{r.description}</td><td>{r.event_date||'No informada'}</td>
   <td>{r.amount_cop!=null?fmt(r.amount_cop,'COP'):r.amount_usd!=null?fmt(r.amount_usd,'USD'):'Sin valor acreditado'}</td>
   <td>{r.provenance==='documented'?'Documentado':r.provenance==='estimated'?'Estimación':'Por conciliar'}</td></tr>)}</tbody>
  </table></div>{data.length>100&&<small>Mostrando 100 referencias de {data.length}. El archivo privado conserva todas las filas.</small>}</>}
 </section>;
}
