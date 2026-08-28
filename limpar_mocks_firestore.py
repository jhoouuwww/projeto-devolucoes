#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Limpeza de NFes Simuladas / Mocks no Firestore
=============================================
Remove os documentos de teste que começam com 'nfe_' no Firestore,
preservando 100% dos documentos reais gravados pelo processo da Makita.
"""

import os, sys
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

def main():
    if not os.path.exists(CHAVE):
        print(f"[ERRO] Chave de serviço não encontrada: {CHAVE}")
        sys.exit(1)

    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("=================================================================")
    print(" REMOVENDO DOCUMENTOS SIMULADOS ('nfe_...') DA COLEÇÃO RAIZ 'nfe_disponiveis'")
    print("=================================================================")

    docs_root = list(db.collection("nfe_disponiveis").limit(1000).stream())
    batch = db.batch()
    removed_count = 0

    for d in docs_root:
        if d.id.startswith("nfe_"):
            batch.delete(d.reference)
            removed_count += 1

    if removed_count > 0:
        batch.commit()
        print(f"✅ {removed_count} documentos simulados removidos da coleção raiz 'nfe_disponiveis'.")
    else:
        print("Nenhum documento simulado para remover.")

    print("\n=================================================================")
    print(" DOCUMENTOS REAIS REMANESCENTES EM 'nfe_disponiveis':")
    print("=================================================================")
    reais = list(db.collection("nfe_disponiveis").stream())
    print(f"Total de NFes reais no Firestore: {len(reais)}")
    for r in reais:
        print(f"  Doc [{r.id}]: {r.to_dict()}")

if __name__ == "__main__":
    main()
