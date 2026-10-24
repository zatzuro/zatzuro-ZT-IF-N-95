export type SourceKind='income_document'|'expense_document'|'credit_balance'|'card_statement'|'investment_deposit'|'investment_position'|'budget_income'|'budget_expense'|'loan_projection';
export type Provenance='documented'|'estimated'|'unverified';
export interface SourceRecord {
 id:string; sheet_name:string; source_row:number; kind:SourceKind; description:string;
 event_date:string|null; amount_cop:number|string|null; amount_usd:number|string|null; provenance:Provenance;
}
export interface SourceSheet {
 sheet_name:string; expected_rows:number; stored_rows:number; row_class:string;
 reconcile_state:string; batch_status:string; verified_at?:string|null;
}
export const familyKinds={
 income:['income_document'],
 expenses:['expense_document'],
 budget:['budget_income','budget_expense'],
 debts:['credit_balance','card_statement','loan_projection'],
 investments:['investment_deposit','investment_position']
} as const;
export type Family=keyof typeof familyKinds;
export const realNumber=(v:string|number|null|undefined):number|null=>{
 if(v===null||v===undefined||v==='')return null;
 const n=Number(v);return Number.isFinite(n)&&n>0?n:null;
};
export function historicalMonth(value:string|null):string|null {
 if(!value||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number);
 const test=new Date(Date.UTC(y,m-1,d));
 return test.getUTCFullYear()===y&&test.getUTCMonth()===m-1&&test.getUTCDate()===d?value.slice(0,7):null;
}
export function inventory(sheets:SourceSheet[],records:SourceRecord[]){
 const unique=new Set(sheets.map(s=>s.sheet_name));
 const archived=sheets.reduce((n,s)=>n+s.stored_rows,0);
 const expected=sheets.reduce((n,s)=>n+s.expected_rows,0);
 return {
  tabCount:unique.size,archived,expected,observations:records.length,
  complete:sheets.length===13&&unique.size===13&&sheets.every(s=>s.expected_rows===s.stored_rows&&s.batch_status==='verified'),
  unverified:records.filter(r=>r.provenance==='unverified').length,
  estimated:records.filter(r=>r.provenance==='estimated').length
 };
}
export function sourceFamily(rows:SourceRecord[],family:Family){
 const kinds:readonly string[]=familyKinds[family];
 return rows.filter(row=>kinds.includes(row.kind));
}
export function documentComparison(rows:SourceRecord[],months=6){
 const qualified=rows.filter(r=>(r.kind==='income_document'||r.kind==='expense_document')&&r.provenance==='documented'&&historicalMonth(r.event_date)&&realNumber(r.amount_cop)!==null);
 const last=qualified.map(r=>historicalMonth(r.event_date)!).sort().at(-1);
 if(!last)return [];
 const [year,month]=last.split('-').map(Number);
 const periods=Array.from({length:months},(_,i)=>{
  const date=new Date(Date.UTC(year,month-1-(months-1-i),1));
  return date.toISOString().slice(0,7);
 });
 return periods.map(period=>({
  period,
  income:qualified.filter(r=>r.kind==='income_document'&&historicalMonth(r.event_date)===period).reduce((n,r)=>n+realNumber(r.amount_cop)!,0),
  expenses:qualified.filter(r=>r.kind==='expense_document'&&historicalMonth(r.event_date)===period).reduce((n,r)=>n+realNumber(r.amount_cop)!,0)
 }));
}
export function orderedFamily(rows:SourceRecord[],family:Family,referenceDate:string){
 const selected=sourceFamily(rows,family);
 if(family==='debts'){
  const snapshots=selected.filter(r=>r.kind!=='loan_projection');
  const projection=selected.filter(r=>r.kind==='loan_projection');
  const upcoming=projection.filter(r=>r.event_date&&r.event_date>=referenceDate)
   .sort((a,b)=>a.event_date!.localeCompare(b.event_date!));
  const expired=projection.filter(r=>!r.event_date||r.event_date<referenceDate)
   .sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||''));
  return [...snapshots.sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||'')),...upcoming,...expired];
 }
 return selected.sort((a,b)=>(b.event_date||'').localeCompare(a.event_date||'')||a.source_row-b.source_row);
}
