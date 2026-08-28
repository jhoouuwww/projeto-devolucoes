/**
 * Módulo de Administração — Importador Direto do Excel e Vínculos Protheus
 */
import { AuthState } from "./auth.js";
import { db, doc, setDoc, collection, getDocs, addDoc, serverTimestamp } from "./firebase.js";
import { VINCULOS_INICIAIS } from "./config.js";

export const AdminState = {
    dadosParseadosExcel: [],
    vinculosUsuarios: [],
    todasSolicitacoes: [],
    carregando: false
};

/**
 * Faz a leitura direta de arquivo .xlsx / .xls arrastado ou selecionado no navegador
 */
export async function processarArquivoExcel(file, protheusPadrao = "") {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve({ sucesso: false, mensagem: "Nenhum arquivo selecionado." });
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                if (typeof XLSX === "undefined") {
                    resolve({ sucesso: false, mensagem: "Biblioteca SheetJS não carregada." });
                    return;
                }

                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Procura a aba "Consulta" ou usa a primeira aba do arquivo
                let sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("consulta") || n.toLowerCase().includes("base") || n.toLowerCase().includes("saldo"));
                if (!sheetName) sheetName = workbook.SheetNames[0];

                const worksheet = workbook.Sheets[sheetName];
                const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (!jsonRows || jsonRows.length === 0) {
                    resolve({ sucesso: false, mensagem: "A planilha está vazia." });
                    return;
                }

                const resultados = [];
                for (let i = 0; i < jsonRows.length; i++) {
                    const row = jsonRows[i];
                    if (!row || row.length < 2) continue;

                    const rowText = row.map(c => String(c || "")).join(" ").toLowerCase();
                    // Pula cabeçalho
                    if (rowText.includes("código") || rowText.includes("codigo") || rowText.includes("descri") || rowText.includes("item")) {
                        continue;
                    }

                    let codigoItem = String(row[0] || "").trim();
                    let descricao = String(row[1] || "").trim();
                    let notaFiscal = String(row[2] || "S/NF").trim();
                    let pedido = String(row[3] || "S/PED").trim();
                    let saldo = parseInt(String(row[4] || "1").replace(/[^\d]/g, ""), 10) || 1;
                    let protheus = String(row[5] || protheusPadrao || "12345").trim();

                    if (codigoItem && descricao && codigoItem !== "undefined" && descricao !== "undefined") {
                        resultados.push({
                            protheus: protheus,
                            codigoItem: codigoItem,
                            descricao: descricao,
                            notaFiscal: notaFiscal,
                            pedido: pedido,
                            saldoDisponivel: saldo,
                            numeroSerie: String(row[6] || "")
                        });
                    }
                }

                AdminState.dadosParseadosExcel = resultados;
                resolve({
                    sucesso: true,
                    totalLinhas: resultados.length,
                    abaLida: sheetName,
                    dados: resultados
                });

            } catch (err) {
                resolve({ sucesso: false, mensagem: "Erro ao processar arquivo: " + err.message });
            }
        };
        reader.onerror = () => resolve({ sucesso: false, mensagem: "Falha ao ler o arquivo do disco." });
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Faz o parse inteligente de texto copiado e colado diretamente do Excel (TSV/CSV)
 */
export function processarTextoCopiadoDoExcel(textoBruto, protheusPadrao = "") {
    if (!textoBruto || !textoBruto.trim()) {
        return { sucesso: false, mensagem: "Cole o conteúdo copiado do Excel no campo de texto." };
    }

    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (linhas.length === 0) {
        return { sucesso: false, mensagem: "Nenhuma linha válida encontrada no texto." };
    }

    const resultados = [];
    let cabecalhoDetectado = false;

    // Detecta o separador principal (Tabulação do Excel '\t' ou Ponto e Vírgula ';')
    const primeiraLinha = linhas[0];
    const separador = primeiraLinha.includes("\t") ? "\t" : (primeiraLinha.includes(";") ? ";" : ",");

    for (let i = 0; i < linhas.length; i++) {
        const colunas = linhas[i].split(separador).map(c => c.trim().replace(/^["']|["']$/g, ""));
        
        // Verifica se é linha de cabeçalho
        const textoLinha = colunas.join(" ").toLowerCase();
        if (i === 0 && (textoLinha.includes("código") || textoLinha.includes("codigo") || textoLinha.includes("descri") || textoLinha.includes("nota") || textoLinha.includes("nf"))) {
            cabecalhoDetectado = true;
            continue; // Pula cabeçalho
        }

        if (colunas.length < 2) continue; // Linha inválida

        // Mapeamento flexível das colunas
        // Padrão comum: [Código Item, Descrição, NF, Pedido, Saldo, Código Protheus]
        let codigoProtheus = protheusPadrao;
        let codigoItem = colunas[0] || "";
        let descricao = colunas[1] || "";
        let notaFiscal = colunas[2] || "";
        let pedido = colunas[3] || "";
        let saldo = colunas[4] || "1";
        let serie = colunas[5] || "";

        // Se houver coluna de código protheus identificada
        if (colunas.length >= 6 && /^\d{3,8}$/.test(colunas[colunas.length - 1])) {
            codigoProtheus = colunas[colunas.length - 1];
        }

        // Limpeza e conversão
        const saldoNum = parseInt(saldo.replace(/[^\d]/g, ""), 10) || 1;

        if (codigoItem && descricao) {
            resultados.push({
                protheus: String(codigoProtheus || protheusPadrao || "12345").trim(),
                codigoItem: codigoItem,
                descricao: descricao,
                notaFiscal: notaFiscal || "S/NF",
                pedido: pedido || "S/PED",
                saldoDisponivel: saldoNum,
                numeroSerie: serie || ""
            });
        }
    }

    AdminState.dadosParseadosExcel = resultados;
    return {
        sucesso: true,
        totalLinhas: resultados.length,
        cabecalhoIgnorado: cabecalhoDetectado,
        dados: resultados
    };
}

/**
 * Salva a base importada do Excel diretamente no Firestore
 */
export async function salvarBaseExcelNoFirestore(dados, protheusAlvo) {
    if (!dados || dados.length === 0) {
        throw new Error("Nenhum dado para salvar.");
    }

    let salvos = 0;
    for (const item of dados) {
        const itemParaGravar = {
            protheus: String(item.protheus || protheusAlvo).trim(),
            codigoItem: item.codigoItem,
            descricao: item.descricao,
            notaFiscal: item.notaFiscal,
            pedido: item.pedido,
            saldoDisponivel: Number(item.saldoDisponivel || 1),
            numeroSerie: item.numeroSerie || "",
            atualizadoEm: serverTimestamp(),
            atualizadoPor: AuthState.profile ? AuthState.profile.email : "admin"
        };

        // Salva na coleção 'ativos_saldo'
        await addDoc(collection(db, "ativos_saldo"), itemParaGravar);
        salvos++;
    }

    return { sucesso: true, totalSalvo: salvos };
}

/**
 * Cadastra ou Atualiza Vínculo de Promotor (E-mail -> Código Protheus)
 */
export async function cadastrarVinculoUsuario(email, protheus, nome, filial = "01 - Matriz", cargo = "Promotor Técnico") {
    const emailNorm = email.toLowerCase().trim();
    const protheusNorm = String(protheus).trim();

    if (!emailNorm.endsWith("@makita.com.br") && !emailNorm.includes("@")) {
        throw new Error("E-mail inválido.");
    }
    if (!protheusNorm) {
        throw new Error("Código Protheus é obrigatório.");
    }

    const payload = {
        email: emailNorm,
        protheus: protheusNorm,
        codigoProtheus: protheusNorm,
        nome: nome || emailNorm.split("@")[0].replace(".", " "),
        filial: filial,
        cargo: cargo,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: AuthState.profile ? AuthState.profile.email : "admin"
    };

    // Grava com o ID sendo o próprio e-mail
    await setDoc(doc(db, "usuarios_protheus", emailNorm), payload, { merge: true });
    return { sucesso: true, email: emailNorm, protheus: protheusNorm };
}

/**
 * Carrega todos os vínculos cadastrados
 */
export async function listarVinculosUsuarios() {
    const lista = [];

    try {
        const firestorePromise = (async () => {
            const snap = await getDocs(collection(db, "usuarios_protheus"));
            snap.forEach(d => {
                lista.push({ id: d.id, ...d.data() });
            });
            return lista;
        })();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 2500));
        await Promise.race([firestorePromise, timeoutPromise]);
    } catch (e) {
        console.warn("Falha ao buscar vínculos do Firestore:", e);
    }

    // Adiciona vínculos iniciais como base
    Object.entries(VINCULOS_INICIAIS).forEach(([email, data]) => {
        if (!lista.some(item => item.email === email)) {
            lista.push({
                id: email,
                email: email,
                protheus: data.protheus,
                nome: data.nome,
                filial: data.filial,
                cargo: data.cargo,
                isBaseInicial: true
            });
        }
    });

    AdminState.vinculosUsuarios = lista;
    return lista;
}

/**
 * Carrega todas as solicitações registradas no sistema
 */
export async function carregarTodasSolicitacoes() {
    const lista = [];
    try {
        const firestorePromise = (async () => {
            const snap = await getDocs(collection(db, "solicitacoes_devolucao"));
            snap.forEach(d => {
                lista.push({ id: d.id, ...d.data() });
            });
            return lista;
        })();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 2500));
        await Promise.race([firestorePromise, timeoutPromise]);
    } catch (e) {
        console.warn("Falha ao buscar todas solicitações do Firestore:", e);
    }

    // Inclui locais
    try {
        const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        localDevolucoes.forEach(loc => {
            if (!lista.some(item => item.protocolo === loc.protocolo)) {
                lista.push(loc);
            }
        });
    } catch (e) {}

    lista.sort((a, b) => new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0));
    AdminState.todasSolicitacoes = lista;
    return lista;
}
