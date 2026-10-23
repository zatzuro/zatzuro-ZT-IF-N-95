export type Kind = 'income' | 'expense' | 'transfer' | 'card_payment' | 'investment_contribution';
export interface Movement {
  id: string; date: string; description: string; category: string; amount: number;
  currency: 'COP' | 'USD'; amountCop?: number; kind: Kind; account: string;
}

/** Totals are kept in one currency. Foreign currency entries require an explicit COP valuation. */
function amountAsCop(movement: Movement): number | null {
  if (movement.currency === 'COP') return movement.amount;
  return movement.amountCop ?? null;
}

/** Consumption spending excludes transfers, card settlement, and investment funding. */
export function consumptionExpenses(movements: Movement[]): number {
  return movements.reduce((sum, movement) => {
    const amount = amountAsCop(movement);
    return movement.kind === 'expense' && amount !== null ? sum + amount : sum;
  }, 0);
}

export function cashFlow(movements: Movement[]) {
  const income = movements.reduce((sum, movement) => {
    const amount = amountAsCop(movement);
    return movement.kind === 'income' && amount !== null ? sum + amount : sum;
  }, 0);
  const expenses = consumptionExpenses(movements);
  return { income, expenses, savings: income - expenses };
}

export function netWorth(assets: number, liabilities: number): number { return assets - liabilities; }

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}
