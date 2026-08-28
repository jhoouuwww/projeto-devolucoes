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
    print(" BUSCANDO TODOS OS DOCUMENTOS DE 'nfe_disponiveis' VIA COLLECTION GROUP")
    print("=================================================================")
    nfe_docs = list(db.collection_group("nfe_disponiveis").stream())
    print(f"Total de documentos nfe_disponiveis no Firestore: {len(nfe_docs)}\n")

    found_target = []
    for doc in nfe_docs:
        data = doc.to_dict()
        nf = str(data.get("notaFiscal") or data.get("nfe") or "")
        ped = str(data.get("pedido") or "")
        prod = str(data.get("codigoItem") or data.get("produto") or "")
        path = doc.reference.path

        if "0443" in nf or "9813" in ped or "0443" in doc.id or "9813" in doc.id:
            found_target.append((doc.id, path, data))
            print(f"MATCH -> Path: {path:<60} | NF: {nf:<10} | PED: {ped:<10} | PROD: {prod}")

    print("\n-----------------------------------------------------------------")
    print(f"Total de documentos encontrados com NF-0443... ou PED-9813...: {len(found_target)}")
    print("-----------------------------------------------------------------")

if __name__ == "__main__":
    main()
