"""
Chat Service — Groq + Data Injection
--------------------------------------
Arquitetura zero-custo para escala:

  1. Cache Redis (hit → <5ms, custo zero)
  2. Intent Detection Python (regex, custo zero)
  3. Query Supabase mv_* (dados reais, custo zero)
  4. Groq API Llama 3 — free tier: 500k tokens/dia
     → injeta dados como contexto no prompt
     → responde como assistente eleitoral especialista
  5. Cache 24h

Groq free tier: llama-3.1-8b-instant, 500k tokens/dia, 30 RPM
Sem limite de usuários simultâneos para este volume.
"""

import os
import re
import json
import logging
import hashlib
import unicodedata
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from upstash_redis import Redis
from groq import Groq

logger = logging.getLogger("chat-service")


# ─────────────────────────────────────────────
# Modelos
# ─────────────────────────────────────────────

class MensagemHistorico(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    pergunta: str
    ano: int = 2024
    municipio: Optional[str] = None
    historico: list[MensagemHistorico] = []

class ChatResponse(BaseModel):
    resposta: str
    sql_gerado: Optional[str] = None
    cache: bool = False
    intent: Optional[str] = None


# ─────────────────────────────────────────────
# Conexões (lazy singletons)
# ─────────────────────────────────────────────

_supabase: Optional[Client] = None
_redis: Optional[Redis] = None
_groq: Optional[Groq] = None

def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _supabase

def _get_redis() -> Optional[Redis]:
    global _redis
    if _redis is None:
        url   = os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
        if url and token:
            _redis = Redis(url=url, token=token)
    return _redis

def _get_groq() -> Groq:
    global _groq
    if _groq is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY não configurado. Obtenha gratuitamente em https://console.groq.com")
        _groq = Groq(api_key=api_key)
    return _groq


# ─────────────────────────────────────────────
# Cache Redis
# ─────────────────────────────────────────────

_TTL = 86400  # 24h

def _cache_key(pergunta: str, ano: int, municipio: str) -> str:
    raw = f"{pergunta.strip().lower()}|{ano}|{municipio.lower()}"
    return f"chat3:{hashlib.sha256(raw.encode()).hexdigest()[:24]}"

def _cache_get(key: str) -> Optional[str]:
    redis = _get_redis()
    if not redis:
        return None
    try:
        return redis.get(key)
    except Exception:
        return None

def _cache_set(key: str, value: str) -> None:
    redis = _get_redis()
    if not redis:
        return
    try:
        redis.set(key, value, ex=_TTL)
    except Exception as e:
        logger.warning("Redis set error: %s", e)


# ─────────────────────────────────────────────
# Intent Detection — identifica quais dados buscar
# ─────────────────────────────────────────────

_INTENTS = [
    ("RANKING",       r"mais votado|ranking|votos|venceu|eleito|candidato|partido|cargo|prefeito|vereador|primeiro|segundo|placar|ganhou"),
    ("FINANCIAMENTO", r"gast|arrecad|receita|doaç|doaçã|patrimônio|patrimoni|dinheiro|financi|rico|custo por voto|quanto recebeu|quanto gastou"),
    ("ELEITORADO",    r"eleitor|perfil|gênero|genero|faixa etária|faixa etaria|escolaridade|estado civil|quantos eleitores|mulheres|homens|jovens|idosos"),
    ("ESCOLAS",       r"escola|local de votação|local de votacao|seção|secao|onde votar|urna|colégio"),
    ("ZONAS",         r"zona|comparecimento|abstenção|abstencao|taxa de comparecimento|turno|votaram|não votaram"),
    ("SUPLENTES",     r"suplente|assumiu|vagas|vice|segundo colocado|não eleito"),
]

def _detect_intents(pergunta: str) -> list[str]:
    """Retorna lista de intents (pode ter mais de um)."""
    p = _normalize(pergunta)
    found = [intent for intent, pattern in _INTENTS if re.search(pattern, p)]
    return found or ["GERAL"]

def _normalize(text: str) -> str:
    """Remove acentos e converte para minúsculas — para busca tolerante a digitação."""
    return unicodedata.normalize("NFD", text.lower()).encode("ascii", "ignore").decode()


# ─────────────────────────────────────────────
# Busca de dados Supabase mv_* por intent
# ─────────────────────────────────────────────

def _municipio_filter(municipio: str) -> str:
    """Retorna o nome do município sem acentos, em UPPER — para busca tolerante.
    Ex: 'APARECIDA DE GOIÂNIA' → 'APARECIDA DE GOIANIA'
    Ex: 'GOIÂNIA' → 'GOIANIA'"""
    nfkd = unicodedata.normalize("NFD", municipio.upper())
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def _accent_wildcard(text: str) -> str:
    """Troca vogais que podem ter acento por _ (wildcard do PostgreSQL ilike).
    Ex: GOIANIA → GOI_NI_, APARECIDA → AP_R_CID_
    Assim 'GOI_NI_' bate com 'GOIÂNIA', 'GOIÃNIA', etc."""
    # Vogais que comumente têm acento em português
    _ACCENT_CHARS = set("AEIOUÇ")
    return "".join("_" if c in _ACCENT_CHARS else c for c in text.upper())


def _apply_municipio_filter(query, municipio: str):
    """Filtro de município tolerante a acentos via wildcard ilike.
    Remove acentos do input, depois troca vogais por _ para casar com qualquer variante acentuada no banco."""
    sem_acento = _municipio_filter(municipio.upper().strip())
    pattern = _accent_wildcard(sem_acento)
    return query.ilike("municipio_nome", f"%{pattern}%")


def _buscar_dados(intents: list[str], ano: int, municipio: str) -> dict[str, list[dict]]:
    """Busca dados relevantes nas tabelas mv_* do Supabase."""
    sb = _get_supabase()
    resultado: dict[str, list[dict]] = {}

    for intent in intents[:2]:  # máximo 2 intents por pergunta
        try:
            if intent == "RANKING":
                q = (
                    sb.table("mv_candidatos")
                    .select("nm_urna,sg_partido,ds_cargo,municipio_nome,total_votos,ds_situacao,nr_candidato")
                    .eq("ano", ano)
                )
                q = _apply_municipio_filter(q, municipio)
                resp = q.order("total_votos", desc=True).limit(15).execute()
                resultado["candidatos"] = resp.data

            elif intent == "FINANCIAMENTO":
                q = (
                    sb.table("mv_candidatos")
                    .select("sq_candidato,nm_urna,sg_partido,ds_cargo,municipio_nome,total_votos,patrimonio_total")
                    .eq("ano", ano)
                )
                q = _apply_municipio_filter(q, municipio)
                cands = q.order("patrimonio_total", desc=True).limit(20).execute().data

                if cands:
                    sqs = [c["sq_candidato"] for c in cands[:20]]
                    fin = (
                        sb.table("mv_financeiro")
                        .select("sq_candidato,total_receitas,total_despesas")
                        .eq("ano", ano)
                        .in_("sq_candidato", sqs)
                        .execute()
                    ).data
                    fin_map = {f["sq_candidato"]: f for f in fin}
                    for c in cands:
                        f = fin_map.get(c["sq_candidato"], {})
                        c["total_receitas"] = f.get("total_receitas", 0)
                        if c["total_votos"] and c["total_votos"] > 0 and c.get("total_receitas"):
                            c["custo_por_voto"] = round(float(c["total_receitas"]) / c["total_votos"], 2)
                resultado["financiamento"] = cands

            elif intent == "ELEITORADO":
                q = (
                    sb.table("mv_eleitorado")
                    .select("tipo,categoria,total")
                    .eq("ano", ano)
                )
                q = _apply_municipio_filter(q, municipio)
                resultado["eleitorado"] = q.execute().data

            elif intent == "ESCOLAS":
                q = (
                    sb.table("mv_escolas")
                    .select("nm_local,nm_bairro,nr_zona,total_secoes,total_eleitores")
                    .eq("ano", ano)
                )
                q = _apply_municipio_filter(q, municipio)
                resultado["escolas"] = q.order("total_eleitores", desc=True).limit(20).execute().data

            elif intent == "ZONAS":
                q = (
                    sb.table("mv_comparecimento_zona")
                    .select("nr_zona,qt_apto,qt_compareceu,qt_abstencao,qt_brancos,qt_nulos")
                    .eq("ano", ano)
                )
                q = _apply_municipio_filter(q, municipio)
                resultado["zonas"] = q.execute().data

            elif intent == "SUPLENTES":
                q = (
                    sb.table("mv_candidatos")
                    .select("nm_urna,sg_partido,ds_cargo,total_votos,ds_situacao,nr_candidato")
                    .eq("ano", ano)
                    .ilike("ds_situacao", "%SUPLENTE%")
                )
                q = _apply_municipio_filter(q, municipio)
                resultado["suplentes"] = q.order("total_votos", desc=True).limit(20).execute().data

            elif intent == "GERAL":
                q = (
                    sb.table("mv_candidatos")
                    .select("nm_urna,sg_partido,ds_cargo,total_votos,ds_situacao")
                    .eq("ano", ano)
                )
                q = _apply_municipio_filter(q, municipio)
                resultado["candidatos"] = q.order("total_votos", desc=True).limit(10).execute().data

        except Exception as e:
            logger.warning("Erro ao buscar intent %s: %s", intent, e)

    return resultado


# ─────────────────────────────────────────────
# System Prompt (identidade do assistente)
# ─────────────────────────────────────────────

def _build_system_prompt(municipio: str, ano: int) -> str:
    return f"""Você é o Assistente SETPOLITIC Inteligência Eleitoral — especialista em dados eleitorais brasileiros.

CONTEXTO ATUAL:
- Município: {municipio}
- Eleição: {ano}

REGRAS OBRIGATÓRIAS:
1. Responda SEMPRE em português brasileiro
2. Chame "Mesários" de "Lideranças de campo"
3. Chame "Bairros" de "Setores"
4. Formate números em padrão BR: 1.234.567 (ponto como milhar)
5. Formate valores monetários: R$ 1.234,56
6. Use tabelas markdown para 4+ itens
7. Seja direto e preciso — estilo B2B premium
8. Quando tiver dados do banco, use-os como base da resposta
9. Se os dados não cobrirem a pergunta, diga claramente o que sabe e o que não sabe
10. NÃO invente dados. Use apenas o que foi fornecido no contexto."""


# ─────────────────────────────────────────────
# Chamada Groq
# ─────────────────────────────────────────────

_GROQ_MODEL = "llama-3.1-8b-instant"  # gratuito, 500k tokens/dia

def _chamar_groq(
    system_prompt: str,
    historico: list[MensagemHistorico],
    pergunta: str,
    dados: dict[str, list[dict]],
) -> str:
    groq = _get_groq()

    # Monta contexto com dados do banco
    context_parts = []
    for chave, registros in dados.items():
        if registros:
            context_parts.append(f"[DADOS: {chave.upper()}]\n{json.dumps(registros[:15], ensure_ascii=False, default=str)}")

    context_str = "\n\n".join(context_parts) if context_parts else "[DADOS: sem dados específicos encontrados para esta pergunta]"

    # Monta histórico de conversa (máximo 6 mensagens para economizar tokens)
    messages = [{"role": "system", "content": system_prompt}]

    for msg in historico[-6:]:
        messages.append({"role": msg.role, "content": msg.content})

    # Mensagem atual com dados injetados
    messages.append({
        "role": "user",
        "content": f"{context_str}\n\nPergunta: {pergunta}",
    })

    response = groq.chat.completions.create(
        model=_GROQ_MODEL,
        messages=messages,
        temperature=0.3,    # baixo = mais factual, menos criativo
        max_tokens=1024,
        top_p=0.9,
    )

    return response.choices[0].message.content.strip()


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

def processar_chat(req: ChatRequest) -> ChatResponse:
    municipio = (req.municipio or "APARECIDA DE GOIÂNIA").upper()

    # 1. Cache (só para perguntas sem histórico — perguntas repetidas)
    cache_key = None
    if not req.historico:
        cache_key = _cache_key(req.pergunta, req.ano, municipio)
        cached = _cache_get(cache_key)
        if cached:
            logger.info("Cache HIT")
            return ChatResponse(resposta=cached, cache=True)

    # 2. Intent detection
    intents = _detect_intents(req.pergunta)
    logger.info("Intents: %s | %.60s", intents, req.pergunta)

    # 3. Busca dados Supabase
    dados = _buscar_dados(intents, req.ano, municipio)

    # 4. Chama Groq com contexto
    try:
        system = _build_system_prompt(municipio, req.ano)
        resposta = _chamar_groq(system, req.historico, req.pergunta, dados)
    except Exception as e:
        logger.error("Groq error: %s", e, exc_info=True)
        if "GROQ_API_KEY" in str(e):
            raise HTTPException(
                status_code=503,
                detail="GROQ_API_KEY não configurada. Adicione no .env ou nas configurações da Vercel: obtenha em https://console.groq.com"
            )
        # Se estiver rodando na Vercel (produção), evita expor detalhes internos ao usuário final
        if os.getenv("VERCEL") or os.getenv("NODE_ENV") == "production":
            raise HTTPException(
                status_code=503,
                detail="Erro no serviço de IA. Por favor, tente novamente em instantes."
            )
        raise HTTPException(status_code=503, detail=f"Erro no serviço de IA: {e}")

    # 5. Cache (só perguntas sem histórico para evitar cache de contexto errado)
    if cache_key:
        _cache_set(cache_key, resposta)

    return ChatResponse(
        resposta=resposta,
        cache=False,
        intent=",".join(intents),
    )
