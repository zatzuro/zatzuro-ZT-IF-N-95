import {describe,it,expect} from 'vitest';
import {manualDebtPayload} from './manualDebt';
import {calculateBalances,type FinanceData} from './private';
const empty:FinanceData={accounts:[],categories:[],movements:[],budgets:[],debts:[],investments:[],goals:[],financial_findings:[]};
describe('senior P0: no invented principal or net worth',()=>{
 it('never equates outstanding debt balance to original principal',()=>{
  const x=manualDebtPayload({name:'Loan',balance:'12000000',as_of_date:'2026-10-20',balance_kind:'documented'},'2026-10-23');
  expect(x.principal).toBe(0);
  expect(x.principal_kind).toBe('unknown');
  expect(x.balance).toBe(12000000);
  expect(x.as_of_date).toBe('2026-10-20');
 });
 it('blocks invalid rate and balance',()=>{
  expect(()=>manualDebtPayload({name:'Loan',balance:'-3'},'2026-10-23')).toThrow();
  expect(()=>manualDebtPayload({name:'Loan',balance:'10',annual_rate:'999'},'2026-10-23')).toThrow();
 });
 it('marks liability-only balance sheets incomplete',()=>{
  expect(calculateBalances({...empty,debts:[{id:'d',name:'Loan',balance:500000,currency:'COP',balance_kind:'documented'}]}).partial).toBe(true);
 });
});
