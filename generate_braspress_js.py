#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json

def main():
    with open("braspress_filiais.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    filiais_clean = []
    for item in data:
        filiais_clean.append({
            "idFilial": item.get("idFilial"),
            "sigla": item.get("sigla"),
            "nomeFantasia": item.get("nomeFantasia"),
            "razaoSocial": item.get("razaoSocial"),
            "logradouro": item.get("logradouro"),
            "logNumero": item.get("logNumero"),
            "bairro": item.get("bairro"),
            "cidade": item.get("cidade"),
            "uf": item.get("uf"),
            "cepStr": item.get("cepStr"),
            "fone": item.get("fone"),
            "latitude": item.get("latitude"),
            "longitude": item.get("longitude"),
            "label": f"{item.get('cidade')} - {item.get('nomeFantasia')} ({item.get('sigla')}) / {item.get('uf')}"
        })

    # Ordena por estado e nome da cidade
    filiais_clean.sort(key=lambda x: (x["uf"], x["cidade"], x["nomeFantasia"]))

    js_code = f"""/**
 * Módulo Oficial de Filiais Braspress & Busca por CEP de Maior Proximidade
 * Dados sincronizados diretamente da API oficial da Braspress (https://blue.braspress.com/site/w/filial/json)
 */

export const BRASPRESS_FILIAIS = {json.dumps(filiais_clean, ensure_ascii=False, indent=4)};

/**
 * Calcula a distância em KM entre dois pontos geográficos via Fórmula de Haversine
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {{
    const R = 6371.0; // Raio da Terra em KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}}

/**
 * Busca a filial Braspress mais próxima com base no CEP do usuário
 * @param {{string}} cepInput 
 * @returns {{Promise<Object>}} Resultado com filial recomendada e distância
 */
export async function buscarFilialBraspressPorCEP(cepInput) {{
    const cepLimpo = String(cepInput || "").replace(/\\D/g, "");
    if (cepLimpo.length !== 8) {{
        return {{ ok: false, mensagem: "Digite um CEP válido com 8 dígitos." }};
    }}

    try {{
        // 1. Consulta no ViaCEP para obter Logradouro, Bairro, Cidade e UF
        const respVia = await fetch(`https://viacep.com.br/ws/${{cepLimpo}}/json/`);
        if (!respVia.ok) throw new Error("Erro ao consultar o CEP.");
        const dataVia = await respVia.json();
        if (dataVia.erro) {{
            return {{ ok: false, mensagem: "CEP não encontrado. Verifique o número digitado." }};
        }}

        const logradouro = dataVia.logradouro || "";
        const bairro = dataVia.bairro || "";
        const cidade = dataVia.localidade || "";
        const uf = dataVia.uf || "";

        // 2. Geocoding das coordenadas pelo OpenStreetMap Nominatim
        let userLat = null;
        let userLon = null;

        try {{
            const nomUrl = `https://nominatim.openstreetmap.org/search?postalcode=${{cepLimpo}}&country=Brazil&format=json`;
            const respNom = await fetch(nomUrl);
            if (respNom.ok) {{
                const dataNom = await respNom.json();
                if (Array.isArray(dataNom) && dataNom.length > 0) {{
                    userLat = parseFloat(dataNom[0].lat);
                    userLon = parseFloat(dataNom[0].lon);
                }}
            }}
        }} catch (e) {{
            console.warn("Aviso ao buscar coordenadas por CEP no Nominatim:", e);
        }}

        // Fallback: Busca pelas coordenadas da Cidade + UF se o CEP não retornar coordenadas exatas
        if (userLat === null || userLon === null) {{
            try {{
                const cityUrl = `https://nominatim.openstreetmap.org/search?q=${{encodeURIComponent(`${{cidade}}, ${{uf}}, Brasil`)}}&format=json`;
                const respCity = await fetch(cityUrl);
                if (respCity.ok) {{
                    const dataCity = await respCity.json();
                    if (Array.isArray(dataCity) && dataCity.length > 0) {{
                        userLat = parseFloat(dataCity[0].lat);
                        userLon = parseFloat(dataCity[0].lon);
                    }}
                }}
            }} catch (e) {{
                console.warn("Aviso ao buscar coordenadas da cidade no Nominatim:", e);
            }}
        }}

        // Se ainda não tiver coordenadas, localiza a filial pelo mesmo estado/UF
        if (userLat === null || userLon === null) {{
            const mesmaUf = BRASPRESS_FILIAIS.filter(f => f.uf === uf);
            const recomendada = mesmaUf.length > 0 ? mesmaUf[0] : BRASPRESS_FILIAIS[0];
            return {{
                ok: true,
                enderecoUsuario: `${{logradouro ? logradouro + ', ' : ''}}${{bairro ? bairro + ' - ' : ''}}${{cidade}}/${{uf}}`,
                filialRecomendada: recomendada,
                distanciaKm: null,
                mensagem: `Filial sugerida pelo estado ${{uf}}.`
            }};
        }}

        // 3. Calcula Haversine para todas as 106 filiais Braspress
        const filiaisComDistancia = BRASPRESS_FILIAIS.map(f => {{
            const dist = (f.latitude && f.longitude) ? 
                haversineDistance(userLat, userLon, Number(f.latitude), Number(f.longitude)) : 99999;
            return {{ filial: f, distanciaKm: Math.round(dist * 10) / 10 }};
        }});

        filiaisComDistancia.sort((a, b) => a.distanciaKm - b.distanciaKm);
        const maisProxima = filiaisComDistancia[0];

        return {{
            ok: true,
            enderecoUsuario: `${{logradouro ? logradouro + ', ' : ''}}${{bairro ? bairro + ' - ' : ''}}${{cidade}}/${{uf}}`,
            filialRecomendada: maisProxima.filial,
            distanciaKm: maisProxima.distanciaKm,
            topProximas: filiaisComDistancia.slice(0, 3)
        }};
    }} catch (err) {{
        console.error("Erro na busca de CEP Braspress:", err);
        return {{ ok: false, mensagem: "Não foi possível calcular a filial mais próxima. Selecione manualmente na lista." }};
    }}
}}
"""

    with open("/home/promotoria_mkta/projeto-devoluções/public/js/braspress.js", "w", encoding="utf-8") as f:
        f.write(js_code)
    print("Gerado public/js/braspress.js com sucesso!")

if __name__ == "__main__":
    main()
