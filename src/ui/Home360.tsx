import {useMemo,useState} from 'react';
import {AlertTriangle, ArrowRight, CalendarDays, ShieldCheck, Wallet} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {buildHome360} from '../domain/home360';
import {adviseHome} from '../domain/homeAdvice';
import {cashBreakdown} from '../domain/cashAccounting';
import {projectDailyCash,type ForecastEvent,type ForecastScenario} from '../domain/cashForecast';
import type {CalendarEventRow} from './FinancialCalendar';
import type {FinanceData} from '../domain/private';
import {formatCop} from '../domain/ledger';

type Destination = 'Configuración' | 'Créditos' | 'Presupuesto' | 'Ingresos' | 'Gastos' | 'Datos migrados' | 'Patrimonio' | 'Calendario';
type Props = {data:FinanceData; events:CalendarEventRow[]; period:string; today:string; onNavigate:(target:Destination)=>void};
const format=(value:number|null) => value===null?'Sin conciliar':formatCop(value);
export default function Home360({data,events,period,today,onNavigate}:Props){
 const summary=useMemo(()=>buildHome360(data,period,today),[data,period,today]);
 const advice=useMemo(()=>adviseHome(data,period,today,events.length),[data,period,today,events.length]);
 const [horizon,setHorizon]=useState<30|60|90>(30);
 const [scenario,setScenario]=useState<ForecastScenario>('base');
 const [coverageConfirmed,setCoverageConfirmed]=useState(false);
 const planned=useMemo<ForecastEvent[]>(()=>events.map(e=>({
  id:e.id,dueDate:e.due_date,direction:e.direction,amountCop:Number(e.amount_cop),
  certainty:e.certainty,status:e.status,channel:e.channel,kind:e.event_kind,
  linkedMovementId:e.linked_movement_id
 })),[events]);
 const forecast=useMemo(()=>projectDailyCash({
  today,days:horizon,openingCash:summary.liquidity,calendarVerified:coverageConfirmed&&planned.length>0,
  events:planned,scenario
 }),[today,horizon,summary.liquidity,coverageConfirmed,planned,scenario]);
 const unpaidEvents=events.filter(e=>e.status==='pending'&&e.channel==='bank'&&e.direction==='out');
 const endDate=useMemo(()=>{const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+horizon);return d.toISOString().slice(0,10);},[today,horizon]);
 const toPay=events.filter(e=>e.status==='pending'&&e.channel==='bank'&&e.direction==='out'&&e.event_kind!=='transfer'&&e.due_date<=endDate);
 const toReceive=events.filter(e=>e.status==='pending'&&e.channel==='bank'&&e.direction==='in'&&e.event_kind!=='transfer'&&e.due_date<=endDate);
 const scheduledOut=forecast.ready?toPay.reduce((n,e)=>n+Number(e.amount_cop),0):null;
 const scheduledIn=forecast.ready?toReceive.reduce((n,e)=>n+Number(e.amount_cop),0):null;
 const reserveCash=forecast.ready&&scheduledOut!==null&&summary.liquidity!==null?summary.liquidity-scheduledOut:null;
 const series=useMemo(()=>Array.from({length:6},(_,index)=>{
  const month=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7))-6+index,1)).toISOString().slice(0,7);
  const lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const flow=cashBreakdown({...data,movements:data.movements.filter(m=>m.occurred_at<=today)},month+'-01',lastDay);
  return {period:month,income:flow.operationalInflows,expenses:flow.consumption,cashOut:flow.bankOutflows};
 }),[data,period,today]);
 const cards=[
  {label:'Dinero disponible hoy',value:summary.liquidity,detail:summary.notes.liquidity,target:'Configuración' as Destination},
  {label:'Disponible tras obligaciones',value:reserveCash,detail:'Escenario condicional: caja menos salidas programadas de '+horizon+' días, sin ingresos futuros.',target:'Calendario' as Destination},
  {label:'Próximos ingresos',value:scheduledIn,detail:'Entradas programadas para '+horizon+' días: documentadas y estimadas, no cobradas.',target:'Calendario' as Destination},
  {label:'Obligaciones próximas',value:scheduledOut,detail:'Salidas bancarias programadas para '+horizon+' días, no pagos confirmados.',target:'Calendario' as Destination},
  {label:'Deuda total',value:summary.debtTotal,detail:summary.notes.debt,target:'Créditos' as Destination},
  {label:'Patrimonio neto',value:summary.netWorth,detail:'Activos menos pasivos; sin activos ni cortes completos no es conciliado.',target:'Patrimonio' as Destination}
 ];
 return <section className="fs-home360" aria-label="Resumen financiero 360">
  <div className="fs-home360-title"><div><small className="fs-source-kicker">INICIO / CENTRO DE DECISIONES</small><h2>Tu panorama financiero 360°</h2>
   <p>Lo real, lo documentado y lo pendiente se presentan por separado. Ninguna operación histórica se convierte automáticamente en dinero disponible.</p></div>
   <span className="fs-home360-date">Consulta al {today} · Período {period}</span></div>
  <div className="fs-home360-grid">{cards.map(card=><article className="fs-metric" key={card.label}>
    <small>{card.label}</small><strong>{format(card.value)}</strong><span>{card.detail}</span>
    <button type="button" className="fs-home360-link" onClick={()=>onNavigate(card.target)}>Ver detalle <ArrowRight size={13}/></button>
   </article>)}</div>
  <div className="fs-home360-columns"><section className="fs-panel">
   <div className="fs-section"><h2>Consumo frente a movimientos de caja</h2><span>Últimos seis meses · COP</span></div>
   {series.some(m=>m.expenses!==null)?<ResponsiveContainer width="100%" height={250}><BarChart data={series}>
     <CartesianGrid vertical={false} stroke="#edf2f5"/><XAxis dataKey="period"/>
     <YAxis tickFormatter={v=>String(Math.round(Number(v)/1000000))+' M'}/>
     <Tooltip formatter={v=>formatCop(Number(v))}/>
     <Bar dataKey="income" name="Entradas a caja (no necesariamente salario)" fill="#16ad83" radius={[4,4,0,0]}/>
     <Bar dataKey="expenses" name="Consumo" fill="#4a83f5" radius={[4,4,0,0]}/>
     <Bar dataKey="cashOut" name="Salidas bancarias (incluye pago de deuda)" fill="#ef9d5f" radius={[4,4,0,0]}/>
    </BarChart></ResponsiveContainer>:<p>Sin movimientos operativos valorados; el histórico no se mezcla con las cifras de caja.</p>}
   <p>Consumo y salidas bancarias son medidas diferentes, no valores que deban sumarse entre sí. Los gastos con tarjeta y su posterior pago tienen momentos distintos.</p>
  </section><section className="fs-panel">
   <div className="fs-section"><h2>Calidad de datos</h2><ShieldCheck size={18}/></div>
   <div className="fs-home360-facts">
    <div><span>Cuentas de caja</span><strong>{summary.quality.cashAccounts}</strong></div>
    <div><span>Cuentas con saldo no documentado</span><strong>{summary.quality.undocumentedAccounts}</strong></div>
    <div><span>Movimientos sin COP verificable</span><strong>{summary.quality.unvaluedCount}</strong></div>
    <div><span>Movimientos del período</span><strong>{summary.quality.periodMovements}</strong></div>
    <div><span>Deudas sin vencimiento</span><strong>{summary.quality.debtsWithoutDay}</strong></div>
    <div><span>Deudas con corte futuro o desconocido</span><strong>{summary.quality.unresolvedDebtSnapshots}</strong></div>
    <div><span>Comprobaciones de caja pendientes</span><strong>{summary.pendingCashChecks.length}</strong></div>
   </div>
   <p>Antes de confiar en el dinero disponible concilia cuentas y extractos; los datos del archivo permanecen separados.</p>
   <button type="button" className="fs-small" onClick={()=>onNavigate('Datos migrados')}>Ver trazabilidad <ArrowRight size={14}/></button>
  </section></div>
  <div className="fs-home360-columns"><section className="fs-panel">
   <div className="fs-section"><h2>Obligaciones y presupuesto</h2><CalendarDays size={18}/></div>
   <div className="fs-home360-facts">
    <div><span>Eventos futuros de salida registrados</span><strong>{unpaidEvents.length}</strong></div>
    <div><span>Presupuesto restante</span><strong>{format(summary.budgetRemaining)}</strong></div>
    <div><span>Pagos de tarjeta efectuados (período)</span><strong>{format(summary.cardPayments)}</strong></div>
    <div><span>Pagos de deuda efectuados (período)</span><strong>{format(summary.debtPayments)}</strong></div>
    <div><span>Salidas bancarias registradas</span><strong>{format(summary.bankOutflows)}</strong></div>
   </div>
   {summary.dueDayReferences.length?
    <div className="fs-home360-references">{summary.dueDayReferences.map(item=>
     <div key={item.id}><span>{item.name}</span><strong>Día {item.day} · solo referencia</strong></div>)}</div>:
    <p>Sin vencimientos de cuota acreditados. No se inventan fechas a partir de un saldo o un cronograma antiguo.</p>}
   <button type="button" className="fs-small" onClick={()=>onNavigate('Calendario')}>Revisar calendario <ArrowRight size={14}/></button>
  </section><section className="fs-panel">
   <div className="fs-section"><h2>Proyección de liquidez</h2><AlertTriangle size={18}/></div>
   <div className="fs-home360-horizons" role="group" aria-label="Horizonte de proyección">
    {([30,60,90] as const).map(days=><button type="button" key={days} aria-pressed={horizon===days} className={horizon===days?'active':''} onClick={()=>setHorizon(days)}>{days} días</button>)}
   </div>
   <label className="fs-home360-coverage"><input type="checkbox" checked={coverageConfirmed} onChange={e=>setCoverageConfirmed(e.target.checked)}/>
    Confirmo únicamente para esta simulación que he revisado los compromisos e ingresos del horizonte. No equivale a conciliación bancaria.</label>
   <label className="fs-home360-scenario">Escenario<select value={scenario} onChange={e=>setScenario(e.target.value as ForecastScenario)}>
    <option value="base">Base: estimados y documentados</option>
    <option value="conservative">Conservador: sin ingresos estimados</option>
    <option value="favorable">Favorable: sin egresos estimados</option>
   </select></label>
   <div className="fs-home360-projections"><div><span>Saldo condicional a {horizon} días</span><strong>{forecast.ready?formatCop(forecast.endingBalance):'Sin base verificable'}</strong></div>
    <div><span>Primer día de insuficiencia</span><strong>{forecast.ready?(forecast.firstShortfall||'No detectado'):'No evaluable'}</strong></div></div>
   {forecast.ready?<div className="fs-home360-forecast">
    <ResponsiveContainer width="100%" height={195}><BarChart data={forecast.points.filter((_,i)=>i%Math.max(1,Math.floor(horizon/12))===0||i===horizon-1)}>
     <XAxis dataKey="date" tickFormatter={v=>String(v).slice(5)}/><YAxis tickFormatter={v=>String(Math.round(Number(v)/1_000_000))+' M'}/>
     <Tooltip formatter={v=>formatCop(Number(v))}/><Bar dataKey="closing" name="Caja simulada (condicional)" fill="#16ad83"/>
    </BarChart></ResponsiveContainer></div>:
    <p role="status">{forecast.reason}</p>}
   <button type="button" className="fs-small" onClick={()=>onNavigate('Calendario')}>Completar calendario <ArrowRight size={14}/></button>
   <p><Wallet size={14} aria-hidden="true"/> Se necesita caja conciliada, nómina neta y pagos con fecha e importe confirmables. Cambiar horizonte no inventa una curva.</p>
  </section></div>
  <section className="fs-panel"><div className="fs-section"><h2>Asesor financiero · prioridades con evidencia</h2><span>Máximo tres acciones verificables</span></div>
   <div className="fs-home360-advice">{advice.map(item=><article key={item.code}>
    <h3>{item.title}</h3><p><strong>Evidencia:</strong> {item.evidence}</p>
    <p><strong>Riesgo:</strong> {item.impact}</p>
    <p><strong>Acción:</strong> {item.action}</p>
    <button type="button" className="fs-home360-link" onClick={()=>onNavigate(item.target)}>Actuar <ArrowRight size={13}/></button>
   </article>)}
   {!advice.length&&<p>No hay alertas automáticas con las reglas disponibles. Esto no sustituye una conciliación completa.</p>}</div>
  </section>
  {(summary.liquidity===null||summary.debtTotal===null||summary.upcomingObligations===null)&&
   <div className="fs-home360-alert" role="status"><AlertTriangle size={17}/><span>Datos incompletos: no concluyas que tienes capacidad de pago hasta conciliar caja, avance de tarjeta y calendario de obligaciones.</span></div>}
 </section>;
}
