#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

ACESSORIOS_GRP = {
    "AC BITS", "AC OUTROS", "AC OPE", "AC LAMINAS DE SERRA", "AC DIAMANTADOS", 
    "AC SERRAS COPOS", "AC LAMINAS P/SERRA TICO-TICO,SABRE,FITA", "AC BROCAS PARA MADEIRA", 
    "AC ABRASIVOS", "AC BROCAS SDS PLUS", "AC CINZEIS", "AC FERRAMENTAS MANUAIS", 
    "AC BROCAS SDS MAX", "AC ESCOVAS DE CARVAO", "AC FLAP DISCS", "AC ESCOVAS DE ACO", 
    "AC BROCAS DE ACO RAPIDO", "AC LIXAS", "AC GRAMPOS E PINOS", "AC FACAS DE PLAINAS", 
    "AC BROCAS P/ CONCRETO", "AC FRESAS", "AC KITS"
}

MAQUINAS_GRP = {
    "BATERIA GERAL - 12V SLIDE LI-ION", "BATERIA GERAL - 18V LI-ION", "BATERIA GERAL - COMBOS 12V SLIDE",
    "METAL MECANICA - MINI ESMERILHADEIRAS", "METAL MECANICA - ESMERILHADEIRAS", "HAMMER - ROMPEDORES/DEMOLIDORES",
    "HAMMER - ROTATIVOS", "LINHA PROFISSIONAL - CONSTRUCAO CIVIL - SERRA MARMORE", "MADEIRA - SERRAS CIRCULARES",
    "MADEIRA - PLAINAS", "MADEIRA - TUPIAS", "MADEIRA - LIXADEIRAS", "BATERIA - AUTOMOTIVO", "METAL MECANICA - OUTROS",
    "BATERIA GERAL - NI-CD / NI-MH", "CONSTRUCAO CIVIL - SERRA MARMORE", "CONSTRUCAO CIVIL - OUTROS",
    "METAL MECANICA - PARAFUSADEIRAS", "METAL MECANICA - LIXADEIRAS/POLITRIZES", "FURADEIRAS - IMPACTO",
    "HAMMER - MARTELETES", "METAL MECANICA - CHAVES DE IMPACTO", "MEDIDOR / NIVEL A LASER", "BATERIA GERAL - 7.2V LI-ION",
    "BATERIA GERAL - 12V (10.8V) LI-ION - ASPIRADORES", "METAL MECANICA - RETIFICADEIRAS", "SOPRADORES / ASPIRADORES",
    "MADEIRA - TICO TICOS", "LINHA PROFISSIONAL - FURADEIRAS DE IMPACTO", "LINHA PROFISSIONAL - BATERIA GERAL",
    "LINHA PNEUMATICA", "BATERIA GERAL - COMBOS 18V", "ASPIRADORES / ASPIRADORES", "BATERIA GERAL - 18V LI-ION - ASPIRADORES",
    "LINHA PROFISSIONAL - METAL MECANICA - MINI ESMERILHADEI", "BATERIA GERAL - 14.4V LI-ION",
    "LINHA PROFISSIONAL - HAMMER - ROMPEDORES/DEMOLIDORES", "FURADEIRAS - SIMPLES", "BATERIA GERAL - 12V (10.8V) LI-ION",
    "BATERIA GERAL - COMBOS 12V", "MADEIRA - OUTROS", "MADEIRA - ESQUADRIAS", "LINHA PROFISSIONAL - METAL MECANICA - ESMERILHADEIRAS",
    "BATERIA GERAL - 3.6V LI-ION", "LINHA PROFISSIONAL - MADEIRA - LIXADEIRAS", "BATERIA GERAL - ASPIRADORES",
    "METAL MECANICA - SERRAS SABRE", "LINHA PROFISSIONAL - MADEIRA - TUPIAS", "LINHA PROFISSIONAL - MADEIRA - SERRAS CIRCULARES",
    "LINHA PROFISSIONAL - METAL MECANICA - RETIFICADEIRAS", "LINHA PROFISSIONAL - FURADEIRAS SIMPLES",
    "LINHA PROFISSIONAL - MADEIRA - PLAINAS", "OUTDOOR - BATERIAS", "OUTROS - OUTROS", "OUTDOOR - OUTROS"
}

MAQUINA_PREFIXES = [
    "HR", "DHP", "TW", "GA", "VR", "VS", "CL", "HM", "DLS", "HS", "DUR", "HP", "DUB", "DUC", "DGP", 
    "DML", "JV", "CW", "DRC", "PS", "UA", "DTL", "BS", "MP", "AS", "M09", "DF", "DT", "TD", "JN", 
    "JS", "KP", "PJ", "RT", "RP", "SP", "UT", "UB", "UC", "UH", "UM", "UN", "UR", "UX", "VC", 
    "VV", "EB", "EG", "EK", "EW", "HW", "LC", "LW", "ML", "MS", "N19", "N37", "N59", "PK", "PW", "SK", "TL", "VT"
]

MAQUINA_KEYWORDS = [
    "MARTELETE", "ESMERILHADEIRA", "PARAFUSADEIRA", "FURADEIRA", "SERRA", "MARTELO", "SOPRADOR", 
    "ASPIRADOR", "ROÇADEIRA", "ELETROSERRA", "CHAVE", "AMOSTRA", "UNIDADE", "REFLETOR", "VIBRADOR", 
    "VARREDEIRA", "APLICADOR", "REFRIGERADOR", "POLIDORA", "MOTOPODA", "COMPRESSOR", "LIXADEIRA", 
    "TICO-TICO", "MOTOSSERRA", "LIMPADORA", "TESOURA", "CORTADOR", "PLAINA", "TUPIA", "FRESADORA"
]

def classificar_item(data):
    grp = (
        data.get("descGrpLinha") or data.get("desc_grp_linha") or 
        data.get("grupoLinha") or data.get("grupo_linha") or ""
    ).strip().upper()

    if grp:
        if grp == "AC BATERIAS":
            return "BATERIA"
        if grp == "AC CARREGADORES":
            return "CARREGADOR"
        if grp in ACESSORIOS_GRP:
            return "ACESSORIO"
        if grp in MAQUINAS_GRP:
            return "MAQUINA"

    # Fallback se grp for vazio ("") ou não cadastrado
    prod = (data.get("codigoItem") or data.get("produto") or "").strip().upper()
    desc = (data.get("descricao") or "").strip().upper()

    is_carregador = (
        prod.startswith("DC") or prod.startswith("191F") or prod.startswith("1975") or prod.startswith("1980") or prod.startswith("ADP") or
        "CARREGADOR" in desc or "CARREG." in desc or "CARREG " in desc or "CHARGER" in desc or "KIT" in desc
    )
    if is_carregador:
        return "CARREGADOR"

    is_bateria = (
        prod.startswith("BL") or prod.startswith("191B") or prod.startswith("1974") or prod.startswith("1972") or prod.startswith("1963") or prod.startswith("PDC") or
        desc.startswith("BATERIA") or "BATERIA DE" in desc or "BATERIA LI-ION" in desc or "BATERIA LXT" in desc or "BATERIA XGT" in desc or "BAT." in desc
    )
    if is_bateria and not any(k in desc for k in MAQUINA_KEYWORDS):
        return "BATERIA"

    is_maquina = (
        prod.startswith("SMP-") or
        any(prod.startswith(p) for p in MAQUINA_PREFIXES) or
        any(k in desc for k in MAQUINA_KEYWORDS)
    )
    if is_maquina:
        return "MAQUINA"

    return "ACESSORIO"

def main():
    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    docs = list(db.collection("promotores").document("22371").collection("nfe_disponiveis").stream())

    counts = {"MAQUINA": 0, "BATERIA": 0, "CARREGADOR": 0, "ACESSORIO": 0}

    print("=================================================================")
    print(" RE-TESTANDO CLASSIFICAÇÃO COM REGRAS E FALLBACK AJUSTADO")
    print("=================================================================")

    for d in docs:
        data = d.to_dict()
        grp = data.get("descGrpLinha") or data.get("desc_grp_linha") or ""
        prod = data.get("codigoItem") or data.get("produto") or ""
        desc = data.get("descricao") or ""
        qtd = float(data.get("saldoDisponivel") or data.get("saldo") or data.get("quantidade") or 1)

        c = classificar_item(data)
        counts[c] += int(qtd)

        print(f"GRP: {grp:<38} | PROD: {prod:<12} | CAT: {c:<10} | DESC: {desc}")

    print("\n-----------------------------------------------------------------")
    print(f"TOTALIZADOR FINAL COM REGRAS DO USUÁRIO: Máquinas: {counts['MAQUINA']} | Baterias: {counts['BATERIA']} | Carregadores: {counts['CARREGADOR']} | Acessórios: {counts['ACESSORIO']}")
    print("-----------------------------------------------------------------")

if __name__ == "__main__":
    main()
