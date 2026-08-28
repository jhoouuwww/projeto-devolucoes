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
    print(" PURGANDO DOCUMENTOS MOCK/ARTIFICIAIS DE TODOS OS USUÁRIOS NO FIRESTORE")
    print("=================================================================")

    all_nfe_docs = list(db.collection_group("nfe_disponiveis").stream())
    print(f"Total de documentos em nfe_disponiveis: {len(all_nfe_docs)}")

    deleted_count = 0
    kept_count = 0

    batch = db.batch()
    batch_size = 0

    for doc in all_nfe_docs:
        data = doc.to_dict()
        path = doc.reference.path
        doc_id = doc.id

        # Verifica se o documento é artificial/mock (ex: nfe_XXXXX_YY ou pedido com PED-9813...)
        ped = str(data.get("pedido") or "")
        is_mock = False

        if doc_id.startswith("nfe_") and not doc_id.startswith("nfe_real_"):
            is_mock = True
        elif "PED-9813" in ped or "PED-9812" in ped or "NF-0441" in str(data.get("notaFiscal")) or "NF-0443" in str(data.get("notaFiscal")):
            is_mock = True

        if is_mock:
            print(f"❌ DELETANDO MOCK -> Path: {path} | Pedido: {ped} | Prod: {data.get('codigoItem')}")
            batch.delete(doc.reference)
            batch_size += 1
            deleted_count += 1

            if batch_size >= 400:
                batch.commit()
                batch = db.batch()
                batch_size = 0
        else:
            kept_count += 1
            print(f"✅ MANTIDO REAL -> Path: {path} | Prod: {data.get('codigoItem')}")

    if batch_size > 0:
        batch.commit()

    print("\n-----------------------------------------------------------------")
    print(f"RESUMO DA LIMPEZA: {deleted_count} documentos de mock removidos! {kept_count} mantidos.")
    print("-----------------------------------------------------------------")

if __name__ == "__main__":
    main()
