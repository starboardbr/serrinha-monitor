# Serrinha Monitor — painel estático

Painel HTML/CSS/JavaScript, sem compilação, para GitHub Pages com login Supabase.

## O que exibe
- Umidade, temperatura, ponto de orvalho estimado, intensidade Wi-Fi, última leitura e status online (últimos 15 minutos).
- Mínima, máxima e média de temperatura e umidade do dia, mês e de todo o histórico recebido (recordes), com horário dos extremos.
- Gráfico 24 h, 7 dias e 30 dias, e tabela dos últimos 14 dias.
- Percentual aproximado do tempo *observado* com umidade acima de 60% e 70% nas últimas 24 h (somente intervalos até 10 minutos).
- Disponibilidade aproximada das leituras nas últimas 24 h, assumindo envio a cada 5 minutos.

## Configuração do Supabase
1. A tabela `public.sensor_readings` já existe no seu projeto.
2. Abra **Authentication > Users** no painel do Supabase e crie/convide seu próprio usuário com e-mail e senha. Copie o **User UID**.
3. Em **SQL Editor**, execute `seguranca.sql` depois de substituir `O-UUID-DO-SEU-USUARIO` pelo UID real (mantenha aspas e `::uuid`). Se houver política SELECT pública antiga, exclua-a. Confira em **Database > Policies**.
4. Em **Project Settings > API** (ou **Connect > Project API** conforme versão do painel), copie a **Project URL** e a chave **publishable/anon**. Coloque ambas no arquivo `config.js`.
5. Não coloque `service_role`, `SENSOR_API_KEY`, senha do Wi-Fi ou tokens administrativos em arquivos públicos. Esses devem permanecer no ESP32/Edge Function conforme necessário.
6. Acesse o site, entre com sua conta e consulte as leituras do dispositivo `cozinha-01`.

## Publicação no GitHub Pages
1. Crie um repositório GitHub, preferencialmente chamado `serrinha-monitor`.
2. Envie `index.html`, `style.css`, `app.js` e `config.js` para a raiz do repositório. `README.md` é opcional.
3. Em **Settings > Pages**, escolha **Deploy from a branch**, selecione `main` e diretório `/ (root)`.
4. Aguarde a publicação e abra `https://SEU-USUARIO.github.io/serrinha-monitor/`.
5. Faça login com o usuário criado no Supabase Auth.

> GitHub Pages publica arquivos do repositório. A chave anon/publishable é própria para cliente web, desde que o RLS esteja correto. Nunca publique uma chave administrativa ou uma chave secreta de ingestão. Um repositório privado não torna um site Pages necessariamente privado.

## Notas técnicas
- Fuso para métricas diárias/mensais: `America/Sao_Paulo` em `config.js`.
- Os recordes não são inventados: consideram exclusivamente as leituras disponíveis. Antes de haver histórico suficiente, algumas estatísticas ficam incompletas.
- Paginação por `id` em blocos de 1.000 registros. Até 100.000 leituras por atualização (~347 dias a uma leitura/5 min); acima disso a interface avisa que os recordes são parciais. Para períodos plurianuais, recomendamos RPCs de agregação no banco.
- Para ausência de dados, não se estimam valores desconhecidos. A estatística de exposição à umidade considera somente pares de leituras consecutivas separados por até 10 minutos. A disponibilidade é uma aproximação baseada em 288 leituras esperadas por dia.
- O ponto de orvalho usa a fórmula de Magnus e **não** prova condensação sem medir a temperatura da superfície.
- Os gráficos agregam visualmente os registros em blocos para preservar responsividade. Dados ausentes não devem ser interpretados como condições normais.
- A autenticação usa Supabase Auth e RLS. O ESP32 envia leituras pela Edge Function existente sem mudanças.
- Dependências externas: `supabase-js` e `Chart.js` via CDN. Conexão à internet necessária para carregá-las.
