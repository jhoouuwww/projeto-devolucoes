#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

def main():
    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("=================================================================")
    print(" INSPEÇÃO DE 'usuarios_protheus' NO FIRESTORE")
    print("=================================================================")
    users = list(db.collection("usuarios_protheus").stream())
    print(f"Total de documentos em usuarios_protheus: {len(users)}")
    for u in users:
        print(f"  Doc ID: {u.id} => {u.to_dict()}")

if __name__ == "__main__":
    main()
