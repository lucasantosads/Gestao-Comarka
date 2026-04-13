-- Step 1: Add columns
ALTER TABLE clientes_receita ADD COLUMN IF NOT EXISTS fidelidade_meses integer;
ALTER TABLE clientes_receita ADD COLUMN IF NOT EXISTS fidelidade_inicio date;
ALTER TABLE clientes_receita ADD COLUMN IF NOT EXISTS fidelidade_fim date;

-- Step 2: Update clients with FULL fidelidade data
UPDATE clientes_receita SET fidelidade_meses = 12, fidelidade_inicio = '2026-01-30', fidelidade_fim = '2027-01-30' WHERE id = '8d207a78-9f60-4303-b6df-475b25ce6e1d'; -- DARCI ECCEL
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-02-25', fidelidade_fim = '2026-05-25' WHERE id = 'a6d45039-f967-4638-a9f7-fab4de6e9f7e'; -- ROSANA E IVO
UPDATE clientes_receita SET fidelidade_meses = 6, fidelidade_inicio = '2025-10-10', fidelidade_fim = '2026-04-10' WHERE id = '02379ed6-bf2f-4b83-98e6-40c3f3aa95aa'; -- CIRILLO ADVOCACIA
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-02-05', fidelidade_fim = '2026-05-05' WHERE id = '30912f20-a076-4801-b0bc-79eb86417f7f'; -- FG TREINAMENTOS / EMILY
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-02-25', fidelidade_fim = '2026-05-25' WHERE id = '511e050f-c3f5-49b4-8944-f8d6a54ebf68'; -- RODRIGO MELO
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-01-30', fidelidade_fim = '2026-04-30' WHERE id = 'f31f59ce-3cf7-41c2-bf9a-4396f270322e'; -- ARTHUR
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-02-25', fidelidade_fim = '2026-05-25' WHERE id = 'ffc3cd67-c602-460e-b1b8-b8c72eb7c8eb'; -- FABIO SANTOS
UPDATE clientes_receita SET fidelidade_meses = 12, fidelidade_inicio = '2026-01-20', fidelidade_fim = '2027-01-20' WHERE id = 'b513fd0c-7f02-4b04-b4a0-94339cdba5ef'; -- GABRIEL E LUANA - TELES
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-01-28', fidelidade_fim = '2026-04-28' WHERE id = '5150760e-ac9d-40be-a98e-a286171cc282'; -- RIBEIRO COSTA
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-01-19', fidelidade_fim = '2026-04-19' WHERE id = '8a750ce0-eb20-4c73-a5b3-116a7096ef30'; -- RENATO TORRES
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-01-20', fidelidade_fim = '2026-04-20' WHERE id = 'e479e3e6-626d-4569-91b7-9a7fcc5defe4'; -- JHULLIANE
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-01-05', fidelidade_fim = '2026-04-05' WHERE id = 'cf16ee9d-065c-45be-8535-4f92705afe8b'; -- JAINE - OLIVEIRA E PERES
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-02-25', fidelidade_fim = '2026-05-25' WHERE id = '3cfb8e0c-ed93-4957-b4c7-8e35e8b0cd4a'; -- MICHELLE - ALMEIDA E CORREA
UPDATE clientes_receita SET fidelidade_meses = 6, fidelidade_inicio = '2026-01-05', fidelidade_fim = '2026-07-05' WHERE id = 'da550cbc-cfcd-4915-bee8-046401bb6186'; -- RITA DE CASSIA ALMEIDA
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-03-27', fidelidade_fim = '2026-06-27' WHERE id = '10ac417d-9190-47d3-b2ff-95eaf6e05a49'; -- RODIVAN BORGES
UPDATE clientes_receita SET fidelidade_meses = 3, fidelidade_inicio = '2026-03-06', fidelidade_fim = '2026-06-06' WHERE id = '1a9a605f-16ed-43be-8c94-d2f034856c22'; -- RUTE E EVERTON
UPDATE clientes_receita SET fidelidade_meses = 6, fidelidade_inicio = '2025-11-12', fidelidade_fim = '2026-05-12' WHERE id = '2a4dfed2-97af-48f3-9330-0bf4b90936a5'; -- JOMATTA SANTOS

-- Step 3: Update clients with ONLY meses (no dates)
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = 'f0833885-4eb4-43e6-bd87-d4c8471062a4'; -- MACHADO E COSTA
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = 'ec1b6a38-5c58-4b04-9063-48a4dd4d7bf4'; -- CAMILA FERNANDES
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = '91fe90d1-9c8e-4cfc-a638-b25fefbc1bf3'; -- VIANA E BRAVIN
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = 'b4a374b8-53b4-4049-ab45-62fbfafb0cb0'; -- RICARDO TRANCOSO
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = '6d342487-c987-425e-99cf-e98fd6df5009'; -- TEM DIREITO/MARTINS
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = '032a5b93-5160-41c5-8b13-b737d7d02cbe'; -- LARISSA CARVALHO SANTANA
UPDATE clientes_receita SET fidelidade_meses = 3 WHERE id = 'a51f8738-9bcd-4026-a011-ea25e9cf339a'; -- FERNANDO MIGUEL
