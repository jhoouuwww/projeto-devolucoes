#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed das 55 NF-e para Bruno Espindula (Protheus: 22371) no Firestore
====================================================================
"""

import os, sys
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

PRODUTOS = [
    ("DHP482Z",   "PARAFUSADEIRA / FURADEIRA DE IMPACTO A BATERIA 18V LXT"),
    ("BL1850B",   "BATERIA DE ÍONS DE LÍTIO 18V 5.0 AH COM INDICADOR"),
    ("GA005GZ",   "ESMERILHADEIRA ANGULAR 125MM (5\") 40V MAX XGT MOTOR BL"),
    ("HR2470",    "MARTELETE ROTATIVO E ROMPEDOR 800W ENCAIXE SDS-PLUS 220V"),
    ("DC18RC",    "CARREGADOR RÁPIDO DE BATERIAS 18V / 14.4V LXT BIVOLT"),
    ("DUC353Z",   "ELETROSERRA A BATERIA 36V (18V+18V) SABRE 35CM LXT"),
    ("HS004GZ",   "SERRA CIRCULAR 190MM (7-1/2\") 40V MAX XGT MOTOR BL"),
    ("DUR368AZ",  "ROÇADEIRA A BATERIA 36V (18V+18V) MOTOR BL LXT"),
    ("BL4040",    "BATERIA 40V MAX XGT 4.0 AH COM INDICADOR"),
    ("DLS211ZU",  "SERRA DE ESQUADRIA TELESCÓPICA 305MM 36V (18V+18V) BL"),
    ("HM1213C",   "MARTELO DEMOLIDOR 1.510W SDS-MAX COM AVT 220V"),
    ("M0901G",    "ESMERILHADEIRA ANGULAR 115MM (4-1/2\") 540W 220V"),
    ("HP1640",    "FURADEIRA DE IMPACTO 13MM (1/2\") 760W 220V"),
    ("DUB184Z",   "SOPRADOR A BATERIA 18V LXT MOTOR BL"),
    ("CL108FDZW", "ASPIRADOR DE PÓ A BATERIA 12V MAX CXT")
]

CLIENTES = [
    ("CLI-3010", "LOJAS CEM S/A - MATRIZ"),
    ("CLI-3015", "TELHANORTE / SAINT-GOBAIN"),
    ("CLI-3022", "MAGAZINE LUIZA S/A - CD RIBEIRÃO"),
    ("CLI-3028", "LEROY MERLIN COMPANHIA BRASILEIRA"),
    ("CLI-3035", "SODIMAC / DICICO S/A"),
    ("CLI-3040", "CASA DOS PARAFUSOS LTDA"),
    ("CLI-3045", "FERRAGENS BANDEIRANTES"),
    ("CLI-3050", "CENTRAL DOS CONSTRUTORES"),
    ("CLI-3055", "C&C CASA E CONSTRUÇÃO S/A")
]

def main():
    if not os.path.exists(CHAVE):
        print(f"[ERRO] Chave não encontrada: {CHAVE}")
        sys.exit(1)

    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    protheus_code = "22371"
    email_user = "b_espindula@makita.com.br"

    total = 0
    batch = db.batch()

    # Gera 55 registros de NFe para Bruno Espindula
    for i in range(1, 56):
        nfe_num = f"NF-{44100 + (i // 2):06d}"
        cli_code, cli_nome = CLIENTES[(i - 1) % len(CLIENTES)]
        prod_code, prod_desc = PRODUTOS[(i - 1) % len(PRODUTOS)]
        pedido_num = f"PED-98{1200 + (i // 3):04d}"
        saldo_val = (i % 3) + 1
        doc_id = f"nfe_22371_{i:02d}"

        payload = {
            "nfRemessa": nfe_num,
            "codigoCliente": cli_code,
            "nomeCliente": cli_nome,
            "produto": prod_code,
            "descricao": prod_desc,
            "saldo": saldo_val,
            "pedido": pedido_num,
            "codigoProtheus": protheus_code,
            "email": email_user,
            "status": "Disponível",
            "criadoEm": firestore.SERVER_TIMESTAMP
        }

        # Subcoleção promotores/22371/nfe_disponiveis/nfe_22371_XX
        sub_ref = db.collection("promotores").document(protheus_code).collection("nfe_disponiveis").document(doc_id)
        batch.set(sub_ref, payload, merge=True)

        # Subcoleção promotores/b_espindula@makita.com.br/nfe_disponiveis/nfe_22371_XX
        sub_email_ref = db.collection("promotores").document(email_user).collection("nfe_disponiveis").document(doc_id)
        batch.set(sub_email_ref, payload, merge=True)

        # Coleção raiz nfe_disponiveis/nfe_22371_XX
        root_ref = db.collection("nfe_disponiveis").document(doc_id)
        batch.set(root_ref, payload, merge=True)

        total += 1
        print(f"  [{i:02d}/55] {nfe_num} | {cli_nome[:25]} | {prod_code} ({prod_desc[:30]})")

    batch.commit()
    print(f"\n✅ {total} Notas Fiscais cadastradas no Firestore com sucesso para Bruno Espindula ({protheus_code})!")

if __name__ == "__main__":
    main()
