#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

def main():
    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    all_nfe_docs = list(db.collection_group("nfe_disponiveis").stream())
    print(f"Total de documentos REAIS remanescentes no Firestore: {len(all_nfe_docs)}")

    promotores_count = {}
    for doc in all_nfe_docs:
        path_parts = doc.reference.path.split("/")
        promotor_id = path_parts[1]
        promotores_count[promotor_id] = promotores_count.get(promotor_id, 0) + 1

    print("\nContagem por Promotor:")
    for p, c in sorted(promotores_count.items()):
        print(f"  - Promotor/Documento {p}: {c} NFes reais")

if __name__ == "__main__":
    main()
