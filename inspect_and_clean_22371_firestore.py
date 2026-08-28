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

    print("=================================================================")
    print(" INSPEÇÃO E LIMPEZA DE /promotores/22371/nfe_disponiveis NO FIRESTORE")
    print("=================================================================")

    subcol = db.collection("promotores").document("22371").collection("nfe_disponiveis")
    docs = list(subcol.stream())
    print(f"Total de documentos encontrados em /promotores/22371/nfe_disponiveis: {len(docs)}")

    artificial_docs = []
    real_docs = []

    for d in docs:
        if d.id.startswith("nfe_"):
            artificial_docs.append(d)
        else:
            real_docs.append(d)

    print(f"  - Documentos artificiais (nfe_22371_XX): {len(artificial_docs)}")
    print(f"  - Documentos reais (731184_..., etc): {len(real_docs)}")

    # Remove todos os documentos artificiais do Firestore
    if artificial_docs:
        print(f"\nRemovendo os {len(artificial_docs)} documentos artificiais do Firestore...")
        batch = db.batch()
        count = 0
        for d in artificial_docs:
            batch.delete(d.reference)
            count += 1
            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
        if count % 400 != 0:
            batch.commit()
        print(f"✅ {len(artificial_docs)} documentos artificiais deletados com sucesso do Firestore!")

    # Mostra a lista final de documentos reais mantidos em /promotores/22371/nfe_disponiveis
    docs_finais = list(subcol.stream())
    print(f"\n✅ RESTAM AGORA {len(docs_finais)} DOCUMENTOS REAIS EM /promotores/22371/nfe_disponiveis:")
    for d in docs_finais[:15]:
        print(f"  ID: {d.id} => {d.to_dict()}")

if __name__ == "__main__":
    main()
