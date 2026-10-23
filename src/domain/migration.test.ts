import {describe,it,expect} from 'vitest';
import {parseCop,parseDate,parseCsv,previewCsv,SHEET_MAPPING} from './migration';
import {calculateBalances,monthly,findings,type FinanceData} from './private';
const empty:FinanceData={accounts:[],categories:[],movements:[],budgets:[],debts:[],investments:[],goals:[],financial_findings:[]};
describe('finance integrity and migration quarantine',()=>{
 it('excludes investments and card payments from consumption',()=>{const data={...empty,movements:[
 {id:'1',account_id:'a',category_id:null,movement_type:'income',occurred_at:'2026-10-01',description:'salary',amount:500,currency:'COP',amount_cop:null},
 {id:'2',account_id:'a',category_id:null,movement_type:'expense',occurred_at:'2026-10-02',description:'food',amount:100,currency:'COP',amount_cop:null},
 {id:'3',account_id:'a',category_id:null,movement_type:'card_payment',occurred_at:'2026-10-03',description:'card',amount:200,currency:'COP',amount_cop:null},
 {id:'4',account_id:'a',category_id:null,movement_type:'investment_contribution',occurred_at:'2026-10-04',description:'investment',amount:100,currency:'COP',amount_cop:null}
 ]};expect(monthly(data,'2026-10')).toEqual({income:500,expenses:100,savings:400});});
 it('refuses to fabricate foreign currency net worth',()=>{const d={...empty,accounts:[{id:'x',name:'USD',account_type:'checking',currency:'USD',opening_balance:100,balance_kind:'documented'}]};expect(calculateBalances(d).partial).toBe(true);expect(findings(d,'2026-10').some(x=>x.type==='valuation')).toBe(true);});
 it('reads COP localized and strictly checks calendar dates',()=>{expect(parseCop('$1.234.567,89')).toBe(1234567.89);expect(parseDate('31/02/2026')).toBe(null);expect(parseDate('23/10/2026')).toBe('2026-10-23')});
 it('parses quoted CSV without splitting embedded commas',()=>expect(parseCsv('a,b\n"x,y",12')[0].a).toBe('x,y'));
 it('maps all 13 sheets explicitly',()=>expect(Object.keys(SHEET_MAPPING)).toHaveLength(13));
 it('quarantines ambiguous transfer and unverified expense, duplicates are ignored',()=>{
 const csv=['ID movimiento,Fecha,Comercio / destinatario,Categoría,Tipo de movimiento,Gasto confirmado (COP),Cuenta origen',
 'one,02/10/2026,Farmacia,Salud,Compra,"$12.000,00",Cuenta COP',
 'two,03/10/2026,Otro,Por clasificar,Transferencia,"$30.000,00",Cuenta COP',
 'one,02/10/2026,Farmacia,Salud,Compra,"$12.000,00",Cuenta COP'].join('\n');
 const d={...empty,accounts:[{id:'a',name:'Cuenta COP',account_type:'checking',currency:'COP',opening_balance:0,balance_kind:'documented'}],categories:[{id:'b',name:'Salud',flow_type:'expense' as const}]};
 const p=previewCsv('GASTOS',csv,d);expect([p.accepted.length,p.rejected.length,p.duplicate,p.expenses]).toEqual([1,1,1,12000]);
 });
});
