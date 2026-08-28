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
    print(" BUSCANDO NF-044311 ~ NF-044316 NO FIRESTORE EM TODAS AS COLEÇÕES")
    print("=================================================================")

    # 1. Coleção raiz nfe_disponiveis
    root_docs = list(db.collection("nfe_disponiveis").stream())
    print(f"Coleção raiz 'nfe_disponiveis': {len(root_docs)} documentos")
    found_root = []
    for d in root_docs:
        data = d.to_dict()
        nf = str(data.get("notaFiscal") or data.get("nfe") or "")
        ped = str(data.get("pedido") or "")
        if "0443" in nf or "9813" in ped or "0443" in d.id:
            found_root.append((d.id, data))
            print(f"  [Raiz nfe_disponiveis] Doc ID: {d.id} => NF: {nf}, PED: {ped}, CLIENTE: {data.get('cliente')}")

    # 2. Coleção promotores e todas as subcoleções
    promotores = list(db.collection("promotores").stream())
    print(f"\nColeção 'promotores': {len(promotores)} promotores cadastrados")
    found_sub = []
    for p in promotores:
        subdocs = list(db.collection("promotores").document(p.id).collection("nfe_disponiveis").stream())
        for sd in subdocs:
            data = sd.to_dict()
            nf = str(data.get("notaFiscal") or data.get("nfe") or "")
            ped = str(data.get("pedido") or "")
            if "0443" in nf or "9813" in ped or "0443" in sd.id:
                found_sub.append((p.id, sd.id, data))
                print(f"  [Subcoleção /promotores/{p.id}/nfe_disponiveis] Doc ID: {sd.id} => NF: {nf}, PED: {ped}, PROD: {data.get('codigoItem')}")

    print("\n-----------------------------------------------------------------")
    print(f"TOTAL ENCONTRADO DE NF-0443...: Raiz: {len(found_root)} | Subcoleções: {len(found_sub)}")
    print("-----------------------------------------------------------------")

if __name__ == "__main__":
    main()
