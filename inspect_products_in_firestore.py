#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

def main():
    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("=================================================================")
    print(" INSPEÇÃO DOS PRODUTOS DAS NFEs DO PROMOTOR 22371 NO FIRESTORE")
    print("=================================================================")
    docs = list(db.collection("promotores").document("22371").collection("nfe_disponiveis").stream())
    print(f"Total de documentos encontrados: {len(docs)}\n")
    for d in docs:
        data = d.to_dict()
        prod = data.get("codigoItem") or data.get("produto") or ""
        desc = data.get("descricao") or ""
        qtd = data.get("saldoDisponivel") or data.get("saldo") or data.get("quantidade") or 1
        print(f"PROD: {prod:<12} | QTD: {qtd} | DESC: {desc}")

if __name__ == "__main__":
    main()
