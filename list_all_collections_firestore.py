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
    print(" LISTANDO TODAS AS COLEÇÕES DO FIRESTORE")
    print("=================================================================")
    collections = list(db.collections())
    print(f"Coleções encontradas ({len(collections)}):")
    for col in collections:
        print(f"  - {col.id}")

if __name__ == "__main__":
    main()
