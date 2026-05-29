"""
Configuração centralizada — lê todas as env vars em um único lugar.
Qualquer módulo importa `from api.config import settings`.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str                       # service_role para backend

    # Groq
    groq_api_key: str
    groq_model: str = "llama-3.1-8b-instant"
    groq_max_tokens: int = 1024
    groq_temperature: float = 0.3

    # Redis (Upstash) — opcional
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    cache_ttl_seconds: int = 86_400        # 24 h

    # CORS — separar por vírgula, ex: "https://app.com,https://www.app.com"
    cors_origins: str = "*"

    # App
    app_name: str = "Motor Analítico Eleitoral"
    app_version: str = "2.0.0"
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"                   # ignora VITE_* e outras vars do frontend


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
