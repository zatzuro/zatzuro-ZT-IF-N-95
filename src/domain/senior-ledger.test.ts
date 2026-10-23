import {describe,it,expect} from 'vitest';
import {calculateBalances,monthly,type FinanceData} from './private';
const empty:FinanceData={accounts:[],categories:[],movements:[],budgets:[],debts:[],investments:[],goals:[],financial_findings:[]};
describe('senior ledger reconciliation gates',()=>{
 it('counts only movements AFTER dated opening balance',()=>{
  const d:FinanceData={...empty,accounts:[{id:'a',name:'Account',account_type:'checking',currency:'COP',opening_balance:500000,balance_kind:'documented',balance_as_of:'2026-09-30'}],movements:[
    {id:'old',account_id:'a',category_id:null,movement_type:'income',occurred_at:'2026-09-29',description:'Already in balance',amount:100000,currency:'COP',amount_cop:null},
    {id:'same-day',account_id:'a',category_id:null,movement_type:'expense',occurred_at:'2026-09-30',description:'Included in snapshot',amount:20000,currency:'COP',amount_cop:null},
    {id:'new',account_id:'a',category_id:null,movement_type:'expense',occurred_at:'2026-10-02',description:'After snapshot',amount:20000,currency:'COP',amount_cop:null},
  ]}; expect(calculateBalances(d).cash).toBe(480000);
 });
 it('double entry own-account transfers do not create income or consumption',()=>{
  const d:FinanceData={...empty,accounts:[
    {id:'a',name:'Checking',account_type:'checking',currency:'COP',opening_balance:100000,balance_kind:'documented',balance_as_of:'2026-10-01'},
    {id:'b',name:'Savings',account_type:'savings',currency:'COP',opening_balance:0,balance_kind:'documented',balance_as_of:'2026-10-01'},
   ],movements:[
    {id:'out',account_id:'a',category_id:null,movement_type:'transfer',transfer_direction:'out',occurred_at:'2026-10-02',description:'Own transfer',amount:45000,currency:'COP',amount_cop:null},
    {id:'in',account_id:'b',category_id:null,movement_type:'transfer',transfer_direction:'in',occurred_at:'2026-10-02',description:'Own transfer',amount:45000,currency:'COP',amount_cop:null},
   ]};
   expect(calculateBalances(d).balances.map(a=>a.value)).toEqual([55000,45000]);
   expect(calculateBalances(d).cash).toBe(100000);
   expect(monthly(d,'2026-10')).toEqual({income:0,expenses:0,savings:0});
 });
});
