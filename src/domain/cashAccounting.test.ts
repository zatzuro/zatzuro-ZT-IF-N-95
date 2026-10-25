import {describe,expect,it} from 'vitest';
import {cashBreakdown} from './cashAccounting';
import type {FinanceData,MovementRow} from './private';
const mk=():FinanceData=>({accounts:[
 {id:'a',name:'Ahorros',account_type:'savings',currency:'COP',opening_balance:0,balance_kind:'documented'},
 {id:'b',name:'Bolsillos',account_type:'savings',currency:'COP',opening_balance:0,balance_kind:'documented'},
 {id:'card',name:'Tarjeta',account_type:'credit_card',currency:'COP',opening_balance:0,balance_kind:'estimated'}
],categories:[],movements:[],budgets:[],debts:[],investments:[],goals:[],financial_findings:[]});
const row=(id:string,account_id:string,movement_type:string,amount:number):MovementRow=>({
 id,account_id,category_id:null,movement_type,occurred_at:'2026-10-25',description:id,amount,currency:'COP',amount_cop:null
});
describe('cash versus consumption',()=>{
 it('counts settlement as cash out but never as a second purchase',()=>{
  const d=mk();d.movements=[row('purchase','card','expense',100000),row('settlement','a','card_payment',100000)];
  const x=cashBreakdown(d,'2026-10-01','2026-10-31');
  expect(x.consumption).toBe(100000);
  expect(x.bankOutflows).toBe(100000);
  expect(x.cardPayments).toBe(100000);
  expect(x.bankNet).toBe(-100000);
 });
 it('nets both legs of internal pockets transfer',()=>{
  const d=mk();d.movements=[
   {...row('out','a','transfer',50000),transfer_group_id:'t1',transfer_direction:'out'},
   {...row('in','b','transfer',50000),transfer_group_id:'t1',transfer_direction:'in'}];
  const x=cashBreakdown(d,'2026-10-01','2026-10-31');
  expect(x.bankNet).toBe(0);expect(x.consumption).toBe(0);
  expect(x.transferVolume).toBe(50000);
 });
 it('does not present mismatched transfer as trustworthy cash',()=>{
  const d=mk();d.movements=[{...row('out','a','transfer',50000),transfer_group_id:'t1',transfer_direction:'out'}];
  const x=cashBreakdown(d,'2026-10-01','2026-10-31');
  expect(x.bankNet).toBeNull();
  expect(x.pendingChecks).toContain('Transferencia sin contrapartida válida');
 });
 it('withholds cash result for missing FX valuation',()=>{
  const d=mk();d.movements=[{...row('u','a','expense',10),currency:'USD'}];
  expect(cashBreakdown(d,'2026-10-01','2026-10-31').bankOutflows).toBeNull();
 });
 it('separates debt payments and investment contributions from spending',()=>{
  const d=mk();d.movements=[row('debt','a','debt_payment',70000),row('invest','a','investment_contribution',20000)];
  const x=cashBreakdown(d,'2026-10-01','2026-10-31');
  expect(x.consumption).toBe(0);expect(x.bankOutflows).toBe(90000);
  expect(x.debtPayments).toBe(70000);expect(x.investmentsFunded).toBe(20000);
 });
 it('books a verified card cash advance as financing, never earned income',()=>{
  const d=mk();d.movements=[row('advance','a','financing_inflow',2000000)];
  const x=cashBreakdown(d,'2026-10-01','2026-10-31');
  expect(x.operationalInflows).toBe(0);
  expect(x.financingReceived).toBe(2000000);
  expect(x.bankNet).toBe(2000000);
  expect(x.consumption).toBe(0);
 });
 it('does not certify bank net while incoming origin is unclassified',()=>{
  const d=mk();d.movements=[row('external-in','a','unclassified_inflow',240000)];
  const x=cashBreakdown(d,'2026-10-01','2026-10-31');
  expect(x.bankNet).toBeNull();
  expect(x.operationalInflows).toBeNull();
  expect(x.pendingChecks).toContain('Abono recibido sin origen o naturaleza conciliada');
 });
 it('does not create an observed cash value without transactions',()=>{
  expect(cashBreakdown(mk(),'2026-10-01','2026-10-31').bankNet).toBeNull();
 });
});
