import {describe,it,expect} from 'vitest';
import {documentComparison,historicalMonth,inventory,orderedFamily,realNumber,sourceFamily,type SourceRecord,type SourceSheet} from './sourceIntelligence';
const mk=(kind:SourceRecord['kind'],provenance:SourceRecord['provenance'],amount_cop:string|null,date:string|null):SourceRecord=>({
 id:kind+provenance+(date||''),sheet_name:'GASTOS',source_row:2,kind,description:'sample',event_date:date,amount_cop,amount_usd:null,provenance
});
describe('read-only historical data in Supabase must not contaminate ledger',()=>{
 it('never calls projections, eToro deposits, transfers, card statements or unverified expenses cash flow',()=>{
  const rows=[mk('income_document','documented','5000','2026-05-01'),
   mk('expense_document','documented','2000','2026-05-05'),
   mk('expense_document','unverified','11000','2026-05-02'),
   mk('card_statement','documented','30000','2026-05-09'),
   mk('investment_deposit','documented','25000','2026-05-10'),
   mk('loan_projection','estimated','4000','2026-05-15'),
   mk('budget_income','estimated','70000','2026-05-12')];
  const months=documentComparison(rows,2);
  expect(months).toEqual([{period:'2026-04',income:0,expenses:0},{period:'2026-05',income:5000,expenses:2000}]);
  expect(sourceFamily(rows,'expenses')).toHaveLength(2);
 });
 it('keeps foreign-currency and missing entries out of COP calculations',()=>{
  expect(realNumber(null)).toBe(null);
  expect(realNumber('0')).toBe(null);
  expect(realNumber('-5')).toBe(null);
  expect(realNumber('150.2')).toBe(150.2);
  expect(historicalMonth('2026-02-30')).toBe(null);
  expect(documentComparison([mk('expense_document','documented',null,'2026-05-01')])).toEqual([]);
 });
 it('requires every archived tab to be verified before declaring complete',()=>{
  const tabs:SourceSheet[]=Array.from({length:13},(_,i)=>({sheet_name:'T'+i,expected_rows:10,stored_rows:10,batch_status:'verified',row_class:'historical',reconcile_state:'review_required'}));
  const rows=[mk('expense_document','unverified','100','2026-05-01')];
  expect(inventory(tabs,rows)).toMatchObject({complete:true,tabCount:13,archived:130,observations:1,unverified:1});
  tabs[0].stored_rows=9;
  expect(inventory(tabs,rows).complete).toBe(false);
 });
 it('sorts next future loan schedules but does not transform them into repayments',()=>{
  const rows=[mk('loan_projection','estimated','100','2027-01-01'),mk('loan_projection','estimated','100','2026-11-01'),mk('loan_projection','estimated','100','2026-01-01')];
  expect(orderedFamily(rows,'debts','2026-10-24').map(r=>r.event_date)).toEqual(['2026-11-01','2027-01-01','2026-01-01']);
 });
});
