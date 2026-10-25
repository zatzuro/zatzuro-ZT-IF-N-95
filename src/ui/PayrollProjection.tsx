import {useMemo,useState} from 'react';
import {projectPayroll} from '../domain/cashForecast';
import {formatCop} from '../domain/ledger';

export type CommissionFactorRow={compliance:number|string;payment_factor:number|string;source_name:string;source_modified_at:string};
const normal=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;

export default function PayrollProjection({factors}:{factors:CommissionFactorRow[]}){
 const [compliance,setCompliance]=useState('');const [basic,setBasic]=useState('');
 const [variable,setVariable]=useState('');const [deductions,setDeductions]=useState('');
 const [month,setMonth]=useState('');
 const projectedMonth=useMemo(()=>{
  if(!/^\d{4}-\d{2}$/.test(month))return null;
  const year=Number(month.slice(0,4)),m=Number(month.slice(5,7));
  if(m<1||m>12)return null;
  return new Date(Date.UTC(year,m,1)).toISOString().slice(0,7);
 },[month]);
 const c=normal(compliance),b=normal(basic),v=normal(variable),d=normal(deductions);
 const ready=c!==null&&c<=300&&b!==null&&v!==null;
 const projection=ready?projectPayroll({
  compliance:c/100,basicSalary:b,variableBase:v,confirmedDeductions:d,
  factors:factors.map(row=>({compliance:Number(row.compliance),paymentFactor:Number(row.payment_factor)}))
 }):null;
 return <section className="fs-panel fs-payroll" aria-label="Simulador de nómina">
  <div className="fs-section"><h2>Nómina y comisión · simulación privada</h2><span>Factor verificado, neto condicionado</span></div>
  <p>Ingresar cifras aquí no registra una nómina ni modifica movimientos. El cumplimiento se aplica al mes de pago siguiente; el día de abono debe acreditarse con el calendario real.</p>
  <div className="fs-calendar-form">
   <label>Mes de cumplimiento<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
   <label>Cumplimiento (%)<input type="number" min="0" max="300" step="0.01" value={compliance} onChange={e=>setCompliance(e.target.value)}/></label>
   <label>Salario básico vigente (COP)<input type="number" min="0" step="1" value={basic} placeholder="Verificar según contrato" onChange={e=>setBasic(e.target.value)}/></label>
   <label>Base variable vigente (COP)<input type="number" min="0" step="1" value={variable} placeholder="Verificar base variable" onChange={e=>setVariable(e.target.value)}/></label>
   <label>Deducciones totales acreditadas (COP)<input type="number" min="0" step="1" value={deductions} placeholder="Vacío si faltan" onChange={e=>setDeductions(e.target.value)}/></label>
  </div>
  <div className="fs-payroll-values">
   <div><span>Período previsto de pago</span><strong>{projectedMonth||'Por seleccionar'}</strong></div>
   <div><span>Factor real de tabla</span><strong>{projection?.factor==null?'Sin factor exacto':(projection.factor*100).toLocaleString('es-CO')+' %'}</strong></div>
   <div><span>Comisión estimada</span><strong>{projection?.commission==null?'Por verificar':formatCop(projection.commission)}</strong></div>
   <div><span>Devengo básico + variable</span><strong>{projection?.gross==null?'Por verificar':formatCop(projection.gross)}</strong></div>
   <div><span>Neto después de descuentos</span><strong>{projection?.net==null?'No calculable aún':formatCop(projection.net)}</strong></div>
  </div>
  <p className="fs-guidance">Fuente de factores: {factors.length>0?factors[0].source_name:'No sincronizada'}; {factors.length} tramos disponibles. Si el cumplimiento no coincide exactamente con la tabla, no se interpola ni se asume factor 1:1. Las primas, retención, pagos extraordinarios y deducciones no incluidas permanecen fuera de esta estimación.</p>
 </section>;
}
