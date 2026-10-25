import {describe, expect, it} from 'vitest';
import {buildHome360} from './home360';
import type {FinanceData} from './private';

const empty = (): FinanceData => ({
 accounts: [], categories: [], movements: [], budgets: [], debts: [], investments: [], goals: [], financial_findings: []
});
const account = {
 id: 'bank', name: 'Cuenta COP', account_type: 'checking', currency: 'COP',
 opening_balance: 500000, balance_kind: 'documented', balance_as_of: '2026-10-01'
};
const movement = {
 id: 'g1', account_id: 'bank', category_id: 'c1', movement_type: 'expense',
 occurred_at: '2026-10-24', description: 'Compra', amount: 35000, currency: 'COP', amount_cop: null
};
const budget = {
 id: 'p1', category_id: 'c1', period_start: '2026-10-01',
 period_end: '2026-10-31', amount: 100000, currency: 'COP'
};

describe('private home 360 snapshot', () => {
 it('never displays empty ledgers and unknown cash as COP zero', () => {
  const result = buildHome360(empty(), '2026-10', '2026-10-25');
  expect(result.liquidity).toBeNull();
  expect(result.income).toBeNull();
  expect(result.expenses).toBeNull();
  expect(result.debtTotal).toBeNull();
  expect(result.budgetRemaining).toBeNull();
  expect(result.projectionAvailable).toBe(false);
 });
 it('keeps banking snapshot, operational spending and budgets distinct', () => {
  const data = empty();
  data.accounts = [account];
  data.categories = [{id:'c1', name:'Alimentación', flow_type:'expense'}];
  data.movements = [movement];
  data.budgets = [budget];
  data.debts = [{id:'d1',name:'Tarjeta',balance:200000,currency:'COP',balance_kind:'documented',due_day:15,as_of_date:'2026-10-24'}];
  const result = buildHome360(data,'2026-10','2026-10-25');
  expect(result.liquidity).toBe(465000);
  expect(result.expenses).toBe(35000);
  expect(result.income).toBe(0);
  expect(result.budgetRemaining).toBe(65000);
  expect(result.debtTotal).toBe(200000);
  expect(result.bankOutflows).toBe(35000);
  expect(result.netFlow).toBe(-35000);
  expect(result.dueDayReferences).toEqual([{id:'d1',name:'Tarjeta',day:15}]);
  expect(result.projectionAvailable).toBe(false);
 });
 it('blocks unvalued foreign movements instead of undercounting liquidity or spending', () => {
  const data = empty();
  data.accounts = [account];
  data.movements = [{...movement, currency:'USD', amount:10}];
  data.budgets = [budget];
  const result=buildHome360(data,'2026-10','2026-10-25');
  expect(result.liquidity).toBeNull();
  expect(result.expenses).toBeNull();
  expect(result.budgetRemaining).toBeNull();
  expect(result.quality.unvaluedCount).toBe(1);
 });
 it('does not double count duplicate category budgets', () => {
  const data=empty();
  data.budgets = [budget,{...budget,id:'p2',amount:50000}];
  expect(buildHome360(data,'2026-10','2026-10-25').budgetRemaining).toBeNull();
 });
 it('rejects future-dated cash snapshots and unverified debt balances', () => {
  const data=empty();
  data.accounts = [{...account,balance_as_of:'2026-11-01'}];
  data.debts = [{id:'d1',name:'Crédito',balance:100000,currency:'COP',balance_kind:'estimated',due_day:null}];
  const result=buildHome360(data,'2026-10','2026-10-25');
  expect(result.liquidity).toBeNull();
  expect(result.debtTotal).toBeNull();
  expect(result.quality.debtsWithoutDay).toBe(1);
 });
 it('does not treat future postings as current cash or settled expenditure', () => {
  const data=empty();
  data.accounts=[account];
  data.movements=[{...movement,id:'future',occurred_at:'2026-10-31',amount:200000}];
  const result=buildHome360(data,'2026-10','2026-10-25');
  expect(result.liquidity).toBe(500000);
  expect(result.expenses).toBeNull();
  expect(result.quality.periodMovements).toBe(0);
 });
 it('does not present brokerage funds as spendable liquidity', () => {
  const data=empty();
  data.accounts=[{...account,id:'broker',account_type:'brokerage',opening_balance:900000}];
  expect(buildHome360(data,'2026-10','2026-10-25').liquidity).toBeNull();
 });

 it('rejects future-dated debt snapshots as total debt', () => {
  const data=empty();
  data.debts=[{id:'d',name:'Tarjeta',balance:100000,currency:'COP',balance_kind:'documented',as_of_date:'2026-11-15'}];
  expect(buildHome360(data,'2026-10','2026-10-25').debtTotal).toBeNull();
 });

 it('does not certify cash when an unclassified adjustment follows the opening snapshot', () => {
  const data=empty();data.accounts=[account];
  data.movements=[{...movement,movement_type:'adjustment'}];
  expect(buildHome360(data,'2026-10','2026-10-25').liquidity).toBeNull();
 });
 it('does not certify cash with a transfer whose counterpart is missing', () => {
  const data=empty();data.accounts=[account];
  data.movements=[{...movement,movement_type:'transfer',category_id:null,transfer_group_id:'group1',transfer_direction:'out'}];
  expect(buildHome360(data,'2026-10','2026-10-25').liquidity).toBeNull();
 });
 it('keeps a financing receipt in cash but not earned-income, while unresolved credits block liquidity',()=>{
  const data=empty();data.accounts=[account];
  data.movements=[{...movement,id:'advance',category_id:null,movement_type:'financing_inflow',amount:2000000}];
  const advance=buildHome360(data,'2026-10','2026-10-25');
  expect(advance.liquidity).toBe(2500000);
  expect(advance.income).toBe(0);
  expect(advance.netFlow).toBe(2000000);
  data.movements.push({...movement,id:'other-credit',category_id:null,movement_type:'unclassified_inflow',amount:400000});
  const withUnknown=buildHome360(data,'2026-10','2026-10-25');
  expect(withUnknown.liquidity).toBeNull();
  expect(withUnknown.netFlow).toBeNull();
 });
 it('never calls net worth reconciled without a verified complete asset inventory', () => {
  const data=empty();data.accounts=[account];
  expect(buildHome360(data,'2026-10','2026-10-25').netWorth).toBeNull();
 });

});
