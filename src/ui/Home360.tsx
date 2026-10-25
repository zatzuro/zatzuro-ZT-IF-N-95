import {useMemo} from 'react';
import {AlertTriangle, ArrowRight, CalendarDays, ShieldCheck, Wallet} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {buildHome360} from '../domain/home360';
import {converted, monthly, type FinanceData} from '../domain/private';
import {formatCop} from '../domain/ledger';

type Destination = 'Configuración' | 'Créditos' | 'Presupuesto' | 'Ingresos' | 'Gastos' | 'Datos migrados';
type Props = {data: FinanceData; period: string; today: string; onNavigate: (target: Destination) => void};
const format = (value: number | null) => value === null ? 'Sin conciliar' : formatCop(value);

export default function Home360({data, period, today, onNavigate}: Props) {
  const summary = useMemo(() => buildHome360(data, period, today), [data, period, today]);
  const series = useMemo(() => Array.from({length: 6}, (_, index) => {
    const month = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 6 + index, 1)).toISOString().slice(0, 7);
    const entries = data.movements.filter(movement => movement.occurred_at.startsWith(month) && movement.occurred_at <= today);
    if (!entries.length || entries.some(movement => converted(movement) === null))
      return {period: month, income: null, expenses: null};
    return {period: month, ...monthly({...data, movements: entries}, month)};
  }), [data, period, today]);

  const cards = [
    {label: 'Liquidez documentada', value: summary.liquidity, detail: summary.notes.liquidity, target: 'Configuración' as Destination},
    {label: 'Ingresos registrados', value: summary.income, detail: summary.notes.flow, target: 'Ingresos' as Destination},
    {label: 'Consumo registrado', value: summary.expenses, detail: summary.notes.flow, target: 'Gastos' as Destination},
    {label: 'Presupuesto restante', value: summary.budgetRemaining, detail: summary.notes.budget, target: 'Presupuesto' as Destination},
    {label: 'Deuda documentada', value: summary.debtTotal, detail: summary.notes.debt, target: 'Créditos' as Destination}
  ];

  return <section className="fs-home360" aria-label="Resumen financiero 360">
    <div className="fs-home360-title">
      <div><small className="fs-source-kicker">INICIO / PANEL DE DECISIONES</small><h2>Tu situación financiera en una mirada</h2>
        <p>Separamos movimientos operativos, saldos documentales y proyecciones. Los vacíos no se sustituyen por ceros.</p></div>
      <span className="fs-home360-date">Corte de consulta: {today}</span>
    </div>
    <div className="fs-home360-grid">
      {cards.map(card => <article className="fs-metric" key={card.label}>
        <small>{card.label}</small><strong>{format(card.value)}</strong>
        <span>{card.detail}</span>
        <button type="button" className="fs-home360-link" onClick={() => onNavigate(card.target)}>
          Revisar <ArrowRight size={13}/>
        </button>
      </article>)}
    </div>
    <div className="fs-home360-columns">
      <section className="fs-panel">
        <div className="fs-section"><h2>Flujo mensual operativo</h2><span>Últimos 6 meses · COP</span></div>
        {series.some(month => month.income !== null) ?
          <ResponsiveContainer width="100%" height={235}>
            <BarChart data={series}>
              <CartesianGrid vertical={false} stroke="#edf2f5"/>
              <XAxis dataKey="period"/><YAxis tickFormatter={value => String(Math.round(Number(value) / 1_000_000)) + ' M'}/>
              <Tooltip formatter={value => formatCop(Number(value))}/>
              <Bar dataKey="income" name="Ingresos registrados" fill="#16ad83" radius={[4,4,0,0]}/>
              <Bar dataKey="expenses" name="Consumo registrado" fill="#4a83f5" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer> :
          <p>No hay períodos completos con movimientos operativos valorados. No se grafican los registros históricos como flujo bancario.</p>}
        <p>Las barras reflejan el mes calendario seleccionado, no el ciclo de nómina. La configuración de ese ciclo sigue pendiente.</p>
      </section>
      <section className="fs-panel">
        <div className="fs-section"><h2>Calidad y conciliación</h2><ShieldCheck size={18}/></div>
        <div className="fs-home360-facts">
          <div><span>Cuentas de caja identificadas</span><strong>{summary.quality.cashAccounts}</strong></div>
          <div><span>Cuentas sin corte documental completo</span><strong>{summary.quality.undocumentedAccounts}</strong></div>
          <div><span>Movimientos sin valoración COP</span><strong>{summary.quality.unvaluedCount}</strong></div>
          <div><span>Movimientos operativos del período</span><strong>{summary.quality.periodMovements}</strong></div>
          <div><span>Créditos sin día referencial</span><strong>{summary.quality.debtsWithoutDay}</strong></div>
        </div>
        <p>Los datos migrados son evidencia histórica. No deben convertirse automáticamente en ingresos, gastos, ahorro o saldos disponibles.</p>
        <button className="fs-small" type="button" onClick={() => onNavigate('Datos migrados')}>Consultar procedencia <ArrowRight size={14}/></button>
      </section>
    </div>
    <div className="fs-home360-columns">
      <section className="fs-panel">
        <div className="fs-section"><h2>Obligaciones y pagos próximos</h2><CalendarDays size={18}/></div>
        {summary.dueDayReferences.length ?
          <div className="fs-home360-references">
            {summary.dueDayReferences.map(item =>
              <div key={item.id}><span>{item.name}</span><strong>Día {item.day} (referencia)</strong></div>
            )}
          </div> :
          <p>Falta un calendario de vencimientos verificado para mostrar pagos próximos.</p>}
        <p>Los días referenciales no acreditan vencimiento, cuota ni pago. Antes de proyectar caja deben validarse fechas, saldo facturado y cuotas.</p>
        <button className="fs-small" type="button" onClick={() => onNavigate('Créditos')}>Revisar deudas <ArrowRight size={14}/></button>
      </section>
      <section className="fs-panel">
        <div className="fs-section"><h2>Liquidez proyectada · 30/60/90 días</h2><AlertTriangle size={18}/></div>
        <div className="fs-home360-projections">
          {['30 días', '60 días', '90 días'].map(window =>
            <div key={window}><span>{window}</span><strong>Por calcular</strong></div>
          )}
        </div>
        <p><Wallet size={14} aria-hidden="true"/> La proyección requiere saldo de caja conciliado, calendario de nómina con deducciones y compromisos fechados. No hay base suficiente para atribuirte capacidad de pago futura.</p>
      </section>
    </div>
    {(summary.liquidity === null || summary.budgetRemaining === null || summary.debtTotal === null) &&
      <div className="fs-home360-alert" role="status"><AlertTriangle size={17}/><span>Hay indicadores incompletos. Prioriza conciliar cuentas, presupuesto y deudas antes de interpretar tu capacidad financiera como definitiva.</span></div>}
  </section>;
}
