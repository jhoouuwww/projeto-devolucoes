#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys, json
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

def main():
    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("=== BUSCA PROFUNDA EM TODAS AS COLEÇÕES DO FIRESTORE ===")
    collections = list(db.collections())
    print(f"Coleções existentes no banco: {[c.id for c in collections]}\n")

    for col in collections:
        docs = list(col.limit(1000).stream())
        matches = []
        for d in docs:
            if d.id.startswith("nfe_"):
                continue # Pula os mocks que inserimos
            data_str = json.dumps(d.to_dict(), default=str).lower()
            if "22371" in data_str or "espindula" in data_str or "b_espindula" in data_str:
                matches.append((d.id, d.to_dict()))

        if matches:
            print(f"📁 Coleção '{col.id}': {len(matches)} documentos reais encontrados para b_espindula:")
            for doc_id, data in matches[:5]:
                print(f"  ID: {doc_id} => {data}")
        else:
            print(f"📁 Coleção '{col.id}': Nenhum documento pré-existente encontrado para b_espindula.")

if __name__ == "__main__":
    main()
