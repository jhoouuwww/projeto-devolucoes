#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Homologação Geral do Firestore — Carga em Lote para Todos os Promotores
======================================================================
1. Registra/Atualiza todos os usuários na coleção 'usuarios_protheus'
2. Registra NF-e ativas em:
   - subcoleção: promotores/{protheusCode}/nfe_disponiveis/{docId}
   - subcoleção: promotores/{email}/nfe_disponiveis/{docId}
   - coleção raiz: nfe_disponiveis/{docId}
"""

import os, sys
import firebase_admin
from firebase_admin import credentials, firestore

CHAVE = "./makita-devolucoes-firebase-adminsdk-fbsvc-c6075cd662.json"

USUARIOS = [
    ("Bruno de Fonseca",    "BRUNO DE FONSECA ESPINDULA",            "Promotor Técnico",               "22371", "b_espindula@makita.com.br"),
    ("Cleissa Barreto",     "CLEISSA BARRETO FARIAS",                "Promotora Técnica",              "16214", "c_farias@makita.com.br"),
    ("Daniel Nóbrega",      "DANIEL ANDRADE NÓBREGA",                "Promotor Técnico",               "20712", "d_nobrega@makita.com.br"),
    ("Davi Lopes",          "DAVI LOPES FERNANDES",                  "Promotor Técnico",               "22776", "d_fernandes@makita.com.br"),
    ("Denilson Lima",       "DENILSON LIMA SILVA",                   "Promotor Técnico",               "7163",  "denilson_silva@makita.com.br"),
    ("Diego Costa",         "DIEGO DA SILVA COSTA",                  "Analista De Produtos Técnico",   "7167",  "diego_costa@makita.com.br"),
    ("Diego Maia",          "DIEGO DA CRUZ MAIA",                    "Promotor Técnico",               "20138", "d_maia@makita.com.br"),
    ("Douglas Fortes",      "DOUGLAS FORTES",                        "Promotor Técnico",               "21932", "d_fortes@makita.com.br"),
    ("Douglas Henrique",    "DOUGLAS HENRIQUE DE JESUS COSTA",       "Promotor Técnico",               "19845", "d_costa@makita.com.br"),
    ("Eder Matheus",        "EDER MATHEUS MARTINS SANTOS",           "Promotor Técnico",               "21762", "em_santos@makita.com.br"),
    ("Erisvan De Sousa",    "ERISVAN DE SOUSA",                      "Promotor Técnico",               "17378", "er_souza@makitabr.onmicrosoft.com"),
    ("Ernandes Tavares",    "ERNANDES MARTINS TAVARES NETO",         "Promotor Técnico",               "21970", "em_neto@makita.com.br"),
    ("Felipe Montenegro",   "FELIPE DA SILVA MONTENEGRO",            "Promotor Técnico",               "16422", "t_montenegro@makita.com.br"),
    ("Felipe Remenegildo",  "FELIPE REMENEGILDO DOS SANTOS",         "Promotor Técnico",               "21935", "fr_santos@makita.com.br"),
    ("Felipe Vilas Boas",   "FELIPE VILAS BOAS DE OLIVEIRA",         "Promotor Técnico",               "17380", "fv_oliveira@makita.com.br"),
    ("Fernando Costa",      "FERNANDO COSTA DE OLIVEIRA",            "Promotor Técnico",               "16347", "fc_costa@makita.com.br"),
    ("Fernando Pereira",    "FERNANDO PEREIRA DA SILVA",             "Promotor Técnico",               "13556", "fe_pereira@makita.com.br"),
    ("Fred Castro",         "FRED SILVA CASTRO",                     "Promotor Técnico",               "22531", "f_castro@makita.com.br"),
    ("Hermes César",        "HERMES CÉSAR DA SILVA",                 "Promotor Técnico",               "9679",  "hcesar@makita.com.br"),
    ("Hiago Alves",         "HIAGO LEONEL DO CARMO ALVES",           "Promotor Técnico",               "14982", "h_alves@makita.com.br"),
    ("Humberto Izídio",     "HUMBERTO IZÍDIO DE LIMA",               "Promotor Técnico",               "9199",  "hizidio@makita.com.br"),
    ("Igor Luciano",        "IGOR LUCIANO DA SILVA",                 "Promotor Técnico",               "22153", "i_silva@makita.com.br"),
    ("Jhony Willrobson",    "JHONY WILLROBSON HERCULINO",            "Promotor Técnico",               "19459", "j_herculino@makita.com.br"),
    ("João Henrique",       "JOÃO HENRIQUE MARTINS DE FIGUEIREDO",   "Promotor Técnico",               "22533", "j_figueiredo@makita.com.br"),
    ("Thiago Viti",         "THIAGO TEIXEIRA VITI",                  "Promotor Técnico",               "22775", "t_viti@makita.com.br"),
    ("Julio Cesar",         "JULIO CESAR DE SOUZA SILVA",            "Promotor Técnico",               "13555", "jc_silva@makita.com.br"),
    ("Keven Alves",         "KEVEN ALVES DE ARAUJO",                 "Promotor Técnico",               "21863", "k_araujo@makita.com.br"),
    ("Marcelo Pereira",     "MARCELO PEREIRA SANTOS",                "Promotor Técnico",               "21933", "map_santos@makita.com.br"),
    ("Marco Orelio",        "MARCO ORELIO SCHTINE DE SOUZA",         "Promotor Técnico",               "21930", "mo_souza@makita.com.br"),
    ("Marcos Torquarto",    "MARCOS VINICUS TORQUARTO DE SOUSA",     "Promotor Técnico",               "21446", "mv_souza@makita.com.br"),
    ("Matheus Ladário",     "MATHEUS RAMOS LADÁRIO",                 "Promotor Técnico",               "18342", "m_ladario@makita.com.br"),
    ("Rodrigo Pereira",     "RODRIGO PEREIRA DE SOUZA",              "Analista De Produtos Técnico",   "13557", "r_sousa@makita.com.br"),
    ("Rogério Soares",      "ROGÉRIO SOARES GUIMARAES LIMA",         "Promotor Técnico",               "12460", "r_lima@makita.com.br"),
    ("Samuel Jonathas",     "SAMUEL JONATHAS DE LIMA MONTEIRO",      "Promotor Técnico",               "22532", "s_monteiro@makita.com.br"),
    ("Sebastião Mendes",    "SEBASTIÃO MANUEL MENDES",               "Promotor Técnico",               "22372", "s_mendes@makita.com.br"),
    ("Sérgio Correia",      "SÉRGIO LUIZ DA SILVA CORREIA",          "Promotor Técnico",               "15087", "s_correia@makita.com.br"),
    ("Sérgio Sena",         "SÉRGIO SENA DE OLIVEIRA",               "Analista De Produtos Técnico",   "12983", "s_oliveira@makita.com.br"),
    ("Vagner Doria",        "VAGNER DORIA SILVA",                    "Promotor Técnico",               "22154", "v_silva@makita.com.br"),
    ("Vagner Machado",      "VAGNER MACHADO JARDIM",                 "Promotor Técnico",               "22155", "v_jardim@makita.com.br"),
    ("Vitor Araujo",        "VITOR ARAUJO DUARTE",                   "Promotor Técnico",               "15624", "v_duarte@makita.com.br"),
    ("Webeson Sodré",       "WEBESON DA SILVA SODRÉ",                "Promotor Técnico",               "21186", "w_sodre@makita.com.br"),
    ("Leandro Francisco",   "LEANDRO DE SOUZA FRANCISCO",            "Promotor Técnico",               "22800", "l_francisco@makita.com.br"),
    ("Eduardo de Souza",    "EDUARDO DE SOUZA MACHADO",              "Promotor Técnico",               "22942", "e_machado@makita.com.br"),
    ("Jonathan Melgaço",    "JONATHAN MELGAÇO",                      "Coordenador de Trade Marketing", "88901", "j_melgaco@makita.com.br"),
]

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
        print(f"[ERRO] Chave de serviço não encontrada: {CHAVE}")
        sys.exit(1)

    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("=================================================================")
    print(" 1. HOMOLOGANDO USUÁRIOS EM 'usuarios_protheus'")
    print("=================================================================")
    user_batch = db.batch()
    for nome_exibicao, nome_completo, cargo, protheus, email in USUARIOS:
        email_norm = email.lower().strip()
        is_admin = (email_norm == "j_melgaco@makita.com.br")
        role = "admin" if is_admin else "usuario"

        user_payload = {
            "email": email_norm,
            "nome": nome_completo,
            "nomeExibicao": nome_exibicao,
            "protheus": protheus.strip(),
            "codigoProtheus": protheus.strip(),
            "cargo": cargo,
            "role": role,
            "isAdmin": is_admin,
            "filial": "01 - Matriz",
            "ativo": True,
            "criadoEm": firestore.SERVER_TIMESTAMP
        }
        user_ref = db.collection("usuarios_protheus").document(email_norm)
        user_batch.set(user_ref, user_payload, merge=True)
    user_batch.commit()
    print(f"✅ {len(USUARIOS)} Usuários homologados com sucesso!")

    print("\n=================================================================")
    print(" 2. HOMOLOGANDO NF-E DISPONÍVEIS EM SUBCOLEÇÕES E COLEÇÃO RAIZ")
    print("=================================================================")
    
    total_nfes = 0

    for idx_u, (_, nome_completo, cargo, protheus, email) in enumerate(USUARIOS):
        protheus_code = protheus.strip()
        email_user = email.lower().strip()

        if not protheus_code:
            continue

        nfe_batch = db.batch()
        # Define 5 a 15 NFes por colaborador (e 55 para Bruno Espindula)
        qtd_nfes = 55 if protheus_code == "22371" else (8 + (idx_u % 8))

        for i in range(1, qtd_nfes + 1):
            nfe_num = f"NF-{(44100 + (idx_u * 10) + (i // 2)):06d}"
            cli_code, cli_nome = CLIENTES[(i + idx_u) % len(CLIENTES)]
            prod_code, prod_desc = PRODUTOS[(i + idx_u) % len(PRODUTOS)]
            pedido_num = f"PED-98{(1200 + (idx_u * 5) + (i // 3)):04d}"
            saldo_val = (i % 3) + 1
            doc_id = f"nfe_{protheus_code}_{i:02d}"

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

            # 1. promotores/{protheusCode}/nfe_disponiveis/{doc_id}
            subcol_ref = db.collection("promotores").document(protheus_code).collection("nfe_disponiveis").document(doc_id)
            nfe_batch.set(subcol_ref, payload, merge=True)

            # 2. promotores/{email}/nfe_disponiveis/{doc_id}
            subcol_email_ref = db.collection("promotores").document(email_user).collection("nfe_disponiveis").document(doc_id)
            nfe_batch.set(subcol_email_ref, payload, merge=True)

            # 3. nfe_disponiveis/{doc_id}
            root_ref = db.collection("nfe_disponiveis").document(doc_id)
            nfe_batch.set(root_ref, payload, merge=True)

            total_nfes += 1

        nfe_batch.commit()
        print(f"  [{protheus_code}] {nome_completo[:30]} -> {qtd_nfes} NFes homologadas")

    print(f"\n✅ HOMOLOGAÇÃO CONCLUÍDA! Total de {total_nfes} Notas Fiscais cadastradas no Firestore para todos os códigos Protheus!")

if __name__ == "__main__":
    main()
