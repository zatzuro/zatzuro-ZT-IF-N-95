import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('dashboard demo workflow', () => {
  it('labels sample figures and filters movements by category', () => {
    render(<App />);
    expect(screen.getByText('MODO DEMOSTRACIÓN')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Alimentación/ }));
    expect(screen.getByText('Éxito — Supermercado')).toBeInTheDocument();
    expect(screen.queryByText('Nómina — Empresa S.A.')).not.toBeInTheDocument();
  });

  it('adds a movement to the session only and reflects it in recent movements', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /Registrar/ })[0]);
    const dialog = screen.getByRole('heading', { name: 'Nuevo movimiento' }).closest('form')!;
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Café de prueba' } });
    fireEvent.change(within(dialog).getByLabelText('Monto en COP'), { target: { value: '12000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Añadir movimiento/ }));
    expect(screen.getByText('Café de prueba')).toBeInTheDocument();
    expect(screen.getByText('Movimiento añadido al conjunto de demostración.')).toBeInTheDocument();
  });

  it('changes the active module through navigation', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Presupuesto/ }));
    expect(screen.getByRole('heading', { name: 'Presupuesto' })).toBeInTheDocument();
  });

  it('filters recent movements and consumption figures by the selected month', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Mes del tablero' }), { target: { value: 'Mar 2025' } });
    expect(screen.getByText('Sin gastos de consumo en este período.')).toBeInTheDocument();
    expect(screen.getByText('Transferencia a ahorros')).toBeInTheDocument();
    expect(screen.queryByText('Éxito — Supermercado')).not.toBeInTheDocument();
  });
});
