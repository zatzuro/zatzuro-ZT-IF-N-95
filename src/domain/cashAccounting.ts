import {converted, type FinanceData, type MovementRow} from './private';

export type CashBreakdown = {
  consumption: number | null;
  operationalInflows: number | null;
  financingReceived: number | null;
  bankOutflows: number | null;
  bankNet: number | null;
  cardPayments: number | null;
  debtPayments: number | null;
  investmentsFunded: number | null;
  transferVolume: number | null;
  pendingChecks: string[];
  movementCount: number;
};

/** Booked cash outflows are not the same as consumption.
 * A credit-card settlement affects cash, not the original consumption again.
 * Two legs of a matched own-account transfer must cancel, not create salary.
 */
export function cashBreakdown(data: FinanceData, start: string, end: string): CashBreakdown {
  const rows = data.movements.filter(m => m.occurred_at >= start && m.occurred_at <= end);
  const bankIds = new Set(data.accounts.filter(a => ['cash','checking','savings'].includes(a.account_type)).map(a=>a.id));
  const pendingChecks: string[] = [];
  const totals = {consumption:0, operationalInflows:0, financingReceived:0, bankOutflows:0, cardPayments:0, debtPayments:0, investmentsFunded:0, transferVolume:0};
  let complete = true;
  const transferGroups = new Map<string, MovementRow[]>();
  for(const row of rows){
    if(row.movement_type === 'transfer'){
      if(!row.transfer_group_id) {complete=false;pendingChecks.push('Transferencia sin par identificado');continue;}
      const group=transferGroups.get(row.transfer_group_id) ?? [];
      group.push(row);transferGroups.set(row.transfer_group_id,group);
    }
    const amount = converted(row);
    if(amount === null){complete=false;pendingChecks.push('Movimiento sin valoración COP');continue;}
    if(row.movement_type==='expense') totals.consumption += amount;
    if(!bankIds.has(row.account_id))continue;
    if(row.movement_type==='income') totals.operationalInflows += amount;
    else if(row.movement_type==='financing_inflow') totals.financingReceived += amount;
    else if(row.movement_type==='unclassified_inflow'){complete=false;pendingChecks.push('Abono recibido sin origen o naturaleza conciliada');}
    else if(['expense','card_payment','debt_payment','investment_contribution'].includes(row.movement_type)){
      totals.bankOutflows += amount;
      if(row.movement_type==='card_payment')totals.cardPayments+=amount;
      if(row.movement_type==='debt_payment')totals.debtPayments+=amount;
      if(row.movement_type==='investment_contribution')totals.investmentsFunded+=amount;
    } else if(row.movement_type==='adjustment'){
      complete=false;pendingChecks.push('Ajuste contable sin dirección de caja');
    } else if(!['transfer'].includes(row.movement_type)){
      complete=false;pendingChecks.push('Tipo de movimiento pendiente de clasificar');
    }
  }
  for(const legs of transferGroups.values()){
    const incoming=legs.filter(m=>m.transfer_direction==='in');
    const outgoing=legs.filter(m=>m.transfer_direction==='out');
    const valid=legs.length===2 && incoming.length===1 && outgoing.length===1 &&
      converted(incoming[0])!==null && converted(outgoing[0])!==null &&
      Math.abs(converted(incoming[0])!-converted(outgoing[0])!) < 0.01;
    if(!valid){complete=false;pendingChecks.push('Transferencia sin contrapartida válida');continue;}
    totals.transferVolume+=converted(outgoing[0])!;
    // Only transfers between an operational bank and non-operational external
    // accounts change cash. Internal transfers are excluded from inflows/outflows.
    const fromBank=bankIds.has(outgoing[0].account_id),toBank=bankIds.has(incoming[0].account_id);
    if(fromBank && !toBank)totals.bankOutflows+=converted(outgoing[0])!;
    if(!fromBank && toBank)totals.operationalInflows+=converted(incoming[0])!;
  }
  // No events is a legitimate absence of evidence, not zero observed cash flow.
  const hasRows = rows.length>0;
  return {
    consumption:hasRows && complete?totals.consumption:null,
    operationalInflows:hasRows && complete?totals.operationalInflows:null,
    financingReceived:hasRows && complete?totals.financingReceived:null,
    bankOutflows:hasRows && complete?totals.bankOutflows:null,
    bankNet:hasRows && complete?totals.operationalInflows+totals.financingReceived-totals.bankOutflows:null,
    cardPayments:hasRows && complete?totals.cardPayments:null,
    debtPayments:hasRows && complete?totals.debtPayments:null,
    investmentsFunded:hasRows && complete?totals.investmentsFunded:null,
    transferVolume:hasRows && complete?totals.transferVolume:null,
    pendingChecks:[...new Set(pendingChecks)],
    movementCount:rows.length
  };
}
