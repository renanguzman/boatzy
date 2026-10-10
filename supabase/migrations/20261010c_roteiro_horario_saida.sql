ALTER TABLE public.roteiro
  ADD COLUMN IF NOT EXISTS horario_saida TIME;
