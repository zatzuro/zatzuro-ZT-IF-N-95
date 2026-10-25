export type ForecastEvent = {
 id:string; dueDate:string; direction:'in'|'out'; amountCop:number|null;
 status:'pending'|'paid'|'cancelled'|'unverified';
 certainty:'confirmed'|'estimated';
 channel:'bank'|'payroll_deduction';
 kind:'salary'|'commission'|'bonus'|'expense'|'card_payment'|'loan_payment'|'credit_advance'|'transfer'|'other';
 linkedMovementId?:string|null;
};
export type ForecastScenario = 'base'|'conservative'|'favorable';
export type ForecastPoint = {date:string; incoming:number; outgoing:number; closing:number};
export type ForecastResult =
 |{ready:true;points:ForecastPoint[];firstShortfall:string|null;endingBalance:number;scenario:ForecastScenario}
 |{ready:false;reason:string};

/** Events are projections only. They never mutate the settled ledger.
 * Payroll deductions have already reduced salary net, so no second bank debit.
 */
export function projectDailyCash(options:{
 today:string;days:30|60|90;openingCash:number|null;
 calendarVerified:boolean;events:ForecastEvent[];scenario:ForecastScenario;
}):ForecastResult{
 const {today,days,openingCash,calendarVerified,events,scenario}=options;
 if(!calendarVerified)return {ready:false,reason:'Calendario incompleto: faltan ingresos u obligaciones por validar.'};
 if(openingCash===null||!Number.isFinite(openingCash))return {ready:false,reason:'Saldo inicial de caja no conciliado.'};
 const applicable=events.filter(event=>!['paid','cancelled'].includes(event.status));
 if(applicable.some(event=>!Number.isFinite(Number(event.amountCop)) || event.amountCop===null || Number(event.amountCop)<0 ||
  !/^\d{4}-\d{2}-\d{2}$/.test(event.dueDate) || Number.isNaN(Date.parse(event.dueDate)) ||
  event.status==='unverified'))return {ready:false,reason:'Existen eventos pendientes de valoración, fecha o verificación.'};
 const ids=new Set<string>();
 for(const event of events){if(ids.has(event.id))return {ready:false,reason:'Eventos futuros duplicados; revisar identificadores.'};ids.add(event.id);}
 const daily=new Map<string,{incoming:number;outgoing:number}>();
 const end=new Date(today+'T00:00:00Z');if(Number.isNaN(end.getTime()))return {ready:false,reason:'Fecha de corte inválida.'};
 end.setUTCDate(end.getUTCDate()+days);
 for(const event of applicable){
  if(event.channel==='payroll_deduction')continue;
  if(event.dueDate<=today||event.dueDate>end.toISOString().slice(0,10))continue;
  const signed=event.direction;
  if(event.kind==='transfer')continue; // Own-account transfers never create income or expense.
  // A verified credit advance can boost bank cash but is not salary/wealth.
  if(scenario==='conservative'&&event.certainty==='estimated'&&signed==='in')continue;
  if(scenario==='favorable'&&event.certainty==='estimated'&&signed==='out')continue;
  const entry=daily.get(event.dueDate)||{incoming:0,outgoing:0};
  if(signed==='in')entry.incoming+=event.amountCop!;
  else entry.outgoing+=event.amountCop!;
  daily.set(event.dueDate,entry);
 }
 const points:ForecastPoint[]=[];let cash=openingCash;let firstShortfall:string|null=null;
 for(let day=1;day<=days;day++){
  const date=new Date(today+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+day);
  const iso=date.toISOString().slice(0,10);
  const entry=daily.get(iso)||{incoming:0,outgoing:0};
  cash+=entry.incoming-entry.outgoing;
  points.push({date:iso,incoming:entry.incoming,outgoing:entry.outgoing,closing:cash});
  if(cash<0&&!firstShortfall)firstShortfall=iso;
 }
 return {ready:true,points,firstShortfall,endingBalance:cash,scenario};
}

export type CommissionFactor = {compliance:number;paymentFactor:number};
/** Compliance and payment factor must come from a verified factor table;
 * no identity assumption or interpolation between undocumented points.
 */
export function projectPayroll(input:{
 compliance:number;variableBase:number;basicSalary:number;
 factors:CommissionFactor[];confirmedDeductions:number|null;
}){
 const {compliance,variableBase,basicSalary,factors,confirmedDeductions}=input;
 if(!Number.isFinite(compliance)||compliance<0||!Number.isFinite(variableBase)||variableBase<0||
 !Number.isFinite(basicSalary)||basicSalary<0)return {commission:null,gross:null,net:null,factor:null};
 const matched=factors.filter(row=>Math.abs(row.compliance-compliance)<0.000001);
 if(matched.length!==1||!Number.isFinite(matched[0].paymentFactor)||matched[0].paymentFactor<0)
  return {commission:null,gross:null,net:null,factor:null};
 const factor=matched[0].paymentFactor;
 const commission=Math.round(variableBase*factor);
 const gross=basicSalary+commission;
 const net=confirmedDeductions!==null&&Number.isFinite(confirmedDeductions)&&confirmedDeductions>=0
  ?gross-confirmedDeductions:null;
 return {commission,gross,net,factor};
}
