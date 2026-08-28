#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

def classificar_antigo(prod, desc, saldo):
    prod_u = prod.upper().trim() if hasattr(prod, 'trim') else prod.upper().strip()
    desc_u = desc.upper().trim() if hasattr(desc, 'trim') else desc.upper().strip()

    if prod_u.startswith("BL") or prod_u.startswith("191B") or "BATERIA" in desc_u:
        return "BATERIA"
    elif prod_u.startswith("DC") or "CARREGADOR" in desc_u or "KIT" in desc_u:
        return "CARREGADOR"
    elif any(prod_u.startswith(p) for p in ["HR", "DHP", "TW", "GA", "VR", "VS", "CL", "HM", "DLS", "HS", "DUR", "HP", "DUB", "DUC", "DGP", "DML", "M09"]) or any(m in desc_u for m in ["MARTELETE", "ESMERILHADEIRA", "PARAFUSADEIRA", "FURADEIRA", "SERRA", "MARTELO", "SOPRADOR", "ASPIRADOR", "ROÇADEIRA", "ELETROSERRA", "CHAVE", "AMOSTRA", "UNIDADE", "REFLETOR", "VIBRADOR", "VARREDEIRA", "APLICADOR"]):
        return "MAQUINA"
    else:
        return "ACESSORIO"

def classificar_novo(prod, desc, saldo):
    prod_u = prod.upper().strip()
    desc_u = desc.upper().strip()

    # 1. Carregadores e Kits
    is_carregador = (
        prod_u.startswith("DC") or prod_u.startswith("191F") or prod_u.startswith("1975") or
        "CARREGADOR" in desc_u or "CARREG." in desc_u or "CARREG " in desc_u or "KIT" in desc_u
    )
    if is_carregador:
        return "CARREGADOR"

    # 2. Baterias
    is_bateria = (
        prod_u.startswith("BL") or prod_u.startswith("191B") or prod_u.startswith("1974") or prod_u.startswith("1972") or prod_u.startswith("1963") or prod_u.startswith("PDC") or
        desc_u.startswith("BATERIA") or "BATERIA DE" in desc_u or "BATERIA LI-ION" in desc_u or "BATERIA LXT" in desc_u or "BATERIA XGT" in desc_u or "BAT." in desc_u
    )
    if is_bateria:
        return "BATERIA"

    # 3. Máquinas
    is_maquina = (
        any(prod_u.startswith(p) for p in ["HR", "DHP", "TW", "GA", "VR", "VS", "CL", "HM", "DLS", "HS", "DUR", "HP", "DUB", "DUC", "DGP", "DML", "JV", "CW", "DRC", "PS", "UA", "DTL", "BS", "MP", "AS", "M09", "DF", "DT", "TD"]) or
        prod_u.startswith("SMP-") or
        any(m in desc_u for m in ["MARTELETE", "ESMERILHADEIRA", "PARAFUSADEIRA", "FURADEIRA", "SERRA", "MARTELO", "SOPRADOR", "ASPIRADOR", "ROÇADEIRA", "ELETROSERRA", "CHAVE", "AMOSTRA", "UNIDADE", "REFLETOR", "VIBRADOR", "VARREDEIRA", "APLICADOR", "REFRIGERADOR", "POLIDORA", "MOTOPODA", "COMPRESSOR", "LIXADEIRA", "TICO-TICO", "MOTOSSERRA", "LIMPADORA"])
    )
    if is_maquina:
        return "MAQUINA"

    return "ACESSORIO"

def main():
    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    docs = list(db.collection("promotores").document("22371").collection("nfe_disponiveis").stream())

    antigo_counts = {"MAQUINA": 0, "BATERIA": 0, "CARREGADOR": 0, "ACESSORIO": 0}
    novo_counts   = {"MAQUINA": 0, "BATERIA": 0, "CARREGADOR": 0, "ACESSORIO": 0}

    print("=================================================================")
    print(" COMPARAÇÃO DE CLASSIFICAÇÃO DOS 49 ATIVOS DO PROMOTOR 22371")
    print("=================================================================")

    for d in docs:
        data = d.to_dict()
        prod = data.get("codigoItem") or data.get("produto") or ""
        desc = data.get("descricao") or ""
        qtd = float(data.get("saldoDisponivel") or data.get("saldo") or data.get("quantidade") or 1)

        c_antigo = classificar_antigo(prod, desc, qtd)
        c_novo = classificar_novo(prod, desc, qtd)

        antigo_counts[c_antigo] += int(qtd)
        novo_counts[c_novo] += int(qtd)

        if c_antigo != c_novo:
            print(f"DIFF -> PROD: {prod:<15} | DESC: {desc:<45} | ANTIGO: {c_antigo:<10} => NOVO: {c_novo:<10}")

    print("\n-----------------------------------------------------------------")
    print(f"TOTAL ANTIGO : Máquinas: {antigo_counts['MAQUINA']} | Baterias: {antigo_counts['BATERIA']} | Carregadores: {antigo_counts['CARREGADOR']} | Acessórios: {antigo_counts['ACESSORIO']}")
    print(f"TOTAL NOVO   : Máquinas: {novo_counts['MAQUINA']} | Baterias: {novo_counts['BATERIA']} | Carregadores: {novo_counts['CARREGADOR']} | Acessórios: {novo_counts['ACESSORIO']}")
    print("-----------------------------------------------------------------")

if __name__ == "__main__":
    main()
