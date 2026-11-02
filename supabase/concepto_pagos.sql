-- Añade a cada pago su concepto: Mensualidad, Seguro, Clase suelta u Otro.
-- Ejecutar una vez en Supabase > SQL Editor.
alter table pagos add column if not exists concepto text not null default 'Mensualidad';

-- El seguro es anual: se guarda con mes_pagado = 'AAAA-01'.
-- Índice para buscar rápido por concepto y mes.
create index if not exists pagos_concepto_mes_idx on pagos (concepto, mes_pagado);
