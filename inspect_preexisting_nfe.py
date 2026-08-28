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

    preexisting = [d for d in all_docs if not d.id.startswith("nfe_")]
    print(f"Total de documentos pré-existentes (que NÃO começam com 'nfe_'): {len(preexisting)}")

    for d in preexisting[:20]:
        print(f"\nDoc ID: {d.id}")
        data = d.to_dict()
        for k, v in data.items():
            print(f"  {k}: {v}")

if __name__ == "__main__":
    main()
