export interface ManualDebtInput { name?:string; lender?:string; balance?:string; annual_rate?:string; balance_kind?:string; as_of_date?:string; }
export function manualDebtPayload(input:ManualDebtInput, dateToday:string){
 const name=(input.name||'').trim();
 const balance=Number(input.balance);
 const rate=input.annual_rate?.trim()?Number(input.annual_rate)/100:null;
 const asOf=input.as_of_date||dateToday;
 if(!name || name.length>120 || !Number.isFinite(balance) || balance<0)throw new Error('Nombre y saldo de crédito inválidos');
 if(rate!==null && (!Number.isFinite(rate)||rate<0||rate>3))throw new Error('Tasa anual inválida');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf)))throw new Error('Fecha de corte inválida');
 return {
  name,lender:input.lender?.trim()||null,
  principal:0,principal_kind:'unknown' as const,
  balance,annual_rate:rate,balance_kind:input.balance_kind==='estimated'?'estimated':'documented',
  currency:'COP' as const,as_of_date:asOf,
  notes:'Capital originalmente desembolsado no acreditado. Este saldo es a la fecha de corte indicada.'
 };
}
