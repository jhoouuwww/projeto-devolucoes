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

    user_data = {
        "email": "b_espindula@makita.com.br",
        "protheus": "22371",
        "codigoProtheus": "22371",
        "nome": "BRUNO DA FONSECA ESPINDULA",
        "nomeExibicao": "Bruno Espindula",
        "cargo": "Promotor Técnico",
        "filial": "01 - Matriz",
        "isAdmin": False,
        "role": "usuario",
        "ativo": True
    }

    # Adiciona com ID por email e por codigo protheus
    db.collection("usuarios_protheus").document("b_espindula@makita.com.br").set(user_data, merge=True)
    db.collection("usuarios_protheus").document("b_espindula").set(user_data, merge=True)
    db.collection("usuarios_protheus").document("22371").set(user_data, merge=True)

    print("✅ Usuário b_espindula@makita.com.br (22371) adicionado com sucesso na coleção 'usuarios_protheus' do Firestore!")

if __name__ == "__main__":
    main()
