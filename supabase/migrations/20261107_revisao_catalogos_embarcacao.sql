-- ============================================================
-- Revisão dos catálogos da embarcação (04/11/2026) — SPEC §17.2.1
--
-- Equipamentos de segurança, acessórios e comodidades tinham itens duplicados entre as tabelas
-- (Caiaque, Churrasqueira, Wakeboard, GPS, toldo…), itens na categoria errada (brinquedos aquáticos
-- em comodidades; escada/plataforma/iluminação em acessórios), nomes imprecisos e lacunas.
--
-- Critério de cada catálogo:
--   * equipamentos_seguranca — salvatagem, incêndio, sinalização de socorro, comunicação,
--     navegação/instrumentos, fundeio/reboque, esgotamento, primeiros socorros e detectores.
--   * acessorios — itens móveis para lazer e atividades: brinquedos e esportes aquáticos, mergulho,
--     pesca e itens avulsos levados no passeio (cooler, caixa de som portátil, cadeira, guarda-sol).
--   * comodidade — estrutura e conforto da embarcação: climatização, banheiro/chuveiro, cozinha e
--     eletrodomésticos, entretenimento fixo, áreas, banho de mar (escada/plataforma), energia e enxoval.
--
-- Nada se perde: renomear mantém o id (vínculos e filtros salvos na busca continuam valendo); mover
-- um item copia os vínculos das embarcações para o item de destino antes de excluir o de origem.
-- Idempotente: rodar de novo não altera nada.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Renomeações no lugar (mesmo id). Ajusta também as traduções.
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- comodidades
    ('comodidade', 'Banheiro a bordo', 'Banheiro a Bordo', 'Onboard bathroom', 'Baño a bordo'),
    ('comodidade', 'Internet WiFi', 'Wi-Fi', 'Wi-Fi', 'Wi-Fi'),
    ('comodidade', 'Toldo/Cobertura', 'Toldo / Cobertura', 'Awning / canopy', 'Toldo / cobertura'),
    -- acessórios
    ('acessorios', 'Caixa de Som Bluetooth', 'Caixa de Som Portátil (Bluetooth)', 'Portable Bluetooth speaker', 'Parlante portátil Bluetooth'),
    ('acessorios', 'Vara de Pesca', 'Equipamento de Pesca', 'Fishing gear', 'Equipo de pesca'),
    -- equipamentos de segurança
    ('equipamentos_seguranca', 'Apito de Neblina', 'Buzina / Apito de Neblina', 'Horn / fog whistle', 'Bocina / silbato de niebla'),
    ('equipamentos_seguranca', 'Bote Salva-Vidas', 'Balsa Salva-Vidas', 'Life raft', 'Balsa salvavidas'),
    ('equipamentos_seguranca', 'Cinto de Segurança Náutico', 'Arnês e Linha de Vida', 'Safety harness and jackline', 'Arnés y línea de vida'),
    ('equipamentos_seguranca', 'Compasso', 'Bússola / Agulha Magnética', 'Magnetic compass', 'Brújula / compás magnético'),
    ('equipamentos_seguranca', 'GPS', 'GPS Náutico', 'Marine GPS', 'GPS náutico'),
    ('equipamentos_seguranca', 'Mapa Náutico', 'Carta Náutica', 'Nautical chart', 'Carta náutica')
  ) AS v(tabela, antigo, novo, en, es)
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I t SET nome = $2, nome_en = $3, nome_es = $4
        WHERE t.nome = $1 AND NOT EXISTS (SELECT 1 FROM public.%1$I x WHERE x.nome = $2)',
      r.tabela)
    USING r.antigo, r.novo, r.en, r.es;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2) Itens novos e destinos das mudanças de categoria.
--    Em item que já existe, só preenche tradução vazia (não sobrescreve o que o admin editou).
-- ------------------------------------------------------------
INSERT INTO public.equipamentos_seguranca (nome, nome_en, nome_es) VALUES
  ('Colete Salva-Vidas Infantil', 'Children''s life jacket', 'Chaleco salvavidas infantil'),
  ('Luzes de Navegação', 'Navigation lights', 'Luces de navegación'),
  ('Radar', 'Radar', 'Radar'),
  ('Sonda de Profundidade (Ecobatímetro)', 'Depth sounder', 'Sonda de profundidad (ecosonda)'),
  ('AIS (Identificação Automática)', 'AIS (automatic identification system)', 'AIS (identificación automática)'),
  ('Telefone Satelital', 'Satellite phone', 'Teléfono satelital'),
  ('Detector de Fumaça', 'Smoke detector', 'Detector de humo'),
  ('Detector de Gás', 'Gas detector', 'Detector de gas'),
  ('Sistema Fixo de Combate a Incêndio', 'Fixed fire suppression system', 'Sistema fijo contra incendios'),
  ('Chave de Emergência (Kill Switch)', 'Engine kill switch', 'Interruptor de emergencia (kill switch)'),
  ('Remos', 'Oars', 'Remos'),
  ('Balde / Bartedouro', 'Bailer / bucket', 'Achicador / balde'),
  ('Holofote de Busca', 'Searchlight', 'Reflector de búsqueda')
ON CONFLICT (nome) DO UPDATE
  SET nome_en = COALESCE(public.equipamentos_seguranca.nome_en, EXCLUDED.nome_en),
      nome_es = COALESCE(public.equipamentos_seguranca.nome_es, EXCLUDED.nome_es);

INSERT INTO public.acessorios (nome, nome_en, nome_es) VALUES
  -- vindos de comodidades
  ('Boia Inflável', 'Inflatable float', 'Flotador inflable'),
  ('Bote de Apoio (Tender)', 'Tender (dinghy)', 'Bote auxiliar (tender)'),
  ('Cadeira de Praia', 'Beach chair', 'Silla de playa'),
  ('Macarrão Flutuante', 'Pool noodle', 'Fideo flotante'),
  ('Máscara de Mergulho', 'Diving mask', 'Máscara de buceo'),
  ('Nadadeiras (Pé de Pato)', 'Fins (flippers)', 'Aletas'),
  ('Tapete Flutuante', 'Floating mat', 'Alfombra flotante'),
  -- novos
  ('Jet Ski', 'Jet ski', 'Moto de agua'),
  ('Bodyboard', 'Bodyboard', 'Bodyboard'),
  ('Guarda-Sol', 'Beach umbrella', 'Sombrilla de playa'),
  ('Roupa de Neoprene', 'Wetsuit', 'Traje de neopreno'),
  ('Binóculo', 'Binoculars', 'Binoculares'),
  ('Câmera à Prova d''Água', 'Waterproof camera', 'Cámara sumergible'),
  ('Piscina Flutuante', 'Floating pool', 'Piscina flotante'),
  ('Scooter Subaquático (Seabob)', 'Underwater scooter (Seabob)', 'Scooter submarino (Seabob)'),
  ('Jogos de Tabuleiro', 'Board games', 'Juegos de mesa')
ON CONFLICT (nome) DO UPDATE
  SET nome_en = COALESCE(public.acessorios.nome_en, EXCLUDED.nome_en),
      nome_es = COALESCE(public.acessorios.nome_es, EXCLUDED.nome_es);

INSERT INTO public.comodidade (nome, nome_en, nome_es) VALUES
  -- vindos de acessórios
  ('Tomadas USB', 'USB charging ports', 'Puertos de carga USB'),
  ('Escada de Banho', 'Swim ladder', 'Escalera de baño'),
  ('Iluminação Subaquática', 'Underwater lighting', 'Iluminación subacuática'),
  ('Plataforma de Banho', 'Swim platform', 'Plataforma de baño'),
  ('Toalhas', 'Towels', 'Toallas'),
  -- novos
  ('Chuveiro de Água Doce', 'Freshwater shower', 'Ducha de agua dulce'),
  ('Água Quente', 'Hot water', 'Agua caliente'),
  ('Fogão / Cooktop', 'Stove / cooktop', 'Fogón / placa de cocción'),
  ('Forno', 'Oven', 'Horno'),
  ('Máquina de Gelo', 'Ice maker', 'Máquina de hielo'),
  ('Adega Climatizada', 'Wine cooler', 'Cava de vinos'),
  ('Bar a Bordo', 'Onboard bar', 'Bar a bordo'),
  ('Smart TV', 'Smart TV', 'Smart TV'),
  ('Tomadas 110V/220V', 'Power outlets (110V/220V)', 'Enchufes (110V/220V)'),
  ('Gerador de Energia', 'Power generator', 'Generador eléctrico'),
  ('Ventiladores', 'Fans', 'Ventiladores'),
  ('Flybridge', 'Flybridge', 'Flybridge'),
  ('Salão Interno', 'Indoor lounge', 'Salón interior'),
  ('Rede de Proa (Trampolim)', 'Bow trampoline net', 'Red de proa (trampolín)'),
  ('Dessalinizador', 'Watermaker', 'Desalinizador'),
  ('Estabilizador Antibalanço', 'Anti-roll stabilizer', 'Estabilizador antibalanceo'),
  ('Roupa de Cama', 'Bed linen', 'Ropa de cama')
ON CONFLICT (nome) DO UPDATE
  SET nome_en = COALESCE(public.comodidade.nome_en, EXCLUDED.nome_en),
      nome_es = COALESCE(public.comodidade.nome_es, EXCLUDED.nome_es);

-- ------------------------------------------------------------
-- 3) Duplicados e itens fora de categoria: copia os vínculos das embarcações para o item de
--    destino (sem duplicar vínculo que já exista) e exclui o item de origem.
--    Destino inexistente aborta a migration inteira — nunca exclui sem ter para onde mover.
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
  vinculo constant jsonb := '{
    "comodidade":             ["embarcacao_comodidades",            "comodidade_id"],
    "acessorios":             ["embarcacao_acessorios",             "acessorio_id"],
    "equipamentos_seguranca": ["embarcacao_equipamentos_seguranca", "equipamento_seguranca_id"]
  }';
  origem_id uuid;
  destino_id uuid;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- comodidades → acessórios (lazer/brinquedos aquáticos e itens móveis)
    ('comodidade', 'Boia',                    'acessorios', 'Boia Inflável'),
    ('comodidade', 'Bote de Apoio',           'acessorios', 'Bote de Apoio (Tender)'),
    ('comodidade', 'Cadeira de Praia',        'acessorios', 'Cadeira de Praia'),
    ('comodidade', 'Caiaque',                 'acessorios', 'Caiaque'),
    ('comodidade', 'Equipamento de Mergulho', 'acessorios', 'Equipamento de Mergulho'),
    ('comodidade', 'Macarrão flutuante',      'acessorios', 'Macarrão Flutuante'),
    ('comodidade', 'Máscara de mergulho',     'acessorios', 'Máscara de Mergulho'),
    ('comodidade', 'Pé de pato',              'acessorios', 'Nadadeiras (Pé de Pato)'),
    ('comodidade', 'Prancha de Stand Up',     'acessorios', 'Prancha de Stand Up Paddle'),
    ('comodidade', 'Tapete flutuante',        'acessorios', 'Tapete Flutuante'),
    ('comodidade', 'Wakeboard',               'acessorios', 'Wakeboard'),
    -- comodidades → segurança
    ('comodidade', 'GPS Náutico',             'equipamentos_seguranca', 'GPS Náutico'),
    ('comodidade', 'Salva-vidas completo',    'equipamentos_seguranca', 'Colete Salva-Vidas'),
    -- acessórios → comodidades (estrutura fixa, conforto e enxoval)
    ('acessorios', 'Churrasqueira',           'comodidade', 'Churrasqueira'),
    ('acessorios', 'Tenda de Sol / Toldo',    'comodidade', 'Toldo / Cobertura'),
    ('acessorios', 'Carregador USB',          'comodidade', 'Tomadas USB'),
    ('acessorios', 'Escada de Mergulho',      'comodidade', 'Escada de Banho'),
    ('acessorios', 'Iluminação Subaquática',  'comodidade', 'Iluminação Subaquática'),
    ('acessorios', 'Plataforma de Banho',     'comodidade', 'Plataforma de Banho'),
    ('acessorios', 'Toalhas',                 'comodidade', 'Toalhas')
  ) AS v(de_tabela, de_nome, para_tabela, para_nome)
  LOOP
    IF NOT (vinculo ? r.de_tabela AND vinculo ? r.para_tabela) THEN
      RAISE EXCEPTION 'Tabela desconhecida: % → %', r.de_tabela, r.para_tabela;
    END IF;

    -- Sem linha, EXECUTE … INTO atribui NULL: origem já tratada numa execução anterior.
    EXECUTE format('SELECT id FROM public.%I WHERE nome = $1', r.de_tabela) INTO origem_id USING r.de_nome;
    CONTINUE WHEN origem_id IS NULL;

    EXECUTE format('SELECT id FROM public.%I WHERE nome = $1', r.para_tabela) INTO destino_id USING r.para_nome;
    IF destino_id IS NULL THEN
      RAISE EXCEPTION 'Destino "%" não existe em %', r.para_nome, r.para_tabela;
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I (embarcacao_id, %I)
       SELECT l.embarcacao_id, $2 FROM public.%I l WHERE l.%I = $1
       ON CONFLICT DO NOTHING',
      vinculo -> r.para_tabela ->> 0, vinculo -> r.para_tabela ->> 1,
      vinculo -> r.de_tabela ->> 0, vinculo -> r.de_tabela ->> 1)
    USING origem_id, destino_id;

    -- ON DELETE CASCADE remove os vínculos antigos (já copiados acima).
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', r.de_tabela) USING origem_id;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4) Itens sem lugar no catálogo: "Prancha" (genérico — já há SUP, surf, bodyboard e wakeboard)
--    e "Mesa de Ping Pong" (fora do contexto náutico). Só exclui se nenhuma embarcação usar.
-- ------------------------------------------------------------
DELETE FROM public.comodidade c
 WHERE c.nome IN ('Prancha', 'Mesa de Ping Pong')
   AND NOT EXISTS (SELECT 1 FROM public.embarcacao_comodidades ec WHERE ec.comodidade_id = c.id);

COMMIT;
