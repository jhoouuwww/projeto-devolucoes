#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed de NF-e Disponíveis — Cadastro em Lote no Firestore (Estrutura Oficial)
=============================================================================
Registra as Notas Fiscais com a estrutura exata solicitada:
  promotores >> {cód Protheus} >> nfe_disponiveis
Campos gravados:
  - nfRemessa
  - codigoCliente
  - nomeCliente
  - produto
  - descricao
  - saldo
  - pedido
  - codigoProtheus
  - email
"""

import os, sys
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

NFES_EXEMPLO = [
    # Promotor: Bruno Espindula (Protheus: 22371)
    {
        "codigoProtheus": "22371",
        "email": "b_espindula@makita.com.br",
        "nfes": [
            {
                "idDoc": "nfe_22371_1",
                "nfRemessa": "NF-0044109",
                "codigoCliente": "CLI-3012",
                "nomeCliente": "LOJAS CEM S/A - MATRIZ",
                "produto": "DHP482Z",
                "descricao": "PARAFUSADEIRA / FURADEIRA DE IMPACTO A BATERIA 18V LXT",
                "saldo": 1,
                "pedido": "PED-981201",
                "status": "Disponível"
            },
            {
                "idDoc": "nfe_22371_2",
                "nfRemessa": "NF-0044109",
                "codigoCliente": "CLI-3012",
                "nomeCliente": "LOJAS CEM S/A - MATRIZ",
                "produto": "BL1850B",
                "descricao": "BATERIA DE ÍONS DE LÍTIO 18V 5.0 AH COM INDICADOR",
                "saldo": 2,
                "pedido": "PED-981201",
                "status": "Disponível"
            },
            {
                "idDoc": "nfe_22371_3",
                "nfRemessa": "NF-0045220",
                "codigoCliente": "CLI-3088",
                "nomeCliente": "TELHANORTE / SAINT-GOBAIN",
                "produto": "GA005GZ",
                "descricao": "ESMERILHADEIRA ANGULAR 125MM (5\") 40V MAX XGT MOTOR BL",
                "saldo": 1,
                "pedido": "PED-990145",
                "status": "Disponível"
            }
        ]
    },
    # Admin / Promotor: Jonathan Melgaço (Protheus: 88901)
    {
        "codigoProtheus": "88901",
        "email": "j_melgaco@makita.com.br",
        "nfes": [
            {
                "idDoc": "nfe_88901_1",
                "nfRemessa": "NF-0033100",
                "codigoCliente": "CLI-2005",
                "nomeCliente": "LEROY MERLIN COMPANHIA BRASILEIRA",
                "produto": "DUC353Z",
                "descricao": "ELETROSERRA A BATERIA 36V (18V+18V) SABRE 35CM LXT",
                "saldo": 1,
                "pedido": "PED-910290",
                "status": "Disponível"
            },
            {
                "idDoc": "nfe_88901_2",
                "nfRemessa": "NF-0033100",
                "codigoCliente": "CLI-2005",
                "nomeCliente": "LEROY MERLIN COMPANHIA BRASILEIRA",
                "produto": "HS004GZ",
                "descricao": "SERRA CIRCULAR 190MM (7-1/2\") 40V MAX XGT MOTOR BL",
                "saldo": 2,
                "pedido": "PED-910290",
                "status": "Disponível"
            },
            {
                "idDoc": "nfe_88901_3",
                "nfRemessa": "NF-0034512",
                "codigoCliente": "CLI-2010",
                "nomeCliente": "SODIMAC / DICICO S/A",
                "produto": "DUR368AZ",
                "descricao": "ROÇADEIRA A BATERIA 36V (18V+18V) MOTOR BL LXT",
                "saldo": 1,
                "pedido": "PED-920110",
                "status": "Disponível"
            }
        ]
    }
]

def main():
    if not os.path.exists(CHAVE):
        print(f"[ERRO] Chave de serviço não encontrada: {CHAVE}")
        sys.exit(1)

    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    total = 0

    for grupo in NFES_EXEMPLO:
        protheus_code = grupo["codigoProtheus"]
        email_user = grupo["email"]

        for nfe in grupo["nfes"]:
            doc_id = nfe["idDoc"]

            payload = {
                "nfRemessa": nfe["nfRemessa"],
                "codigoCliente": nfe["codigoCliente"],
                "nomeCliente": nfe["nomeCliente"],
                "produto": nfe["produto"],
                "descricao": nfe["descricao"],
                "saldo": nfe["saldo"],
                "pedido": nfe["pedido"],
                "codigoProtheus": protheus_code,
                "email": email_user,
                "status": nfe["status"],
                "criadoEm": firestore.SERVER_TIMESTAMP
            }

            # 1. Grava na subcoleção oficial: promotores/{protheusCode}/nfe_disponiveis/{doc_id}
            subcol_ref = db.collection("promotores").document(protheus_code).collection("nfe_disponiveis").document(doc_id)
            subcol_ref.set(payload, merge=True)

            # 2. Grava também na subcoleção por email: promotores/{email}/nfe_disponiveis/{doc_id}
            subcol_email_ref = db.collection("promotores").document(email_user).collection("nfe_disponiveis").document(doc_id)
            subcol_email_ref.set(payload, merge=True)

            # 3. Grava também na coleção raiz: nfe_disponiveis/{doc_id}
            root_ref = db.collection("nfe_disponiveis").document(doc_id)
            root_ref.set(payload, merge=True)

            total += 1
            print(f"  [NF-E] {nfe['nfRemessa']} — {nfe['produto']} ({nfe['nomeCliente']}) -> Promotor: {protheus_code}")

    print(f"\n✅ {total} Notas Fiscais cadastradas com sucesso no Firestore (Subcoleções e Coleção Raiz)!")

if __name__ == "__main__":
    main()
