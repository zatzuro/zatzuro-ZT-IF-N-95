import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {BarChart3, BriefcaseBusiness, CreditCard, FileText, Goal, Home, LogOut, Plus, RefreshCcw, ShieldCheck, Sparkles, UploadCloud, Wallet} from 'lucide-react';
import {budgetStatus,calculateBalances,findings,money,monthly,type FinanceData} from '../domain/private';
import {previewCsv,SHEET_MAPPING,type ImportKind,type Preview} from '../domain/migration';
import {formatCop} from '../domain/ledger';
import SourceMigration from './SourceMigration';
import SourceDataPanel from './SourceDataPanel';
import Home360 from './Home360';
import {manualDebtPayload} from '../domain/manualDebt';

const empty=():FinanceData=>({accounts:[],categories:[],movements:[],budgets:[],debts:[],investments:[],goals:[],financial_findings:[]});
const tables=['accounts','categories','movements','budgets','debts','investments','goals','financial_findings'] as const;
type Table=typeof tables[number];
type Module='Inicio'|'Ingresos'|'Gastos'|'Presupuesto'|'Créditos'|'Inversiones'|'Patrimonio'|'Metas'|'Cerebro financiero'|'Datos migrados'|'Configuración';
const menu: {name:Module;icon:typeof Home}[]=[
 {name:'Inicio',icon:Home},{name:'Ingresos',icon:Wallet},{name:'Gastos',icon:Wallet},
 {name:'Presupuesto',icon:FileText},{name:'Créditos',icon:CreditCard},{name:'Inversiones',icon:BriefcaseBusiness},
 {name:'Patrimonio',icon:BarChart3},{name:'Metas',icon:Goal},{name:'Cerebro financiero',icon:Sparkles},
 {name:'Datos migrados',icon:UploadCloud},{name:'Configuración',icon:ShieldCheck}];
const labels:Record<Table,string>={accounts:'Cuentas',categories:'Categorías',movements:'Movimientos',budgets:'Presupuestos',debts:'Créditos',investments:'Inversiones',goals:'Metas',financial_findings:'Hallazgos'};
const cop=(n:number)=>formatCop(n);
const nowPeriod=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Bogota'}).slice(0,7);
const dateToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Bogota'});
const monthEnd=(p:string)=>new Date(Date.UTC(Number(p.slice(0,4)),Number(p.slice(5,7)),0)).toISOString().slice(0,10);
async function readAll(client:SupabaseClient,table:Table):Promise<unknown[]> {
 const results:unknown[]=[];
 for(let offset=0;offset<50000;offset+=500){
  const {data,error}=await client.from(table).select('*').order('created_at',{ascending:false}).range(offset,offset+499);
  if(error)throw error;
  results.push(...(data||[]));
  if((data||[]).length<500)return results;
 }
 throw new Error('Límite de paginación alcanzado; el tablero no mostrará cifras incompletas.');
}
function errorText(e:unknown){return e instanceof Error?e.message:String(e)}
export default function FinanceApp({client,user,onExit}:{client:SupabaseClient;user:User;onExit:()=>Promise<void>}){
 const [active,setActive]=useState<Module>('Inicio');
 const [data,setData]=useState<FinanceData>(empty());
 const [period,setPeriod]=useState(nowPeriod);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [form,setForm]=useState<Record<string,string>>({});
 const [openForm,setOpenForm]=useState<Table|null>(null);
 const [openTransfer,setOpenTransfer]=useState(false);
 const [source,setSource]=useState<ImportKind>('GASTOS');
 const [csv,setCsv]=useState('');
 const [incomeAccount,setIncomeAccount]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null);
 const [search,setSearch]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const arrays=await Promise.all(tables.map(t=>readAll(client,t)));
   const fresh=empty();
   for(let i=0;i<tables.length;i++)(fresh as unknown as Record<string,unknown>)[tables[i]]=arrays[i];
   setData(fresh);
  }catch(e){setError('Error de carga; no se muestran cifras antiguas: '+errorText(e));setData(empty());}
  finally{setLoading(false);}
 },[client]);
 useEffect(()=>{void refresh();},[refresh]);
 const balance=useMemo(()=>calculateBalances(data),[data]);
 const flow=useMemo(()=>monthly(data,period),[data,period]);
 const budgets=useMemo(()=>budgetStatus(data,period),[data,period]);
 const brain=useMemo(()=>findings(data,period),[data,period]);
 const six=useMemo(()=>Array.from({length:6},(_,index)=>{const d=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7))-6+index,1));const p=d.toISOString().slice(0,7);return {period:p,...monthly(data,p)};}),[data,period]);
 const open=(t:Table)=>{setForm({currency:'COP',balance_kind:'documented',value_kind:'estimated',flow_type:'expense'});setOpenForm(t);setError('');};
 const createRecord=async(e:FormEvent)=>{
  e.preventDefault();if(!openForm)return;
  setBusy(true);setError('');
  try{
   const n=(key:string)=>{const val=Number(form[key]);if(!Number.isFinite(val))throw new Error('Número inválido: '+key);return val;};
   let payload:Record<string,unknown>={owner_id:user.id};
   if(openForm==='accounts')payload={...payload,name:form.name,account_type:form.account_type||'checking',currency:'COP',opening_balance:n('opening_balance'),balance_as_of:form.balance_as_of||dateToday(),balance_kind:form.balance_kind};
   else if(openForm==='categories')payload={...payload,name:form.name,flow_type:form.flow_type};
   else if(openForm==='movements')payload={...payload,account_id:form.account_id,category_id:form.category_id,occurred_at:form.occurred_at,description:form.description,amount:n('amount'),currency:'COP',movement_type:active==='Ingresos'?'income':'expense'};
   else if(openForm==='budgets')payload={...payload,category_id:form.category_id,period_start:period+'-01',period_end:monthEnd(period),amount:n('amount'),currency:'COP'};
   else if(openForm==='debts')payload={...payload,...manualDebtPayload(form,dateToday())};
   else if(openForm==='investments')payload={...payload,name:form.name,asset_type:form.asset_type||'other',market_value:n('market_value'),valued_at:new Date().toISOString(),value_kind:form.value_kind,currency:'COP'};
   else if(openForm==='goals')payload={...payload,name:form.name,target_amount:n('target_amount'),current_amount:n('current_amount'),currency:'COP',target_date:form.target_date||null};
   else throw new Error('Módulo no editable mediante este formulario.');
   const amounts=['amount','target_amount','market_value','balance'];for(const key of amounts)if(key in payload&&Number(payload[key])<0)throw new Error('El importe no puede ser negativo.');
   if('amount'in payload&&Number(payload.amount)===0)throw new Error('El importe debe ser mayor que cero.');
   const {error:writeError}=await client.from(openForm).insert(payload);
   if(writeError)throw writeError;
   setMessage('Guardado y auditado en Supabase.');setOpenForm(null);await refresh();
  }catch(e){setError('No se guardó: '+errorText(e));}
  finally{setBusy(false);}
 };
 const transfer=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  try{
   const amount=Number(form.amount);
   if(!Number.isFinite(amount)||amount<=0)throw new Error('Importe inválido.');
   const {error:e}=await client.rpc('create_cash_transfer',{p_from:form.from_account,p_to:form.to_account,p_amount:amount,p_date:form.occurred_at||dateToday(),p_description:form.description});
   if(e)throw e;
   setMessage('Transferencia atómica registrada en dos cuentas sin duplicar el consumo.');
   setOpenTransfer(false);await refresh();
  }catch(e){setError('Transferencia no registrada: '+errorText(e));}
  finally{setBusy(false);}
 };
 const remove=async(table:Table,id:string)=>{
  if(!window.confirm('¿Eliminar este registro financiero? La operación quedará en la auditoría.'))return;
  setBusy(true);setError('');
  const {error:e}=await client.from(table).delete().eq('id',id).eq('owner_id',user.id);
  if(e)setError('No se eliminó: '+e.message);else {setMessage('Registro eliminado con auditoría.');await refresh();}
  setBusy(false);
 };
 const analyze=async(index:number)=>{
  const f=brain[index];if(!f)return;setBusy(true);setError('');
  const {error:e}=await client.from('financial_findings').insert({owner_id:user.id,finding_type:f.type,title:f.title,explanation:f.detail,recommended_action:f.action,priority:f.priority,status:'pending',provenance:'rule_engine',evidence:{period}});
  if(e)setError('No se guardó el hallazgo: '+e.message);else{setMessage('Hallazgo guardado con trazabilidad.');await refresh();}
  setBusy(false);
 };
 const previewFile=async(file:File|null)=>{
  setPreview(null);setCsv('');if(!file)return;
  if(file.size>3_000_000){setError('CSV demasiado grande para revisar en una operación.');return;}
  try{setCsv(await file.text());setError('');}catch(e){setError(errorText(e));}
 };
 const validate=()=>{
  try{setPreview(previewCsv(source,csv,data,incomeAccount));setError('');}
  catch(e){setPreview(null);setError(errorText(e));}
 };
 const commitImport=async()=>{
  if(!preview?.accepted.length)return;
  if(preview.accepted.length>1000){setError('Un lote no puede superar 1.000 registros. Divídelo por períodos y vuelve a validar.');return;}
  if(!window.confirm('Importar '+preview.accepted.length+' registros conciliados en UNA TRANSACCIÓN. Si un asiento falla, no se guardará ninguno. ¿Continuar?'))return;
  setBusy(true);setError('');
  try{
   const rows=preview.accepted.map(r=>({
     external_source:r.external_source,external_key:r.external_key,occurred_at:r.occurred_at,
     description:r.description,amount:r.amount,movement_type:r.movement_type,
     account_id:data.accounts.find(a=>a.name===r.accountName)?.id,
     category_id:data.categories.find(c=>c.name===r.categoryName&&c.flow_type===(r.movement_type==='income'?'income':'expense'))?.id
   }));
   if(rows.some(r=>!r.account_id||!r.category_id))throw new Error('Cuenta/categoría ya no coinciden; el lote no fue importado.');
   const {data:inserted,error:e}=await client.rpc('import_reconciled_movements',{p_rows:rows});
   if(e)throw e;
   setMessage('Importación transaccional: '+Number(inserted)+' registros nuevos y '+(rows.length-Number(inserted))+' duplicados ignorados. Conciliar con el origen.');
   setCsv('');setPreview(null);await refresh();
  }catch(e){setError('Importación rechazada, sin escrituras parciales: '+errorText(e));await refresh();}
  finally{setBusy(false);}
 };
 const listing=(table:Table,heading:string)=> <section className="fs-panel"><div className="fs-section"><h2>{heading}</h2><button onClick={()=>open(table)} className="fs-small"><Plus size={15}/> Crear</button></div>
   <div className="fs-table-wrap"><table><thead><tr><th>Descripción</th><th>Tipo / estado</th><th>Importe</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>
   {(data[table] as Array<Record<string,unknown>>).filter(row=>JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).slice(0,100).map(row=>
    <tr key={String(row.id)}><td>{String(row.description??row.name??'Registro')}</td><td>{String(row.movement_type??row.flow_type??row.balance_kind??row.value_kind??row.status??row.account_type??'')}</td><td>{cop(money(row.amount??row.market_value??row.balance??row.target_amount??row.opening_balance??0))}</td>
    <td>{String(row.occurred_at??row.period_start??row.valued_at??row.target_date??row.as_of_date??'').slice(0,10)}</td>
    <td>{row.movement_type==='transfer'?<small>Asiento inmutable</small>:<button disabled={busy} className="fs-text-button" onClick={()=>void remove(table,String(row.id))}>Eliminar</button>}</td></tr>)}
   {!data[table].length&&<tr><td colSpan={5}>Sin registros. No se mostrarán valores ficticios.</td></tr>}
   </tbody></table></div><small>Mostrando hasta 100 filas; los cálculos usan todos los registros cargados. Las eliminaciones son confirmadas y auditadas.</small></section>;
 const monthControl=<label className="fs-date">Mes <input aria-label="Mes financiero" type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>;
 const totals: Array<{label:string;value:number|null;note:string}>=[
  {label:'Patrimonio neto',value:balance.partial?null:balance.net,note:balance.partial?'No incluye todos los activos o saldos; requiere conciliación':'Patrimonio calculado con registros conciliados'},
  {label:'Activos con saldo',value:balance.partial?null:balance.assets,note:balance.partial?'Activos incompletos: no suponer efectivo o inversiones iguales a cero':'Cuentas e inversiones valoradas'},
  {label:'Deuda registrada',value:balance.debts,note:'Saldos documentados a fechas de corte; podrían haber cambiado'},
  {label:'Flujo neto del mes',value:data.movements.some(m=>m.occurred_at.startsWith(period))?flow.savings:null,note:'Solo movimientos conciliados; la fuente archivada no se suma aquí'}
 ];
 return <div className="fs-app">
  <aside className="fs-sidebar"><div className="fs-brand"><span>▥</span><div>FINANZAS SANTI<small>Centro de control financiero</small></div></div>
  <nav>{menu.map(item=>{const Icon=item.icon;return <button key={item.name} className={active===item.name?'fs-nav active':'fs-nav'} onClick={()=>{setActive(item.name);setOpenForm(null);setSearch('');}}><Icon size={18}/>{item.name}</button>})}</nav>
  <div className="fs-sidebar-bottom"><span>● Base privada conectada</span><button onClick={()=>void onExit()}><LogOut size={15}/> Cerrar sesión</button></div></aside>
  <main className="fs-main"><header className="fs-top"><div><span className="fs-eyebrow">FINANZAS PERSONALES / ESPACIO PRIVADO</span><h1>{active==='Inicio'?'Tu panorama financiero':active}</h1><p>Valores desde Supabase · Sin cifras ficticias en el modo privado</p></div><div className="fs-top-actions">{monthControl}<button title="Recargar información" onClick={()=>void refresh()}><RefreshCcw size={17}/></button></div></header>
  <div className="fs-privacy"><ShieldCheck size={16}/><span>Acceso verificado · RLS por propietario · COP como unidad de conciliación</span></div>
  {!loading&&data.accounts.length===0&&data.movements.length===0&&<div role="status" className="fs-warning">Las cifras del libro mayor aún no representan tu situación financiera. El archivo de 13 pestañas sí está migrado, pero faltan saldos bancarios y conciliación de cuentas y movimientos para acreditar patrimonio y flujo real.</div>}
  {error&&<div role="alert" className="fs-warning">{error}</div>}
  {message&&<div role="status" className="fs-success">{message}<button onClick={()=>setMessage('')}>Cerrar</button></div>}
  {loading?<div className="fs-panel">Cargando datos privados y verificando integridad…</div>:
  <>
  {active==='Inicio'&&<><Home360 data={data} period={period} today={dateToday()} onNavigate={setActive}/><SourceDataPanel client={client} mode="home" referenceDate={dateToday()}/></>}
  {active==='Patrimonio'&&<><div className="fs-metrics">{totals.map(metric=><article key={metric.label} className="fs-metric"><small>{metric.label}</small><strong>{metric.value===null?'No conciliado':cop(metric.value)}</strong><span>{metric.note}</span></article>)}</div>
   <div className="fs-two"><section className="fs-panel"><div className="fs-section"><h2>Flujo de caja · 6 meses</h2><span>Ingresos vs consumo · millones COP</span></div>{data.movements.length===0?<p>Gráfica pendiente: todavía no hay movimientos conciliados en el libro mayor. Las observaciones de origen se muestran por separado.</p>:<ResponsiveContainer width="100%" height={270}><BarChart data={six}><CartesianGrid stroke="#eaf0f5" vertical={false}/><XAxis dataKey="period"/><YAxis tickFormatter={v=>String(Math.round(Number(v)/1000000))+'M'}/><Tooltip formatter={v=>cop(Number(v))}/><Bar dataKey="income" name="Ingresos" fill="#16ad83" radius={[5,5,0,0]}/><Bar dataKey="expenses" name="Consumo" fill="#4a83f5" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>}</section>
   <section className="fs-panel"><h2>Composición patrimonial</h2><div className="fs-breakdown"><div><span>Efectivo / cuentas COP</span><b>{data.accounts.length===0?'Sin cuentas conciliadas':cop(balance.cash)}</b></div><div><span>Inversiones valoradas COP</span><b>{data.investments.length===0?'Sin valoración conciliada':cop(balance.investments)}</b></div><div><span>Pasivos documentados/estimados COP</span><b>{cop(balance.debts)}</b></div></div><p>Los movimientos financieros (traspasos, pagos de tarjeta, aportes) no se contabilizan como consumo. Sin todos los activos y sus fechas de corte, el patrimonio neto no está conciliado.</p><button className="fs-small" onClick={()=>setActive('Configuración')}>Revisar cuentas →</button></section></div></>}
  {active==='Ingresos'&&<><SourceDataPanel client={client} mode="income" referenceDate={dateToday()}/>{listing('movements','Libro de movimientos — ingresos y gastos')}<p className="fs-guidance">Para registrar un ingreso, selecciona “Crear” y asigna una categoría de ingreso.</p></>}
  {active==='Gastos'&&<><SourceDataPanel client={client} mode="expenses" referenceDate={dateToday()}/>{listing('movements','Libro de movimientos — gastos conciliados')}</>}
  {active==='Presupuesto'&&<><SourceDataPanel client={client} mode="budget" referenceDate={dateToday()}/><section className="fs-panel"><div className="fs-section"><h2>Presupuesto del mes</h2><button className="fs-small" onClick={()=>open('budgets')}><Plus size={15}/> Crear partida</button></div><div className="fs-budget">{budgets.map(b=><div key={b.id}><div><strong>{b.name}</strong><span>{cop(b.spent)} / {cop(b.budget)}</span></div><progress value={b.spent} max={Math.max(b.budget,b.spent,1)}/><small>{b.remaining<0?'Sobrepasado '+cop(-b.remaining):'Disponible '+cop(b.remaining)}</small></div>)}</div>{!budgets.length&&<p>Sin partidas para este mes. Crea categorías de gasto en Configuración.</p>}</section></>}
  {active==='Créditos'&&<><SourceDataPanel client={client} mode="debts" referenceDate={dateToday()}/>{listing('debts','Créditos · saldos documentados o estimados')}</>}
  {active==='Inversiones'&&<><SourceDataPanel client={client} mode="investments" referenceDate={dateToday()}/>{listing('investments','Inversiones · valoración manual')}</>}
  {active==='Metas'&&listing('goals','Metas de ahorro')}
  {active==='Cerebro financiero'&&<div className="fs-two"><section className="fs-panel"><h2>Diagnóstico por reglas verificables</h2><p>Analiza los datos registrados, sin inferir valores de mercado ni enviar información a una IA externa.</p>{brain.map((f,i)=><article className="fs-insight" key={f.type+f.title}><small>{f.priority.toUpperCase()} · {f.type}</small><h3>{f.title}</h3><p>{f.detail}</p><strong>Acción sugerida: {f.action}</strong><div><button className="fs-small" disabled={busy} onClick={()=>void analyze(i)}>Guardar hallazgo</button></div></article>)}</section><section className="fs-panel"><h2>Trazabilidad</h2><p>Hallazgos registrados: {data.financial_findings.length}</p><p>Esta función no usa modelos externos ni envía tus movimientos a ChatGPT. Las recomendaciones se explican con reglas y datos del mes.</p></section></div>}
  {active==='Datos migrados'&&<div className="fs-two"><section className="fs-panel"><h2>Conciliación opcional de archivos CSV históricos</h2><p>Las 13 pestañas originales ya están archivadas y el dashboard lee los datos desde Supabase. Este importador es solo para excepciones históricas conciliadas: no necesitas abrir ni mantener Google Sheets para usar FINANZAS SANTI. La vista previa no modifica datos y rechaza registros ambiguos.</p>
    <label>Origen<select value={source} onChange={e=>{setSource(e.target.value as ImportKind);setCsv('');setPreview(null);}}><option value="GASTOS">GASTOS</option><option value="INGRESOS">INGRESOS</option></select></label>
    {source==='INGRESOS'&&<label>Cuenta receptora verificada<select value={incomeAccount} onChange={e=>setIncomeAccount(e.target.value)}><option value="">Selecciona cuenta</option>{data.accounts.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}</select></label>}
    <label>Archivo CSV<input type="file" accept=".csv,text/csv" onChange={e=>void previewFile(e.target.files?.[0]||null)}/></label>
    <button className="fs-primary" disabled={!csv} onClick={validate}>Validar sin escribir</button>
    {preview&&<div className="fs-import-summary"><p><b>{preview.accepted.length}</b> aceptados · <b>{preview.rejected.length}</b> en cuarentena · <b>{preview.duplicate}</b> duplicados</p><p>Ingresos a cargar: {cop(preview.income)} / Consumo: {cop(preview.expenses)}</p><p>Los registros en cuarentena requieren revisión de categoría, contrapartida, cuenta o documento.</p>
    {preview.rejected.length>0&&<details><summary>Razones de rechazo ({preview.rejected.length})</summary><div className="fs-scroll">{preview.rejected.slice(0,50).map((r,i)=><p key={i}>{r.external_key||'Sin ID'}: {r.issues.join('; ')}</p>)}</div></details>}
    <button className="fs-primary" disabled={busy||!preview.accepted.length} onClick={()=>void commitImport()}>Importar solo registros aceptados</button></div>}
   </section><section className="fs-panel"><h2>Mapa de las 13 pestañas</h2><p>Las 13 pestañas se conservan íntegramente en archivo privado. La conversión al libro mayor sigue controlada: solo INGRESOS y GASTOS admiten importación asistida, previa verificación de cuenta y categoría.</p><div className="fs-scroll">{Object.entries(SHEET_MAPPING).map(([name,note])=><p key={name}><strong>{name}</strong><small>{note}</small></p>)}</div></section></div>}
  {active==='Datos migrados'&&<SourceMigration client={client}/>}
  {active==='Configuración'&&<div className="fs-two"><section className="fs-panel"><h2>Traspasos entre cuentas</h2><p>Transferencia atómica: dos asientos iguales y opuestos, sin gasto de consumo.</p><button className="fs-small" onClick={()=>{setForm({occurred_at:dateToday()});setOpenTransfer(true);}}><Plus size={15}/> Transferir entre cuentas</button></section>{listing('accounts','Cuentas propias')}{listing('categories','Catálogo de categorías')}<section className="fs-panel"><h2>Seguridad e integridad</h2><p>Cuenta autenticada. UUID de sesión no se muestra para evitar divulgaciones innecesarias.</p><p>Las eliminaciones generan auditoría. No se registran automáticamente transferencias sin contrapartida ni gastos estimados.</p><button onClick={()=>void refresh()} className="fs-small">Actualizar controles</button></section></div>}
  </>}
  </main>
  {openTransfer&&<div className="fs-modal-backdrop"><form className="fs-modal" onSubmit={e=>void transfer(e)}><div className="fs-section"><h2>Traspaso entre cuentas COP</h2><button type="button" onClick={()=>setOpenTransfer(false)}>✕</button></div>
  <label>Origen<select required value={form.from_account||''} onChange={e=>setForm({...form,from_account:e.target.value})}><option value="">Seleccionar</option>{data.accounts.filter(a=>a.currency==='COP'&&a.account_type!=='credit_card').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
  <label>Destino<select required value={form.to_account||''} onChange={e=>setForm({...form,to_account:e.target.value})}><option value="">Seleccionar</option>{data.accounts.filter(a=>a.currency==='COP'&&a.account_type!=='credit_card').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
  {field('occurred_at','Fecha','date')}{field('description','Descripción','text')}{field('amount','Importe COP','number')}
  <button className="fs-primary" disabled={busy} type="submit">Registrar par atómico</button>
  </form></div>}
  {openForm&&<div className="fs-modal-backdrop" role="presentation"><form className="fs-modal" onSubmit={e=>void createRecord(e)}><div className="fs-section"><h2>Nuevo · {labels[openForm]}</h2><button type="button" onClick={()=>setOpenForm(null)}>✕</button></div>
    {['accounts','categories','debts','investments','goals'].includes(openForm)&&<label>Nombre<input required maxLength={120} value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label>}
    {openForm==='accounts'&&<><label>Tipo<select value={form.account_type||'checking'} onChange={e=>setForm({...form,account_type:e.target.value})}><option value="checking">Cuenta corriente</option><option value="savings">Ahorros</option><option value="cash">Efectivo</option><option value="credit_card">Tarjeta (solo movimientos)</option><option value="brokerage">Broker</option></select></label>{field('opening_balance','Saldo documentado a la fecha COP','number')}{field('balance_as_of','Fecha de corte de ese saldo','date')}</>}
    {openForm==='categories'&&<label>Flujo<select value={form.flow_type||'expense'} onChange={e=>setForm({...form,flow_type:e.target.value})}><option value="expense">Gastos</option><option value="income">Ingresos</option></select></label>}
    {openForm==='movements'&&<>{field('occurred_at','Fecha del movimiento','date')}<label>Cuenta<select required value={form.account_id||''} onChange={e=>setForm({...form,account_id:e.target.value})}><option value="">Seleccionar</option>{data.accounts.filter(a=>a.currency==='COP').map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
    <label>Categoría<select required value={form.category_id||''} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Seleccionar</option>{data.categories.filter(c=>c.flow_type===(active==='Ingresos'?'income':'expense')).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>{field('description','Descripción','text')}{field('amount','Importe COP','number')}</>}
    {openForm==='budgets'&&<><label>Categoría de gasto<select required value={form.category_id||''} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Seleccionar</option>{data.categories.filter(c=>c.flow_type==='expense').map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>{field('amount','Límite mensual COP','number')}</>}
    {openForm==='debts'&&<>{field('lender','Entidad financiera','text')}{field('balance','Saldo según extracto COP','number')}{field('as_of_date','Fecha de corte del saldo','date')}{field('annual_rate','Tasa anual % (opcional)','number')}</>}
    {openForm==='investments'&&<>{field('asset_type','Clase de activo','text')}{field('market_value','Valor COP a fecha actual','number')}</>}
    {openForm==='goals'&&<>{field('target_amount','Meta COP','number')}{field('current_amount','Acumulado COP','number')}{field('target_date','Fecha objetivo','date')}</>}
    {['accounts','debts'].includes(openForm)&&<label>Procedencia del saldo<select value={form.balance_kind||'documented'} onChange={e=>setForm({...form,balance_kind:e.target.value})}><option value="documented">Documentado</option><option value="estimated">Estimado</option></select></label>}
    {openForm==='investments'&&<label>Procedencia de la valoración<select value={form.value_kind||'estimated'} onChange={e=>setForm({...form,value_kind:e.target.value})}><option value="estimated">Estimado</option><option value="documented">Documentado</option></select></label>}
    <div className="fs-form-actions"><button type="button" onClick={()=>setOpenForm(null)}>Cancelar</button><button className="fs-primary" disabled={busy} type="submit">Guardar en Supabase</button></div>
  </form></div>}
 </div>;
 function field(name:string,label:string,type:'number'|'text'|'date'){
  return <label key={name}>{label}<input type={type} required={type!=='date'||name==='occurred_at'} min={type==='number'?'0':undefined} step={type==='number'?'any':undefined} value={form[name]??(name==='occurred_at'?dateToday():'')} onChange={e=>setForm({...form,[name]:e.target.value})}/></label>;
 }
}
