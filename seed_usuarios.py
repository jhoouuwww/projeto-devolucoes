#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed de Usuários — Cadastro em Lote no Firestore
=================================================
Registra todos os promotores e o administrador na coleção
'usuarios_protheus' do Firebase (makita-devolucoes).
"""
import os, sys
from datetime import datetime
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
    ("Leandro Francisco",   "LEANDRO DE SOUZA FRANCISCO",            "Promotor Técnico",               "",      "l_francisco@makita.com.br"),
    ("Eduardo de Souza",    "EDUARDO DE SOUZA MACHADO",              "Promotor Técnico",               "22942", "e_machado@makita.com.br"),
    # Administrador
    ("Jonathan Melgaço",    "JONATHAN MELGAÇO",                      "Coordenador de Trade Marketing", "88901", "j_melgaco@makita.com.br"),
]

ADMIN_EMAIL = "j_melgaco@makita.com.br"

def main():
    if not os.path.exists(CHAVE):
        print(f"[ERRO] Chave de serviço não encontrada: {CHAVE}")
        sys.exit(1)

    cred = credentials.Certificate(CHAVE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    batch = db.batch()
    total = 0

    for nome_exibicao, nome_completo, cargo, protheus, email in USUARIOS:
        email_norm = email.lower().strip()
        is_admin = (email_norm == ADMIN_EMAIL)
        role = "admin" if is_admin else "usuario"

        payload = {
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

        doc_ref = db.collection("usuarios_protheus").document(email_norm)
        batch.set(doc_ref, payload, merge=True)
        total += 1
        print(f"  [{role.upper()}] {nome_exibicao} ({email_norm}) — Protheus: {protheus or 'N/A'}")

    batch.commit()
    print(f"\n✅ {total} usuários cadastrados/atualizados com sucesso no Firestore!")

if __name__ == "__main__":
    main()
