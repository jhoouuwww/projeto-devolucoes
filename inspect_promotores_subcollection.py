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

    print("=== INSPEÇÃO DA SUBCOLEÇÃO /promotores/22371/nfe_disponiveis ===")

    doc_ref = db.collection("promotores").document("22371")
    doc_snap = doc_ref.get()
    print(f"Documento 'promotores/22371' existe? {doc_snap.exists}")

    subcol = doc_ref.collection("nfe_disponiveis")
    docs = list(subcol.stream())
    print(f"Total de documentos em /promotores/22371/nfe_disponiveis: {len(docs)}")

    for d in docs[:10]:
        print(f"\nDoc ID: {d.id}")
        data = d.to_dict()
        for k, v in data.items():
            print(f"  {k}: {v}")

    print("\n=== VERIFICANDO OUTROS PROMOTORES EM /promotores ===")
    prom_docs = list(db.collection("promotores").stream())
    print(f"Total de documentos raiz em 'promotores': {len(prom_docs)}")
    for p in prom_docs[:10]:
        print(f"  Promotor ID: {p.id}")

if __name__ == "__main__":
    main()
