import { cashFlow, netWorth, type Movement } from './ledger';

export interface AccountRow { id: string; name: string; account_type: string; currency: string; opening_balance: number | string; balance_kind: string; balance_as_of?: string }
export interface CategoryRow { id: string; name: string; flow_type: 'income'|'expense' }
export interface MovementRow {
 id: string; account_id: string; category_id: string | null; movement_type: string;
 occurred_at: string; description: string; amount: number | string; currency: string;
 amount_cop: number | string | null; external_source?: string | null; external_key?: string | null; transfer_direction?: 'in'|'out'|null;
}
export interface BudgetRow { id: string; category_id: string; period_start: string; period_end: string; amount: number | string; currency: string }
export interface DebtRow { id: string; name: string; lender?: string; balance: number | string; currency: string; balance_kind: string; annual_rate?: number | string | null; due_day?: number | null }
export interface InvestmentRow { id: string; name: string; market_value: number | string; currency: string; value_kind: string; valued_at: string }
export interface GoalRow { id: string; name: string; target_amount: number | string; current_amount: number | string; currency: string; status: string; target_date?: string | null }
export interface Finding { type: string; title: string; detail: string; priority: 'high' | 'medium' | 'low'; action: string }
export interface FinanceData { accounts: AccountRow[]; categories: CategoryRow[]; movements: MovementRow[]; budgets: BudgetRow[]; debts: DebtRow[]; investments: InvestmentRow[]; goals: GoalRow[]; financial_findings: unknown[] }

export const money = (value: unknown): number => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
export function converted(value: { amount?: number|string; amount_cop?: number|string|null; currency: string; market_value?: number|string; balance?: number|string }): number | null {
 const amount = money(value.amount ?? value.market_value ?? value.balance);
 if (value.currency === 'COP') return amount;
 if (value.amount_cop != null && Number(value.amount_cop)>0) return money(value.amount_cop);
 return null;
}
export function monthly(data: FinanceData, period: string) {
 const selected=data.movements.filter(m=>m.occurred_at.startsWith(period) && converted(m)!==null);
 const movements: Movement[]=selected.map(m=>({
   id:m.id,date:m.occurred_at,description:m.description,category:data.categories.find(c=>c.id===m.category_id)?.name||'Sin categoría',
   amount:money(m.amount),amountCop:m.amount_cop==null?undefined:money(m.amount_cop),
   currency:m.currency==='COP'?'COP':'USD',kind: m.movement_type as Movement['kind'],account:m.account_id,
 }));
 return cashFlow(movements);
}
export function calculateBalances(data: FinanceData) {
 const balances=data.accounts.map(account=>{
   // A snapshot of the account opening balance plus posted movements. Loan and investment valuations are separate.
   // An opening balance is a dated snapshot, not a timeless starting point.
   // Exclude older and same-day movements to prevent double counting on historical imports.
   const convertedMovements=data.movements.filter(m=>m.account_id===account.id && (!account.balance_as_of || m.occurred_at>account.balance_as_of) && converted(m)!==null);
   const delta=convertedMovements.reduce((sum,m)=>{
     const n=converted(m)!;
     return sum+(m.movement_type==='income'?n:m.movement_type==='transfer'?(m.transfer_direction==='out'?-n:m.transfer_direction==='in'?n:0): ['expense','card_payment','debt_payment','investment_contribution'].includes(m.movement_type)?-n:0);
   },0);
   return {...account, value:account.account_type==='credit_card'?null:account.currency==='COP'?money(account.opening_balance)+delta:null};
 });
 const cash=balances.reduce((sum,a)=>sum+(a.value??0),0);
 const investments=data.investments.reduce((sum,i)=>sum+(converted({...i,amount:i.market_value})??0),0);
 const debts=data.debts.reduce((sum,d)=>sum+(converted({...d,amount:d.balance})??0),0);
 const excluded=balances.filter(a=>a.value===null).length+data.investments.filter(i=>i.currency!=='COP').length+data.debts.filter(d=>d.currency!=='COP').length;
 return {balances,cash,investments,debts,assets:cash+investments,net:netWorth(cash+investments,debts),partial:excluded>0};
}
export function budgetStatus(data: FinanceData, period: string) {
 return data.budgets.filter(b=>b.period_start<=period+'-31' && b.period_end>=period+'-01').map(b=>{
   const spent=data.movements.filter(m=>m.category_id===b.category_id && m.movement_type==='expense' && m.occurred_at.startsWith(period)).reduce((n,m)=>n+(converted(m)??0),0);
   return {id:b.id,name:data.categories.find(c=>c.id===b.category_id)?.name||'Categoría',budget:money(b.amount),spent, remaining:money(b.amount)-spent};
 });
}
export function findings(data: FinanceData,period: string): Finding[] {
 const f:Finding[]=[];
 const flow=monthly(data,period);const state=calculateBalances(data);
 if (flow.expenses>flow.income && flow.expenses>0) f.push({type:'deficit',title:'Gastos superiores a ingresos',detail:'Los gastos clasificados del período superan los ingresos: diferencia COP '+String(flow.expenses-flow.income),priority:'high',action:'Revisar categorías de consumo y fechas de pagos.'});
 for(const b of budgetStatus(data,period))if(b.budget>0 && b.spent>b.budget) f.push({type:'budget_overrun',title:'Presupuesto superado: '+b.name,detail:'Exceso COP '+String(b.spent-b.budget),priority:'medium',action:'Revisar o ajustar el presupuesto documentando el cambio.'});
 if (state.partial || data.movements.some(m=>m.currency!=='COP'&&converted(m)===null)) f.push({type:'valuation',title:'Conciliación cambiaria pendiente',detail:'Existen saldos o movimientos sin valoración verificable en COP. Los totales son parciales.',priority:'high',action:'Registrar tipo de cambio y fecha de valoración; no inventar cotizaciones.'});
 if(!data.accounts.length) f.push({type:'setup',title:'Agrega tus cuentas',detail:'Sin cuentas no es posible establecer liquidez documentada.',priority:'medium',action:'Registra cuenta, tipo, saldo de apertura y naturaleza estimada/documentada.'});
 if(!f.length)f.push({type:'review',title:'Sin alertas automáticas',detail:'No se detectaron alertas con las reglas disponibles. Esto no equivale a auditoría ni asesoría de inversión.',priority:'low',action:'Completa las fuentes y verifica los saldos.'});
 return f;
}
