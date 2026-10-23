import { describe, expect, it } from 'vitest';
import { cashFlow, consumptionExpenses, netWorth, percentChange, type Movement } from './ledger';

const rows: Movement[] = [
  { id: 'a', date: '2025-04-01', description: 'Nómina', category: 'Salario', amount: 5_000, currency: 'COP', kind: 'income', account: 'A' },
  { id: 'b', date: '2025-04-02', description: 'Mercado', category: 'Alimentación', amount: 800, currency: 'COP', kind: 'expense', account: 'A' },
  { id: 'c', date: '2025-04-03', description: 'Transferencia propia', category: 'Transferencia', amount: 700, currency: 'COP', kind: 'transfer', account: 'A' },
  { id: 'd', date: '2025-04-04', description: 'Pago tarjeta', category: 'Tarjeta', amount: 600, currency: 'COP', kind: 'card_payment', account: 'A' },
  { id: 'e', date: '2025-04-05', description: 'Aporte inversión', category: 'Inversiones', amount: 500, currency: 'COP', kind: 'investment_contribution', account: 'A' },
];

describe('financial ledger rules', () => {
  it('does not double count transfers, card payments, or investment deposits as consumption', () => expect(consumptionExpenses(rows)).toBe(800));
  it('separates cash flow from balance sheet movements', () => expect(cashFlow(rows)).toEqual({ income: 5_000, expenses: 800, savings: 4_200 }));
  it('calculates net worth from assets and liabilities', () => expect(netWorth(12_000, 3_000)).toBe(9_000));
  it('handles comparison periods with a zero baseline', () => { expect(percentChange(3, 0)).toBeNull(); expect(percentChange(0, 0)).toBe(0); });
  it('does not combine USD and COP without an explicit conversion', () => {
    const mixed = [...rows, { ...rows[0], id: 'usd', amount: 100, currency: 'USD' as const }];
    expect(cashFlow(mixed).income).toBe(5_000);
    expect(cashFlow([{ ...rows[0], amountCop: 420_000, amount: 100, currency: 'USD' }]).income).toBe(420_000);
  });
});
