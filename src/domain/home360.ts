import {budgetStatus, calculateBalances, converted, money, type FinanceData} from './private';
import {cashBreakdown} from './cashAccounting';

const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
const validAmount = (value: unknown) => value !== null && value !== '' && Number.isFinite(Number(value));

/**
 * Snapshot for the private home page. Documented data is deliberately distinct
 * from reconciled transactions, budgets and unsupported future projections.
 */
export function buildHome360(data: FinanceData, period: string, today: string) {
  const posted = data.movements.filter(movement => movement.occurred_at <= today);
  const balances = calculateBalances({...data, movements: posted});
  const cashAccounts = balances.balances.filter(account => ['cash', 'checking', 'savings'].includes(account.account_type));
  const cashReady = cashAccounts.length > 0 && cashAccounts.every(account =>
    account.currency === 'COP' &&
    account.balance_kind === 'documented' &&
    validAmount(account.opening_balance) &&
    validDate(account.balance_as_of) &&
    account.balance_as_of! <= today &&
    account.value !== null
  );
  const unknownAccountMovements = posted.some(movement =>
    cashAccounts.some(account => account.id === movement.account_id &&
      (!account.balance_as_of || movement.occurred_at > account.balance_as_of)) &&
    converted(movement) === null
  );

  const ledgerCashRows = posted.filter(movement => cashAccounts.some(account => account.id === movement.account_id &&
    (!account.balance_as_of || movement.occurred_at > account.balance_as_of)));
  const unsafeAdjustments = ledgerCashRows.some(row => !['income','expense','card_payment','debt_payment','investment_contribution','transfer','financing_inflow'].includes(row.movement_type));
  const transferIds = new Set(ledgerCashRows.filter(row => row.movement_type === 'transfer').map(row => row.transfer_group_id));
  const invalidTransfers = [...transferIds].some(id => {
    if(!id)return true;
    const legs=posted.filter(row => row.movement_type === 'transfer' && row.transfer_group_id===id);
    if(legs.length!==2 || !legs.some(row=>row.transfer_direction==='in') || !legs.some(row=>row.transfer_direction==='out'))return true;
    const amounts=legs.map(converted);
    return amounts.some(amount=>amount===null) || Math.abs(amounts[0]!-amounts[1]!)>0.01;
  });
  const inPeriod = posted.filter(movement => movement.occurred_at.startsWith(period));
  const lastDay = new Date(Date.UTC(Number(period.slice(0,4)), Number(period.slice(5,7)), 0)).toISOString().slice(0,10);
  const flow = cashBreakdown({...data, movements: posted}, period+'-01', lastDay);

  const relevantBudgets = data.budgets.filter(budget =>
    budget.period_start <= period + '-31' && budget.period_end >= period + '-01'
  );
  const budgetCategories = new Set(relevantBudgets.map(budget => budget.category_id));
  const uniqueBudgetCategories = budgetCategories.size === relevantBudgets.length;
  const missingBudgetValuation = posted.some(movement =>
    movement.occurred_at.startsWith(period) && movement.movement_type === 'expense' &&
    movement.category_id !== null && budgetCategories.has(movement.category_id) &&
    converted(movement) === null
  );
  const budgetReady = relevantBudgets.length > 0 && uniqueBudgetCategories &&
    relevantBudgets.every(budget => budget.currency === 'COP' &&
      validAmount(budget.amount) && Number(budget.amount) >= 0) &&
    !missingBudgetValuation;
  const budget = budgetReady ? budgetStatus({...data, movements: posted}, period) : [];
  const budgetRemaining = budgetReady ? budget.reduce((total, item) => total + item.remaining, 0) : null;

  const debtsReady = data.debts.length > 0 && data.debts.every(debt =>
    debt.currency === 'COP' && debt.balance_kind === 'documented' &&
    validAmount(debt.balance) && Number(debt.balance) >= 0 &&
    validDate(debt.as_of_date ?? undefined) && debt.as_of_date! <= today
  );
  const debtTotal = debtsReady ? data.debts.reduce((sum, debt) => sum + money(debt.balance), 0) : null;
  const dueDayReferences = data.debts.filter(debt =>
    debt.due_day != null && Number.isInteger(debt.due_day) && debt.due_day >= 1 && debt.due_day <= 31
  ).map(debt => ({id: debt.id, name: debt.name, day: debt.due_day!}));

  const unvaluedCount = data.movements.filter(movement => converted(movement) === null).length;
  // Incomplete asset inventory is not evidence of zero unregistered assets.
  // Without an independently verified inventory-completeness flag, net worth cannot be certified.
  const netWorth: number|null = null;
  const undocumentedAccounts = cashAccounts.filter(account =>
    account.balance_kind !== 'documented' || !validDate(account.balance_as_of)
  ).length;
  const debtsWithoutDay = data.debts.length - dueDayReferences.length;

  return {
    liquidity: cashReady && !unknownAccountMovements && !unsafeAdjustments && !invalidTransfers ? cashAccounts.reduce((sum, account) => sum + account.value!, 0) : null,
    income: flow.operationalInflows,
    expenses: flow.consumption,
    netFlow: flow.bankNet,
    bankOutflows: flow.bankOutflows,
    cardPayments: flow.cardPayments,
    debtPayments: flow.debtPayments,
    pendingCashChecks: flow.pendingChecks,
    availableAfterCommitments: null as number|null,
    upcomingIncome: null as number|null,
    upcomingObligations: null as number|null,
    netWorth,
    budgetRemaining,
    debtTotal,
    dueDayReferences,
    quality: {
      cashAccounts: cashAccounts.length,
      undocumentedAccounts,
      unvaluedCount,
      debtsWithoutDay,
      periodMovements: inPeriod.length,
      unresolvedDebtSnapshots: data.debts.filter(d => !validDate(d.as_of_date??undefined) || d.as_of_date!>today).length,
      budgetCategories: relevantBudgets.length
    },
    notes: {
      liquidity: 'Saldo documental condicionado a cortes, operaciones clasificadas y transferencias emparejadas. No es confirmación bancaria en tiempo real.',
      flow: 'Libro mayor operativo del mes calendario: consumo distinto de salidas bancarias. Entradas no son necesariamente nómina.',
      budget: 'Solo presupuestos COP con categorías no duplicadas y consumos valorados.',
      debt: 'Solo deudas con saldo COP documentado. No equivale a cuotas ni fechas de pago.'
    },
    projectionAvailable: false as const
  };
}
