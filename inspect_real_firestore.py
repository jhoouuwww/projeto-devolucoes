#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inspetor do Firestore Real
==========================
Lê as coleções do Firestore para mostrar a estrutura real existente no banco de dados.
"""

import os, sys, json
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
    print(" 1. DOCUMENTOS EM 'usuarios_protheus' (Amostra de 5)")
    print("=================================================================")
    docs_users = list(db.collection("usuarios_protheus").limit(5).stream())
    for d in docs_users:
        print(f"  Document ID: {d.id}")
        print(f"  Data: {json.dumps(d.to_dict(), default=str, ensure_ascii=False)}\n")

    print("=================================================================")
    print(" 2. DOCUMENTOS EM 'promotores' (Amostra)")
    print("=================================================================")
    promotores = list(db.collection("promotores").limit(5).stream())
    for p in promotores:
        print(f"  Promotor ID: {p.id}")
        subcols = list(p.reference.collections())
        for subcol in subcols:
            print(f"    Subcoleção: {subcol.id}")
            sub_docs = list(subcol.limit(3).stream())
            for sd in sub_docs:
                print(f"      Doc ID: {sd.id}")
                print(f"      Data: {json.dumps(sd.to_dict(), default=str, ensure_ascii=False)}")

    print("\n=================================================================")
    print(" 3. DOCUMENTOS EM 'nfe_disponiveis' (Coleção Raiz - Amostra de 5)")
    print("=================================================================")
    docs_nfe = list(db.collection("nfe_disponiveis").limit(5).stream())
    for d in docs_nfe:
        print(f"  Document ID: {d.id}")
        print(f"  Data: {json.dumps(d.to_dict(), default=str, ensure_ascii=False)}\n")

if __name__ == "__main__":
    main()
