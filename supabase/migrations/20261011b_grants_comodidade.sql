-- Migration: 20261011b_grants_comodidade
--
-- `comodidade` foi criada na migration 007 (antes da exigência de GRANTs
-- explícitos do Supabase) e nunca precisou de escrita pela aplicação — só
-- leitura e os vínculos em `embarcacao_comodidades`. A tela de "Cadastros
-- Auxiliares" do admin passa a inserir/atualizar/excluir linhas da própria
-- tabela `comodidade`, então ela precisa dos mesmos GRANTs que
-- `acessorios`/`equipamentos_seguranca` já têm.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comodidade TO anon, authenticated, service_role;
