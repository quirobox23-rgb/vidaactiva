-- Añade a cada pago el mes al que corresponde (formato YYYY-MM).
-- Ejecutar una vez en Supabase > SQL Editor.
alter table pagos add column if not exists mes_pagado text;

-- Pagos existentes: se asigna el mes de la fecha de pago.
update pagos
set mes_pagado = substring(fecha_pago::text from 1 for 7)
where mes_pagado is null and fecha_pago is not null;
