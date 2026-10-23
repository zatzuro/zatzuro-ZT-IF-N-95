import type { Movement } from './ledger';

export const demoMovements: Movement[] = [
  { id: 'demo-01', date: '2025-04-02', description: 'Nómina — Empresa S.A.', category: 'Ingresos', amount: 8_200_000, currency: 'COP', kind: 'income', account: 'Cuenta principal' },
  { id: 'demo-02', date: '2025-04-03', description: 'Éxito — Supermercado', category: 'Alimentación', amount: 186_000, currency: 'COP', kind: 'expense', account: 'Tarjeta débito' },
  { id: 'demo-03', date: '2025-03-31', description: 'Transferencia a ahorros', category: 'Transferencias propias', amount: 1_000_000, currency: 'COP', kind: 'transfer', account: 'Cuenta principal' },
  { id: 'demo-04', date: '2025-04-05', description: 'Netflix', category: 'Ocio', amount: 24_900, currency: 'COP', kind: 'expense', account: 'Tarjeta débito' },
  { id: 'demo-05', date: '2025-04-04', description: 'Terpel', category: 'Transporte', amount: 120_000, currency: 'COP', kind: 'expense', account: 'Tarjeta crédito' },
  { id: 'demo-06', date: '2025-03-25', description: 'Abono a inversión', category: 'Aportes inversión', amount: 350_000, currency: 'COP', kind: 'investment_contribution', account: 'Broker demo' },
  { id: 'demo-07', date: '2025-04-01', description: 'Arriendo', category: 'Vivienda', amount: 1_600_000, currency: 'COP', kind: 'expense', account: 'Cuenta principal' },
  { id: 'demo-08', date: '2025-04-06', description: 'Mercado', category: 'Alimentación', amount: 500_000, currency: 'COP', kind: 'expense', account: 'Tarjeta débito' },
  { id: 'demo-09', date: '2025-04-07', description: 'Transporte mensual', category: 'Transporte', amount: 200_000, currency: 'COP', kind: 'expense', account: 'Tarjeta débito' },
  { id: 'demo-10', date: '2025-04-02', description: 'Servicios públicos', category: 'Vivienda', amount: 249_100, currency: 'COP', kind: 'expense', account: 'Cuenta principal' },
];

const colors: Record<string, string> = { Vivienda: '#347df4', Transporte: '#10a9a8', Alimentación: '#ff982f', Ocio: '#ffbf36', Otros: '#a6b0bd' };
export const categorySpending = Object.entries(demoMovements.filter(m => m.kind === 'expense').reduce<Record<string, number>>((totals, movement) => {
  totals[movement.category] = (totals[movement.category] ?? 0) + movement.amount;
  return totals;
}, {})).map(([name, value]) => ({ name, value, color: colors[name] ?? '#a6b0bd' }));

export const netWorthSeries = [
  { month: 'Ene', assets: 150, liabilities: 53, net: 97 }, { month: 'Feb', assets: 163, liabilities: 60, net: 103 },
  { month: 'Mar', assets: 170, liabilities: 61, net: 109 }, { month: 'Abr', assets: 180, liabilities: 64, net: 116 },
  { month: 'May', assets: 190, liabilities: 66, net: 124 }, { month: 'Jun', assets: 200, liabilities: 68, net: 132 },
  { month: 'Jul', assets: 212, liabilities: 70, net: 142 }, { month: 'Ago', assets: 227, liabilities: 73, net: 154 },
  { month: 'Sep', assets: 240, liabilities: 76, net: 164 }, { month: 'Oct', assets: 255, liabilities: 79, net: 176 },
  { month: 'Nov', assets: 273, liabilities: 84, net: 189 }, { month: 'Dic', assets: 300, liabilities: 100, net: 200 },
];

export const cashFlowSeries = [
  { month: 'Ene', income: 10.8, expenses: 7.4 }, { month: 'Feb', income: 10.3, expenses: 7.6 },
  { month: 'Mar', income: 11.7, expenses: 8.9 }, { month: 'Abr', income: 13.8, expenses: 10.5 },
  { month: 'May', income: 12.8, expenses: 10.6 }, { month: 'Jun', income: 12.4, expenses: 8.9 },
  { month: 'Jul', income: 13.1, expenses: 9.2 }, { month: 'Ago', income: 13.6, expenses: 10.1 },
  { month: 'Sep', income: 12.9, expenses: 9.7 }, { month: 'Oct', income: 14.2, expenses: 10.5 },
  { month: 'Nov', income: 13.7, expenses: 9.8 }, { month: 'Dic', income: 14.5, expenses: 10.9 },
];

export const budgetDemo = {
  current: [
    { name: 'Vivienda', spent: 2_230_000, budget: 2_500_000, color: '#4b9afb', icon: '🏠' },
    { name: 'Transporte', spent: 1_160_000, budget: 1_200_000, color: '#10b775', icon: '🚘' },
    { name: 'Alimentación', spent: 1_460_000, budget: 1_500_000, color: '#ff982f', icon: '🍴' },
    { name: 'Ocio', spent: 810_000, budget: 1_000_000, color: '#8450ee', icon: '🎮' },
    { name: 'Aportes inversión', spent: 410_000, budget: 500_000, color: '#28b978', icon: '▥' },
  ],
  previous: [
    { name: 'Vivienda', spent: 2_150_000, budget: 2_400_000, color: '#4b9afb', icon: '🏠' },
    { name: 'Transporte', spent: 980_000, budget: 1_100_000, color: '#10b775', icon: '🚘' },
    { name: 'Alimentación', spent: 1_250_000, budget: 1_400_000, color: '#ff982f', icon: '🍴' },
    { name: 'Ocio', spent: 620_000, budget: 900_000, color: '#8450ee', icon: '🎮' },
    { name: 'Aportes inversión', spent: 300_000, budget: 450_000, color: '#28b978', icon: '▥' },
  ],
};
