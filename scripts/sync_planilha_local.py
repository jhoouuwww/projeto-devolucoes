#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Robô Leve de Sincronização Local — Excel (Drive K:\) para Sistema de Devoluções Makita
--------------------------------------------------------------------------------------
Este script lê a planilha local de ativos/saldos do Excel (ex: K:\Promotoria\Saldos_Ativos.xlsx)
e gera o arquivo consolidado JSON ou sincroniza diretamente com o Firestore sem precisar de TI.

Como usar:
1. Instale as bibliotecas necessárias caso não tenha:
   pip install pandas openpyxl requests

2. Ajuste o caminho da planilha na variável CAMINHO_PLANILHA_EXCEL abaixo.
3. Execute o script:
   python sync_planilha_local.py
"""

import os
import sys
import json
from datetime import datetime

# ==========================================
# CONFIGURAÇÕES DO ARQUIVO LOCAL
# ==========================================
# Ajuste para o caminho real da sua planilha na rede ou computador
CAMINHO_PLANILHA_EXCEL = r"K:\Promotoria\Devolucoes\Base_Saldos_Ativos.xlsx"

# Nome da aba de consulta ou base
NOME_ABA = "Consulta"

# Arquivo JSON de saída local (caso queira carregar offline)
ARQUIVO_SAIDA_JSON = "base_ativos_sincronizada.json"


def carregar_e_processar_planilha():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Iniciando leitura da planilha: {CAMINHO_PLANILHA_EXCEL}")
    
    if not os.path.exists(CAMINHO_PLANILHA_EXCEL):
        print(f"[AVISO] Arquivo {CAMINHO_PLANILHA_EXCEL} não encontrado no momento.")
        print("Certifique-se de que o Drive K:\\ está conectado.")
        return None

    try:
        import pandas as pd
    except ImportError:
        print("[ERRO] Biblioteca 'pandas' ou 'openpyxl' não instalada. Execute: pip install pandas openpyxl")
        return None

    try:
        # Lê a planilha do Excel
        df = pd.read_excel(CAMINHO_PLANILHA_EXCEL, sheet_name=NOME_ABA)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Planilha lida com sucesso. Total de linhas brutas: {len(df)}")
        
        # Limpeza e mapeamento básico das colunas
        df.columns = [str(col).strip().lower() for col in df.columns]
        
        itens_processados = []
        for _, row in df.iterrows():
            # Mapeia colunas comuns
            codigo_item = str(row.get('codigo', row.get('código', row.get('item', '')))).strip()
            descricao = str(row.get('descricao', row.get('descrição', row.get('produto', '')))).strip()
            nf = str(row.get('nf', row.get('nota fiscal', row.get('nota', '')))).strip()
            pedido = str(row.get('pedido', row.get('num_pedido', ''))).strip()
            protheus = str(row.get('protheus', row.get('vendedor', row.get('colaborador', '12345')))).strip()
            saldo = row.get('saldo', row.get('saldo_disponivel', row.get('qtd', 1)))
            
            try:
                saldo_num = int(saldo)
            except:
                saldo_num = 1

            if codigo_item and descricao and codigo_item != 'nan' and descricao != 'nan':
                itens_processados.append({
                    "protheus": protheus,
                    "codigoItem": codigo_item,
                    "descricao": descricao,
                    "notaFiscal": nf if nf != 'nan' else "S/NF",
                    "pedido": pedido if pedido != 'nan' else "S/PED",
                    "saldoDisponivel": saldo_num
                })

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Total de ativos estruturados: {len(itens_processados)}")
        
        # Salva o arquivo JSON consolidado
        with open(ARQUIVO_SAIDA_JSON, "w", encoding="utf-8") as f:
            json.dump(itens_processados, f, ensure_ascii=False, indent=2)
            
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Base salva com sucesso em '{ARQUIVO_SAIDA_JSON}'!")
        return itens_processados

    except Exception as e:
        print(f"[ERRO] Falha ao processar arquivo do Excel: {e}")
        return None


if __name__ == "__main__":
    carregar_e_processar_planilha()
