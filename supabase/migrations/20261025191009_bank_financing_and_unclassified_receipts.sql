-- The cash advance is debt financing, never salary or spending.
-- Unidentified bank credits must affect the bank register without
-- being treated as verified income or a transfer from own pockets.
begin;
alter table public.movements
  drop constraint if exists movements_movement_type_check;
alter table public.movements
  add constraint movements_movement_type_check
    check (movement_type in (
      'income','expense','transfer','card_payment','investment_contribution',
      'debt_payment','adjustment','financing_inflow','unclassified_inflow'
    ));
commit;
