-- EXECUTE NO SQL EDITOR DO SUPABASE.
-- 1) Crie seu usuário em Authentication > Users (ou via fluxo de signup controlado).
-- 2) Substitua O-UUID-DO-SEU-USUARIO pelo ID do usuário autorizado (UUID).
-- 3) Não ative leitura anônima. A Edge Function de ingestão continua usando service role.

alter table public.sensor_readings enable row level security;

-- Somente o dono autenticado pode consultar as leituras pelo painel.
create policy "Dono pode ler sensores"
on public.sensor_readings
for select
to authenticated
using (auth.uid() = 'e90dd9e2-ff25-4c5b-83a0-d883bddc102a'::uuid);

-- Não crie políticas INSERT/UPDATE/DELETE para anon ou authenticated.
-- A ingestão atual deve ser realizada pela Edge Function autenticada com SENSOR_API_KEY,
-- usando a chave de service role apenas no ambiente da função.
