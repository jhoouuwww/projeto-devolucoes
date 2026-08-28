#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import urllib.parse
import json
import math
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # Raio da Terra em km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def buscar_filial_mais_proxima(cep_str):
    cep_limpo = "".join(filter(str.isdigit, cep_str))
    if len(cep_limpo) != 8:
        return {"erro": "CEP deve conter 8 dígitos"}

    # 1. Busca dados no ViaCEP
    url_viacep = f"https://viacep.com.br/ws/{cep_limpo}/json/"
    req = urllib.request.Request(url_viacep, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as resp:
        data_via = json.loads(resp.read().decode('utf-8'))
        if data_via.get("erro"):
            return {"erro": "CEP não encontrado no ViaCEP"}

    logradouro = data_via.get("logradouro", "")
    bairro = data_via.get("bairro", "")
    cidade = data_via.get("localidade", "")
    uf = data_via.get("uf", "")

    user_lat, user_lon = None, None

    # 2. Tenta obter coordenadas pelo CEP exato no OpenStreetMap Nominatim
    try:
        url_nom = f"https://nominatim.openstreetmap.org/search?postalcode={cep_limpo}&country=Brazil&format=json"
        req_nom = urllib.request.Request(url_nom, headers={'User-Agent': 'MakitaDevolucoesApp/1.0'})
        with urllib.request.urlopen(req_nom, context=ctx) as resp_nom:
            data_nom = json.loads(resp_nom.read().decode('utf-8'))
            if data_nom and len(data_nom) > 0:
                user_lat = float(data_nom[0]["lat"])
                user_lon = float(data_nom[0]["lon"])
    except Exception as e:
        pass

    # 3. Fallback: Busca pelas coordenadas da Cidade/UF
    if user_lat is None:
        try:
            url_city = f"https://nominatim.openstreetmap.org/search?city={urllib.parse.quote(cidade)}&state={uf}&country=Brazil&format=json"
            req_city = urllib.request.Request(url_city, headers={'User-Agent': 'MakitaDevolucoesApp/1.0'})
            with urllib.request.urlopen(req_city, context=ctx) as resp_city:
                data_city = json.loads(resp_city.read().decode('utf-8'))
                if data_city and len(data_city) > 0:
                    user_lat = float(data_city[0]["lat"])
                    user_lon = float(data_city[0]["lon"])
        except Exception as e:
            pass

    if user_lat is None or user_lon is None:
        return {"erro": "Não foi possível calcular coordenadas para este CEP"}

    # 4. Carrega 106 filiais Braspress
    with open("braspress_filiais.json", "r", encoding="utf-8") as f:
        filiais = json.load(f)

    filiais_com_distancia = []
    for f in filiais:
        f_lat = f.get("latitude")
        f_lon = f.get("longitude")
        if f_lat is not None and f_lon is not None:
            dist = haversine_distance(user_lat, user_lon, float(f_lat), float(f_lon))
            filiais_com_distancia.append({
                "filial": f,
                "distancia_km": round(dist, 1)
            })

    filiais_com_distancia.sort(key=lambda x: x["distancia_km"])
    mais_proxima = filiais_com_distancia[0]

    end_usr = f"{logradouro + ', ' if logradouro else ''}{bairro + ' - ' if bairro else ''}{cidade}/{uf}"

    return {
        "endereco_usuario": end_usr,
        "filial_mais_proxima": mais_proxima["filial"]["nomeFantasia"],
        "sigla": mais_proxima["filial"]["sigla"],
        "distancia_km": mais_proxima["distancia_km"],
        "endereco_filial": f"{mais_proxima['filial']['logradouro']}, {mais_proxima['filial']['logNumero']} - {mais_proxima['filial']['bairro']} ({mais_proxima['filial']['cidade']}/{mais_proxima['filial']['uf']})",
        "telefone_filial": mais_proxima["filial"]["fone"],
        "top_3": [f"{item['filial']['nomeFantasia']} ({item['filial']['sigla']}) - {item['distancia_km']} km" for item in filiais_com_distancia[:3]]
    }

def main():
    ceps_teste = [
        "13480-000", # Limeira / SP
        "01310-100", # Av Paulista / São Paulo SP
        "80010-000", # Curitiba / PR
        "30130-000", # Belo Horizonte / MG
        "70040-000", # Brasília / DF
        "60060-000", # Fortaleza / CE
    ]

    print("=================================================================")
    print(" TESTANDO CÁLCULO DE FILIAL BRASPRESS COM FALLBACK DE CIDADE")
    print("=================================================================")
    for cep in ceps_teste:
        res = buscar_filial_mais_proxima(cep)
        print(f"\nCEP: {cep}")
        print(f"  Endereço Usuário  : {res.get('endereco_usuario')}")
        print(f"  ⭐ Filial Próxima : {res.get('filial_mais_proxima')} ({res.get('sigla')}) - {res.get('distancia_km')} km")
        print(f"  Endereço Filial   : {res.get('endereco_filial')}")
        print(f"  Telefone Filial   : {res.get('telefone_filial')}")
        print(f"  Top 3 mais perto : {res.get('top_3')}")

if __name__ == "__main__":
    main()
