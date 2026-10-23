import type { FinanceData } from './private';

export interface CsvRow { [key:string]:string }
export type ImportKind='GASTOS'|'INGRESOS';
export interface Draft { external_source:ImportKind; external_key:string; occurred_at:string; description:string; amount:number; movement_type:'income'|'expense'|'card_payment'; currency:'COP'; categoryName:string; accountName:string; issues:string[] }
export interface Preview {accepted:Draft[];rejected:Draft[];duplicate:number;income:number;expenses:number}

/** Parses quoted CSV, including commas and newlines in cells. Export each native tab separately (CSV UTF-8). */
export function parseCsv(input:string):CsvRow[] {
 const body=input.replace(/^\uFEFF/,'');const records:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<body.length;i++){const c=body[i];
  if(c==='"'){if(quoted&&body[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\r'||c==='\n')&&!quoted){row.push(cell); if(row.some(x=>x.trim()))records.push(row);row=[];cell='';if(c==='\r'&&body[i+1]==='\n')i++;}
  else cell+=c;
 }
 if(quoted)throw new Error('Archivo CSV con comillas sin cerrar.');
 row.push(cell);if(row.some(x=>x.trim()))records.push(row);
 const header=records.shift()?.map(x=>x.trim())||[];
 if(!header.length || new Set(header).size!==header.length)throw new Error('Encabezados CSV vacíos o duplicados.');
 return records.map(cells=>Object.fromEntries(header.map((h,i)=>[h,(cells[i]||'').trim()])));
}
export function parseCop(input:string):number|null {
 const s=input.replace(/[\s$\u00a0]/g,'');
 if(!s)return null;
 const clean=s.replace(/\./g,'').replace(',','.');
 if(!/^-?\d+(\.\d+)?$/.test(clean))return null;
 const n=Number(clean);return Number.isFinite(n)?n:null;
}
export function parseDate(value:string):string|null {
 const m=value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(!m)return null;
 const y=Number(m[3]),mo=Number(m[2]),day=Number(m[1]),d=new Date(Date.UTC(y,mo-1,day));
 return d.getUTCFullYear()===y&&d.getUTCMonth()===mo-1&&d.getUTCDate()===day? [m[3],m[2],m[1]].join('-'):null;
}
const gastoHeader=['ID movimiento','Fecha','Comercio / destinatario','Categoría','Tipo de movimiento','Gasto confirmado (COP)','Cuenta origen'];
const ingresoHeader=['ID ingreso','Fecha de pago','Empresa / pagador','Ingreso después descuentos de ley (COP)'];
export const SHEET_MAPPING:Record<string,string>={
 INGRESOS:'Movimientos de ingreso neto: requiere comprobación de la cifra neta',
 GASTOS:'Consumo y pagos no consumo: clasificar antes de migrar',
 'INVERSIÓNES':'Sin registros detectados; no inferir saldos',
 CREDITOS:'Saldos documentados/estimados; validación manual requerida',
 'DEPOSITOS ETORO':'Depósitos históricos; NO duplicar como gasto de consumo',
 'OPERACIONES ETORO':'Posiciones en USD con fecha y FX; cotejar valor y unidades',
 PRESUPUESTO:'Tablas duales: ingresos y gastos; requiere mapa por rangos',
 'FONDEC - AMOR Y AMISTAD':'Calendario proyectado, no registrar cuotas futuras como pagadas',
 'FONDEC - ORDINARIO':'Calendario proyectado, no registrar cuotas futuras como pagadas',
 'FONDEC - PRIMA':'Proyección de pago único, no es transacción realizada',
 'CAJA SOCIAL - VIVIENDA':'Calendario de amortización proyectado',
 'OCCIDENTE - LIBRANZA':'Cuotas estimadas, conciliar con extractos',
 'DAVIVIENDA - TC GZERO':'Factura documentada, evitar doble conteo'};
export function previewCsv(kind:ImportKind,csv:string,data:FinanceData,incomeAccountName=''):Preview {
 const rows=parseCsv(csv);const required=kind==='GASTOS'?gastoHeader:ingresoHeader;
 if(rows.length && required.some(h=>!(h in rows[0]))) throw new Error('Faltan columnas obligatorias: '+required.filter(h=>!(h in rows[0])).join(', '));
 const known=new Set(data.movements.filter(m=>m.external_source&&m.external_key).map(m=>m.external_source+':'+m.external_key));
 const seen=new Set<string>(),accepted:Draft[]=[],rejected:Draft[]=[];let duplicate=0,income=0,expenses=0;
 for(const r of rows) {
  const id=(kind==='GASTOS'?r['ID movimiento']:r['ID ingreso'])||'';
  const key=kind+':'+id;
  if(id&&(known.has(key)||seen.has(key))){duplicate++;continue;}seen.add(key);
  const date=parseDate(kind==='GASTOS'?r.Fecha:r['Fecha de pago']);
  const raw=kind==='GASTOS'?r['Gasto confirmado (COP)']:r['Ingreso después descuentos de ley (COP)'];
  const amount=parseCop(raw||'');
  const type=kind==='GASTOS'?(r['Tipo de movimiento']||'').toLowerCase():'';
  // A credit-card settlement is not a consumption expense. Transfers and ambiguous rows are quarantined.
  const settlement=/(pago de tarjeta|pago de deuda|abono deuda)/i.test(type);
  const ambiguous=kind==='GASTOS'&&/(transferencia|inversi[oó]n|aporte|ajuste)/i.test(type);
  const issues:string[]=[];
  if(!id)issues.push('ID externo ausente');
  if(!date)issues.push('Fecha inválida');
  if(amount===null||amount<=0)issues.push('Importe confirmado no positivo');
  if(ambiguous)issues.push('Transferencia/aporte: conciliación de contrapartida obligatoria');
  if(kind==='GASTOS'&&/por clasificar|verificar/i.test(r['Categoría']||''))issues.push('Categoría sin verificar');
  const accountName=kind==='GASTOS'?(r['Cuenta origen']||''):incomeAccountName;
  const categoryName=kind==='GASTOS'?(r['Categoría']||''):'Ingresos laborales';
  if(!accountName)issues.push('Cuenta origen sin mapeo');
  if(!data.accounts.some(a=>a.name===accountName&&a.currency==='COP'))issues.push('Cuenta no registrada en el dashboard');
  if(!data.categories.some(c=>c.name===categoryName&&c.flow_type===(kind==='GASTOS'?'expense':'income')))issues.push('Categoría no registrada');
  if(kind==='GASTOS'&&settlement)issues.push('Pago de deuda: registrar sin duplicar como consumo, después de conciliación');
  const d:Draft={external_source:kind,external_key:id,occurred_at:date||'',description:(kind==='GASTOS'?(r['Comercio / destinatario']||r['Descripción bancaria']):r['Empresa / pagador'])||'Sin descripción',amount:amount||0,movement_type:kind==='GASTOS'?'expense':'income',currency:'COP',categoryName,accountName,issues};
  if(issues.length)rejected.push(d);else{accepted.push(d);if(d.movement_type==='income')income+=d.amount;else expenses+=d.amount;}
 }
 return {accepted,rejected,duplicate,income,expenses};
}
