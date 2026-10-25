import {useMemo,useState} from 'react';
import {AlertTriangle, ArrowRight, CalendarDays, ShieldCheck, Wallet} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {buildHome360} from '../domain/home360';
import {cashBreakdown} from '../domain/cashAccounting';
import type {FinanceData} from '../domain/private';
import {formatCop} from '../domain/ledger';

type Destination = 'Configuración' | 'Créditos' | 'Presupuesto' | 'Ingresos' | 'Gastos' | 'Datos migrados' | 'Patrimonio';
type Props = {data:FinanceData; period:string; today:string; onNavigate:(target:Destination)=>void};
const format=(value:number|null) => value===null?'Sin conciliar':formatCop(value);
export default function Home360({data,period,today,onNavigate}:Props){
 const summary=useMemo(()=>buildHome360(data,period,today),[data,period,today]);
 const [horizon,setHorizon]=useState<30|60|90>(30);
 const series=useMemo(()=>Array.from({length:6},(_,index)=>{
  const month=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7))-6+index,1)).toISOString().slice(0,7);
  const lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const flow=cashBreakdown({...data,movements:data.movements.filter(m=>m.occurred_at<=today)},month+'-01',lastDay);
  return {period:month,income:flow.operationalInflows,expenses:flow.consumption,cashOut:flow.bankOutflows};
 }),[data,period,today]);
 const cards=[
  {label:'Dinero disponible hoy',value:summary.liquidity,detail:summary.notes.liquidity,target:'Configuración' as Destination},
  {label:'Disponible tras obligaciones',value:summary.availableAfterCommitments,detail:'Pendiente de compromisos fechados, pagos realizados y saldo de caja conciliado.',target:'Créditos' as Destination},
  {label:'Próximos ingresos',value:summary.upcomingIncome,detail:'Pendiente de calendario de nómina, descuentos y comisiones verificadas.',target:'Ingresos' as Destination},
  {label:'Obligaciones próximas',value:summary.upcomingObligations,detail:'Faltan vencimientos con importe y estado real para proyectar pagos.',target:'Créditos' as Destination},
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
    <div><span>Presupuesto restante</span><strong>{format(summary.budgetRemaining)}</strong></div>
    <div><span>Pagos de tarjeta efectuados (período)</span><strong>{format(summary.cardPayments)}</strong></div>
    <div><span>Pagos de deuda efectuados (período)</span><strong>{format(summary.debtPayments)}</strong></div>
    <div><span>Salidas bancarias registradas</span><strong>{format(summary.bankOutflows)}</strong></div>
   </div>
   {summary.dueDayReferences.length?
    <div className="fs-home360-references">{summary.dueDayReferences.map(item=>
     <div key={item.id}><span>{item.name}</span><strong>Día {item.day} · solo referencia</strong></div>)}</div>:
    <p>Sin vencimientos de cuota acreditados. No se inventan fechas a partir de un saldo o un cronograma antiguo.</p>}
   <button type="button" className="fs-small" onClick={()=>onNavigate('Créditos')}>Revisar obligaciones <ArrowRight size={14}/></button>
  </section><section className="fs-panel">
   <div className="fs-section"><h2>Proyección de liquidez</h2><AlertTriangle size={18}/></div>
   <div className="fs-home360-horizons" role="group" aria-label="Horizonte de proyección">
    {([30,60,90] as const).map(days=><button type="button" key={days} aria-pressed={horizon===days} className={horizon===days?'active':''} onClick={()=>setHorizon(days)}>{days} días</button>)}
   </div>
   <div className="fs-home360-projections"><div><span>Saldo previsto a {horizon} días</span><strong>Sin base verificable</strong></div>
    <div><span>Primer día de insuficiencia</span><strong>No evaluable</strong></div></div>
   <p><Wallet size={14} aria-hidden="true"/> Se necesita caja conciliada, nómina neta y pagos con fecha e importe confirmables. Cambiar horizonte no inventa una curva.</p>
  </section></div>
  {(summary.liquidity===null||summary.debtTotal===null||summary.upcomingObligations===null)&&
   <div className="fs-home360-alert" role="status"><AlertTriangle size={17}/><span>Datos incompletos: no concluyas que tienes capacidad de pago hasta conciliar caja, avance de tarjeta y calendario de obligaciones.</span></div>}
 </section>;
}
