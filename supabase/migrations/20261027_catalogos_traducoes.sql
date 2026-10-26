-- ============================================================
-- Nomes em inglês e espanhol dos catálogos (26/10/2026) — SPEC §94.12.
--
-- Tipos de embarcação, comodidades, acessórios e equipamentos de segurança passam a ter
-- `nome_en` e `nome_es`. `nome` segue sendo o pt-BR (chave de exibição no painel/admin,
-- unicidade e URLs); o site traduz pelo `nome`, caindo no pt-BR quando a tradução é NULL.
--
-- Colunas novas em tabelas existentes: não precisam de GRANT. As traduções dos itens que já
-- existem entram aqui; itens criados depois ficam sem tradução até o admin preencher
-- (Cadastros Auxiliares).
-- ============================================================

ALTER TABLE public.embarcacao_tipo ADD COLUMN IF NOT EXISTS nome_en text, ADD COLUMN IF NOT EXISTS nome_es text;
ALTER TABLE public.comodidade ADD COLUMN IF NOT EXISTS nome_en text, ADD COLUMN IF NOT EXISTS nome_es text;
ALTER TABLE public.acessorios ADD COLUMN IF NOT EXISTS nome_en text, ADD COLUMN IF NOT EXISTS nome_es text;
ALTER TABLE public.equipamentos_seguranca ADD COLUMN IF NOT EXISTS nome_en text, ADD COLUMN IF NOT EXISTS nome_es text;

UPDATE public.embarcacao_tipo t
   SET nome_en = COALESCE(t.nome_en, v.en), nome_es = COALESCE(t.nome_es, v.es)
  FROM (VALUES
  ('Bote', 'Small boat', 'Bote'),
  ('Catamarã', 'Catamaran', 'Catamarán'),
  ('Iate', 'Yacht', 'Yate'),
  ('Lancha', 'Speedboat', 'Lancha'),
  ('Veleiro', 'Sailboat', 'Velero')
  ) AS v(nome, en, es)
 WHERE t.nome = v.nome;

UPDATE public.comodidade t
   SET nome_en = COALESCE(t.nome_en, v.en), nome_es = COALESCE(t.nome_es, v.es)
  FROM (VALUES
  ('Ar-Condicionado', 'Air conditioning', 'Aire acondicionado'),
  ('Banheira de Hidromassagem', 'Hot tub', 'Jacuzzi'),
  ('Banheiro a bordo', 'Onboard bathroom', 'Baño a bordo'),
  ('Boia', 'Float', 'Flotador'),
  ('Bote de Apoio', 'Tender', 'Bote de apoyo'),
  ('Cadeira de Praia', 'Beach chair', 'Silla de playa'),
  ('Caiaque', 'Kayak', 'Kayak'),
  ('Churrasqueira', 'Barbecue grill', 'Parrilla'),
  ('Cozinha Completa', 'Full kitchen', 'Cocina completa'),
  ('Deck para Sol', 'Sundeck', 'Cubierta para tomar sol'),
  ('Equipamento de Mergulho', 'Diving gear', 'Equipo de buceo'),
  ('Frigobar', 'Minibar', 'Frigobar'),
  ('Geladeira', 'Refrigerator', 'Refrigerador'),
  ('GPS Náutico', 'Marine GPS', 'GPS náutico'),
  ('Internet WiFi', 'Wi-Fi internet', 'Internet Wi-Fi'),
  ('Macarrão flutuante', 'Pool noodle', 'Fideo flotante'),
  ('Máquina de Café', 'Coffee machine', 'Cafetera'),
  ('Máscara de mergulho', 'Diving mask', 'Máscara de buceo'),
  ('Mesa de Jantar', 'Dining table', 'Mesa de comedor'),
  ('Mesa de Ping Pong', 'Ping pong table', 'Mesa de ping pong'),
  ('Micro-ondas', 'Microwave', 'Microondas'),
  ('Pé de pato', 'Fins', 'Aletas'),
  ('Prancha', 'Board', 'Tabla'),
  ('Prancha de Stand Up', 'Stand-up paddleboard', 'Tabla de stand up paddle'),
  ('Salva-vidas completo', 'Full life jacket set', 'Juego completo de chalecos salvavidas'),
  ('Som Ambiente', 'Sound system', 'Equipo de sonido'),
  ('Tapete flutuante', 'Floating mat', 'Alfombra flotante'),
  ('Toldo/Cobertura', 'Awning / canopy', 'Toldo / cobertura'),
  ('TV com Satélite', 'Satellite TV', 'TV satelital'),
  ('Wakeboard', 'Wakeboard', 'Wakeboard')
  ) AS v(nome, en, es)
 WHERE t.nome = v.nome;

UPDATE public.acessorios t
   SET nome_en = COALESCE(t.nome_en, v.en), nome_es = COALESCE(t.nome_es, v.es)
  FROM (VALUES
  ('Banana Boat', 'Banana boat', 'Banana boat'),
  ('Boia Rebocável', 'Towable tube', 'Flotador remolcable'),
  ('Caiaque', 'Kayak', 'Kayak'),
  ('Caixa de Som Bluetooth', 'Bluetooth speaker', 'Parlante Bluetooth'),
  ('Carregador USB', 'USB charger', 'Cargador USB'),
  ('Churrasqueira', 'Barbecue grill', 'Parrilla'),
  ('Cooler / Caixa Térmica', 'Cooler', 'Hielera / caja térmica'),
  ('Equipamento de Mergulho', 'Diving gear', 'Equipo de buceo'),
  ('Escada de Mergulho', 'Boarding ladder', 'Escalera de baño'),
  ('Esqui Aquático', 'Water skis', 'Esquí acuático'),
  ('Iluminação Subaquática', 'Underwater lighting', 'Iluminación subacuática'),
  ('Kit de Snorkel', 'Snorkel kit', 'Kit de snorkel'),
  ('Plataforma de Banho', 'Swim platform', 'Plataforma de baño'),
  ('Prancha de Stand Up Paddle', 'Stand-up paddleboard', 'Tabla de stand up paddle'),
  ('Prancha de Surf', 'Surfboard', 'Tabla de surf'),
  ('Rede de Descanso', 'Hammock', 'Hamaca'),
  ('Tenda de Sol / Toldo', 'Sun shade / awning', 'Toldo / sombrilla'),
  ('Toalhas', 'Towels', 'Toallas'),
  ('Vara de Pesca', 'Fishing rod', 'Caña de pescar'),
  ('Wakeboard', 'Wakeboard', 'Wakeboard')
  ) AS v(nome, en, es)
 WHERE t.nome = v.nome;

UPDATE public.equipamentos_seguranca t
   SET nome_en = COALESCE(t.nome_en, v.en), nome_es = COALESCE(t.nome_es, v.es)
  FROM (VALUES
  ('Âncora e Corrente', 'Anchor and chain', 'Ancla y cadena'),
  ('Apito de Neblina', 'Fog horn', 'Silbato de niebla'),
  ('Boia Circular', 'Life ring', 'Aro salvavidas'),
  ('Bomba de Porão', 'Bilge pump', 'Bomba de achique'),
  ('Bote Salva-Vidas', 'Life raft', 'Balsa salvavidas'),
  ('Cabo de Reboque', 'Tow line', 'Cabo de remolque'),
  ('Cinto de Segurança Náutico', 'Marine safety harness', 'Arnés de seguridad náutico'),
  ('Colete Salva-Vidas', 'Life jacket', 'Chaleco salvavidas'),
  ('Compasso', 'Compass', 'Compás'),
  ('Detector de Monóxido de Carbono', 'Carbon monoxide detector', 'Detector de monóxido de carbono'),
  ('EPIRB (Radiobaliza)', 'EPIRB (emergency beacon)', 'EPIRB (radiobaliza)'),
  ('Espelho de Sinalização', 'Signaling mirror', 'Espejo de señalización'),
  ('Extintor de Incêndio', 'Fire extinguisher', 'Extintor de incendios'),
  ('GPS', 'GPS', 'GPS'),
  ('Kit de Primeiros Socorros', 'First aid kit', 'Botiquín de primeros auxilios'),
  ('Lanterna Estanque', 'Waterproof flashlight', 'Linterna estanca'),
  ('Mapa Náutico', 'Nautical chart', 'Carta náutica'),
  ('Rádio VHF', 'VHF radio', 'Radio VHF'),
  ('Sinalizador de Fumaça', 'Smoke signal', 'Señal de humo'),
  ('Sinalizador Luminoso', 'Flare', 'Bengala luminosa')
  ) AS v(nome, en, es)
 WHERE t.nome = v.nome;
