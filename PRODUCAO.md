# Vercel Deployment & Configuração SETPOLITIC v1.0

A arquitetura do MVP da SETPOLITIC usa um híbrido entre **Static Frontend (React/Vite)** e **Serverless Python (FastAPI/Mangum)** servido através do Vercel. Abaixo está a relação da Infraestrutura Externa e das Variáveis de Ambiente requeridas para deploy.

## ✨ Serviços Utilizados
- **MotherDuck (DuckDB):** Para consultas analíticas de ultra-performance (Zero-IA SQL).
- **Gemini (Google GenAI):** Para Vectorization (Embedding) e Prompt SQL Injection / Formatação no Componente de Chat (/chat).
- **Supabase (PostgreSQL + pgvector):** Armazena o mapeamento híbrido (Tabela `conhecimento_ia`) de metadados das mais de 1200 tabelas do MotherDuck.
- **Upstash (Redis REST):** Cache em memória focado na redução de custo do Gemini, salvando via hash a resposta se a pergunta do Chat for repetida.

## 🔐 Variáveis de Ambiente Obrigatórias (Vercel)
No painel do projeto Vercel (aba *Settings > Environment Variables*), adicione rigorosamente as chaves abaixo:

```env
# Banco Analítico
MOTHERDUCK_TOKEN="md_tok_XXXXXX"

# LLM & Text-to-SQL
GEMINI_API_KEY="AIzaXXXXXX"

# Busca Semântica (Vector Search)
SUPABASE_URL="https://XXXXXX.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5c... (anon key or service role)"

# Cache Inteligência (Zero-Custo)
UPSTASH_REDIS_REST_URL="https://XXXXXX.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AZXXXXXX"
```

## 🚀 Final Seeding (Pós-Deploy)
Para iniciar a inteligência de busca rápida do Chat, garantindo o reconhecimento da biblioteca analítica do usuário:

1. Instale dependências localmente: `cd api && pip install -r requirements.txt`
2. Exporte as `ENV VARS` local.
3. Rode `python final_seeding.py`. Ele irá iterar sobre as abas do MotherDuck, gerar os embeddings visando similaridade de campos e aplicar `UPSERT` sobre a tabela `conhecimento_ia` no Supabase.

---
_SETPOLITIC - Confidencial 2026_
