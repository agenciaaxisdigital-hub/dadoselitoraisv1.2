import os
import json
import logging
import argparse
import time
import google.generativeai as genai
import duckdb
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed-supabase")

def main():
    parser = argparse.ArgumentParser(description="Populate Supabase pgvector with MotherDuck schemas.")
    parser.parse_args()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    md_token = os.getenv("MOTHERDUCK_TOKEN")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if not all([supabase_url, supabase_key, md_token, gemini_key]):
        logger.error("Missing environment variables. Make sure SUPABASE_URL, SUPABASE_KEY, MOTHERDUCK_TOKEN, and GEMINI_API_KEY are set.")
        return

    # Init clients
    genai.configure(api_key=gemini_key)
    supabase: Client = create_client(supabase_url, supabase_key)
    conn = duckdb.connect(f"md:?motherduck_token={md_token}")

    try:
        # Get all tables from MotherDuck
        all_tables = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main'").fetchall()
        
        # Filtro rígido: Apenas arquivos do Estado de Goiás (_GO) ou Federais (_BRASIL)
        tables = [t for t in all_tables if t[0].endswith("_GO") or "_BRASIL" in t[0]]
        
        logger.info(f"Filtered {len(tables)} target tables (out of {len(all_tables)} total). Starting vectorization process...")

        records = []
        for (table_name,) in tables:
            # Extract basic schema for context
            cols = conn.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='{table_name}'").fetchall()
            schema_str = f"Table: {table_name}\nColumns:\n"
            for col_name, data_type in cols:
                schema_str += f"- {col_name} ({data_type})\n"

            # Generate Embeddings using Gemini Model
            res = genai.embed_content(
                model="models/gemini-embedding-001",
                content=schema_str,
                task_type="retrieval_document"
            )
            embedding = res["embedding"]

            records.append({
                "conteudo": f"Mapeamento do esquema da tabela {table_name}",
                "esquema": schema_str,
                "embedding": embedding,
                "modulo": "ELEICOES_2024" if "2024" in table_name else "GERAL"
            })

            logger.info(f"Generated Vector for table: {table_name}")
            
            # Pausa para evitar RPM/RPM Limit (Erro 429) no modelo gratuito
            time.sleep(2)

        if records:
            response = supabase.table("documentos_ia").upsert(records).execute()
            logger.info(f"Upserted {len(response.data)} records to Supabase.")

    except Exception as e:
        logger.error(f"Error during seeding: {e}")
    finally:
        conn.close()
        logger.info("Connection closed. Seeding pipeline finished.")

if __name__ == "__main__":
    main()
