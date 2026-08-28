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

    all_docs = list(db.collection("nfe_disponiveis").limit(1000).stream())

    espindula_matches = []
    for d in all_docs:
        data = d.to_dict()
        data_str = json.dumps(data, default=str).lower()
        if "22371" in data_str or "espindula" in data_str or "b_espindula" in data_str:
            espindula_matches.append((d.id, data))

    print(f"Encontrados {len(espindula_matches)} documentos reais para 22371 no Firestore!\n")
    print("Amostra das 5 primeiras NFes reais:")
    for doc_id, data in espindula_matches[:5]:
        print(f"\nDocument ID: {doc_id}")
        for k, v in data.items():
            print(f"  {k}: {v}")

if __name__ == "__main__":
    main()
