/**
 * Módulo de Administração — Importador Direto do Excel e Vínculos Protheus
 */
import { AuthState } from "./auth.js";
import { db, doc, setDoc, collection, getDocs, addDoc, serverTimestamp, writeBatch } from "./firebase.js";
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
        const snap = await getDocs(collection(db, "solicitacoes_devolucao"));
        snap.forEach(d => {
            lista.push({ id: d.id, ...d.data() });
        });
        console.log(`[Admin] Sucesso: ${lista.length} solicitações carregadas do Firestore.`);
    } catch (e) {
        console.warn("Falha ao buscar todas solicitações do Firestore:", e);
    }

    // Inclui locais (fallback de contingência)
    try {
        const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        localDevolucoes.forEach(loc => {
            if (!lista.some(item => (loc.protocolo && item.protocolo === loc.protocolo) || item.id === loc.id)) {
                lista.push(loc);
            }
        });
    } catch (e) {}

    lista.sort((a, b) => new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0));
    AdminState.todasSolicitacoes = lista;
    return lista;
}

/**
 * Cadastra um novo promotor na coleção usuarios_app e atualiza todas as NF-e órfãs
 * que subiram com e-mail fictício ({codigoProtheus}@makita.com.br)
 */
export async function cadastrarPromotorComSyncNfe({ codigoProtheus, emailReal, senha }) {
    const protheus = String(codigoProtheus || "").trim();
    const email = String(emailReal || "").toLowerCase().trim();
    const password = String(senha || "").trim();

    if (!protheus) throw new Error("Informe o código Protheus do promotor.");
    if (!email || !email.includes("@")) throw new Error("Informe um e-mail corporativo válido.");
    if (!password || password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");

    // Ação A: Salvar na coleção usuarios_app
    const userDocRef = doc(db, "usuarios_app", protheus);
    await setDoc(userDocRef, {
        codigoProtheus: protheus,
        email: email,
        senha: password,
        ativo: true,
        dataCadastro: serverTimestamp(),
        cadastradoPor: AuthState.profile?.email || "admin"
    }, { merge: true });

    // Também sincroniza em usuarios_protheus para compatibilidade total com o login web
    try {
        const vinculoWebRef = doc(db, "usuarios_protheus", email);
        await setDoc(vinculoWebRef, {
            protheus: protheus,
            email: email,
            nome: email.split("@")[0].replace(/[._-]/g, " "),
            cargo: "Promotor Técnico",
            filial: "01 - Matriz",
            isAdmin: false,
            atualizadoEm: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.warn("Aviso: Falha ao sincronizar em usuarios_protheus:", e);
    }

    // Ação B: Atualização em lote (batch) das NF-e em promotores/{protheus}/nfe_disponiveis/
    let totalAtualizadas = 0;
    try {
        const subcolRef = collection(db, "promotores", protheus, "nfe_disponiveis");
        const snap = await getDocs(subcolRef);

        if (!snap.empty) {
            const batch = writeBatch(db);
            snap.forEach(docSnap => {
                const data = docSnap.data();
                // Atualiza se o e-mail for fictício ou diferente do e-mail real
                if (data.emailUsuario !== email) {
                    batch.update(docSnap.ref, {
                        emailUsuario: email,
                        atualizadoEm: serverTimestamp()
                    });
                    totalAtualizadas++;
                }
            });

            if (totalAtualizadas > 0) {
                await batch.commit();
            }
        }
    } catch (e) {
        console.error("Erro ao atualizar NF-e órfãs:", e);
    }

    return {
        sucesso: true,
        protheus: protheus,
        email: email,
        notasAtualizadas: totalAtualizadas
    };
}
