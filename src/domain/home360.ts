import {budgetStatus, calculateBalances, converted, monthly, money, type FinanceData} from './private';

const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
const validAmount = (value: unknown) => value !== null && value !== '' && Number.isFinite(Number(value));

/**
 * Snapshot for the private home page. Documented data is deliberately distinct
 * from reconciled transactions, budgets and unsupported future projections.
 */
export function buildHome360(data: FinanceData, period: string, today: string) {
  const posted = data.movements.filter(movement => movement.occurred_at <= today);
  const balances = calculateBalances({...data, movements: posted});
  const cashAccounts = balances.balances.filter(account => account.account_type !== 'credit_card');
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

  const inPeriod = posted.filter(movement => movement.occurred_at.startsWith(period));
  const flowReady = inPeriod.length > 0 && inPeriod.every(movement => converted(movement) !== null);
  const flow = flowReady ? monthly({...data, movements: inPeriod}, period) : null;

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
    validAmount(debt.balance) && Number(debt.balance) >= 0
  );
  const debtTotal = debtsReady ? data.debts.reduce((sum, debt) => sum + money(debt.balance), 0) : null;
  const dueDayReferences = data.debts.filter(debt =>
    debt.due_day != null && Number.isInteger(debt.due_day) && debt.due_day >= 1 && debt.due_day <= 31
  ).map(debt => ({id: debt.id, name: debt.name, day: debt.due_day!}));

  const unvaluedCount = data.movements.filter(movement => converted(movement) === null).length;
  const undocumentedAccounts = cashAccounts.filter(account =>
    account.balance_kind !== 'documented' || !validDate(account.balance_as_of)
  ).length;
  const debtsWithoutDay = data.debts.length - dueDayReferences.length;

  return {
    liquidity: cashReady && !unknownAccountMovements ? balances.cash : null,
    income: flow?.income ?? null,
    expenses: flow?.expenses ?? null,
    netFlow: flow?.savings ?? null,
    budgetRemaining,
    debtTotal,
    dueDayReferences,
    quality: {
      cashAccounts: cashAccounts.length,
      undocumentedAccounts,
      unvaluedCount,
      debtsWithoutDay,
      periodMovements: inPeriod.length,
      budgetCategories: relevantBudgets.length
    },
    notes: {
      liquidity: 'Saldo documental de cuentas COP al corte informado y movimientos posteriores registrados. No es confirmación bancaria en tiempo real.',
      flow: 'Libro mayor operativo del mes calendario; no incluye el archivo histórico ni acredita exhaustividad bancaria.',
      budget: 'Solo presupuestos COP con categorías no duplicadas y consumos valorados.',
      debt: 'Solo deudas con saldo COP documentado. No equivale a cuotas ni fechas de pago.'
    },
    projectionAvailable: false as const
  };
}
