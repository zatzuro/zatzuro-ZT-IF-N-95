import {describe,expect,it} from 'vitest';
import {projectDailyCash,projectPayroll,type ForecastEvent} from './cashForecast';
const event=(overrides:Partial<ForecastEvent>={}):ForecastEvent=>({
 id:'e1',dueDate:'2026-10-27',direction:'out',amountCop:800,certainty:'confirmed',
 channel:'bank',status:'pending',kind:'card_payment',...overrides
});
const run=(events:ForecastEvent[],scenario:'base'|'conservative'|'favorable'='base')=>
 projectDailyCash({today:'2026-10-25',days:30,openingCash:1000,calendarVerified:true,events,scenario});
describe('daily cash projection',()=>{
 it('projects cash daily and identifies first shortfall without converting payments into consumption',()=>{
  const result=run([event(),event({id:'e2',dueDate:'2026-10-28',amountCop:400,kind:'loan_payment'})]);
  expect(result.ready).toBe(true);
  if(result.ready){expect(result.firstShortfall).toBe('2026-10-28');expect(result.endingBalance).toBe(-200);}
 });
 it('excludes already paid commitments, payroll deductions and internal transfers',()=>{
  const result=run([event({status:'paid'}),event({id:'e2',channel:'payroll_deduction'}),
    event({id:'e3',kind:'transfer',direction:'in',amountCop:800})]);
  expect(result.ready&&result.endingBalance).toBe(1000);
 });
 it('models favorable versus conservative without fabricated numbers',()=>{
  const events=[event({certainty:'estimated'}),event({id:'income',direction:'in',amountCop:600,kind:'salary',certainty:'estimated'})];
  const conservative=run(events,'conservative'),favorable=run(events,'favorable'),base=run(events,'base');
  expect(conservative.ready&&conservative.endingBalance).toBe(200);
  expect(base.ready&&base.endingBalance).toBe(800);
  expect(favorable.ready&&favorable.endingBalance).toBe(1600);
 });
 it('refuses projections without verified calendar or reconciled opening cash',()=>{
  const result=projectDailyCash({today:'2026-10-25',days:30,openingCash:1000,calendarVerified:false,events:[],scenario:'base'});
  expect(result.ready).toBe(false);
  const empty=projectDailyCash({today:'2026-10-25',days:30,openingCash:null,calendarVerified:true,events:[],scenario:'base'});
  expect(empty.ready).toBe(false);
 });
 it('rejects unknown amounts and duplicated events',()=>{
  expect(run([event({amountCop:null})]).ready).toBe(false);
  expect(run([event(),event({dueDate:'2026-10-29'})]).ready).toBe(false);
 });
});
describe('payroll factors',()=>{
 it('uses the verified factor, never assumes it equals achievement',()=>{
  const result=projectPayroll({compliance:0.75,variableBase:100000,basicSalary:200000,
    factors:[{compliance:0.75,paymentFactor:0.5}],confirmedDeductions:50000});
  expect(result).toEqual({factor:0.5,commission:50000,gross:250000,net:200000});
 });
 it('does not invent salary net without known deductions or absent factor',()=>{
  expect(projectPayroll({compliance:0.8,variableBase:100000,basicSalary:200000,
    factors:[{compliance:0.8,paymentFactor:0.9}],confirmedDeductions:null}).net).toBeNull();
  expect(projectPayroll({compliance:0.81,variableBase:100000,basicSalary:200000,
    factors:[{compliance:0.8,paymentFactor:0.9}],confirmedDeductions:0}).commission).toBeNull();
 });
});
