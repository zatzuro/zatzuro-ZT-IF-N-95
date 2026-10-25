import type {FinanceData} from './private';
import {buildHome360} from './home360';
export type HomeAdvice={code:string;title:string;evidence:string;impact:string;action:string;target:'Configuración'|'Créditos'|'Calendario'|'Datos migrados'|'Presupuesto'};
export function adviseHome(data:FinanceData,period:string,today:string,plannedCount:number):HomeAdvice[]{
 const snapshot=buildHome360(data,period,today);
 const advice:HomeAdvice[]=[];
 if(snapshot.liquidity===null)advice.push({
  code:'cash',title:'Conciliar los saldos de caja',evidence:snapshot.quality.undocumentedAccounts+
   ' cuenta(s) con respaldo incompleto; '+snapshot.quality.cashAccounts+' cuenta(s) de caja.',
  impact:'No es posible calcular cuánto dinero queda realmente después de pagos.',
  action:'Verificar saldos de apertura, extractos y transferencias de Bolsillos.',target:'Configuración'
 });
 if(snapshot.quality.debtsWithoutDay>0)advice.push({
  code:'maturity',title:'Completar vencimientos de obligaciones',
  evidence:snapshot.quality.debtsWithoutDay+' obligación(es) sin día referencial documentado.',
  impact:'La proyección podría omitir pagos importantes, por lo que el saldo futuro no es confiable.',
  action:'Registrar fechas e importes respaldados en Calendario, sin duplicar pagos ejecutados.',target:'Calendario'
 });
 if(data.debts.some(d=>d.balance_kind==='estimated'||!d.as_of_date||d.as_of_date>today))advice.push({
  code:'debt',title:'Revisar el corte de los saldos de deuda',
  evidence:snapshot.quality.unresolvedDebtSnapshots+' cortes futuros/desconocidos, además de saldos estimados.',
  impact:'Deuda total y patrimonio pueden estar incompletos.',
  action:'Conciliar facturas, avances y saldos con su fecha documental.',target:'Créditos'
 });
 if(plannedCount===0)advice.push({
  code:'calendar',title:'Registrar compromisos futuros verificables',
  evidence:'No hay eventos programados en el calendario privado.',
  impact:'No existe información suficiente para evaluar una insuficiencia de caja.',
  action:'Registrar solo próximos ingresos y salidas que puedas respaldar.',target:'Calendario'
 });
 if(snapshot.budgetRemaining===null)advice.push({
  code:'budget',title:'Preparar el presupuesto operativo',
  evidence:snapshot.quality.budgetCategories+' partidas presupuestarias en el período.',
  impact:'No se conoce el margen de gasto disponible por categoría.',
  action:'Conciliar categorías y presupuestos antes de activar alertas de exceso.',target:'Presupuesto'
 });
 return advice.slice(0,3);
}
