/**
 * Módulo de API — Consulta de Itens/Ativos Protheus e Persistência no Firestore
 */
import { GOOGLE_APPS_SCRIPT_URL, MOCK_ATIVOS_PROTHEUS } from "./config.js";
import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    arrayUnion
} from "./firebase.js";

/**
 * Definição dos 4 Estados Oficiais de Status da Devolução
 */
export const STATUS_DEVOLUCAO = {
    pendente: {
        key: "pendente",
        label: "Pendente Análise",
        descricao: "Aguardando análise do setor administrativo",
        badgeClass: "badge-pendente",
        dotClass: "bg-amber-500",
        icon: "fa-solid fa-hourglass-half",
        iconColor: "text-slate-500"
    },
    emissao_fiscal: {
        key: "emissao_fiscal",
        label: "Emissão Fiscal",
        descricao: "Iniciando Emissão Fiscal — aguardando emissão da CC-e e NF-e",
        badgeClass: "badge-aprovado",
        dotClass: "bg-blue-500",
        icon: "fa-solid fa-file-invoice-dollar",
        iconColor: "text-slate-500"
    },
    brasspress: {
        key: "brasspress",
        label: "Enviado Brasspress",
        descricao: "Solicitação enviada à Brasspress",
        badgeClass: "badge-brasspress",
        dotClass: "bg-purple-500",
        icon: "fa-solid fa-truck-fast",
        iconColor: "text-slate-500"
    },
    protocolo_emitido: {
        key: "protocolo_emitido",
        label: "Protocolo Emitido",
        descricao: "Brasspress gerou o protocolo — devolução pronta para entrega",
        badgeClass: "badge-emitido",
        dotClass: "bg-emerald-500",
        icon: "fa-solid fa-circle-check",
        iconColor: "text-slate-500"
    }
};

export function normalizarStatus(statusRaw) {
    if (!statusRaw) return STATUS_DEVOLUCAO.pendente;
    const s = String(statusRaw).toLowerCase().trim();
    if (s === "pendente" || s.includes("pendente") || s.includes("analise")) return STATUS_DEVOLUCAO.pendente;
    if (s === "emissao_fiscal" || s.includes("fiscal") || s.includes("emissao")) return STATUS_DEVOLUCAO.emissao_fiscal;
    if (s === "brasspress" || s.includes("brasspress") || s.includes("enviad")) return STATUS_DEVOLUCAO.brasspress;
    if (s === "protocolo_emitido" || s.includes("protocolo") || s.includes("conclu") || s.includes("emitido")) return STATUS_DEVOLUCAO.protocolo_emitido;
    return STATUS_DEVOLUCAO.pendente;
}

/**
 * Consulta os ativos disponíveis para devolução com base no código Protheus
 */
export async function buscarAtivosPorProtheus(protheusCode, emailUser = "") {
    const code = String(protheusCode || "").replace(/\.0$/, "").trim();
    const emailNorm = String(emailUser || "").toLowerCase().trim();
    if (!code && !emailNorm) return [];

    console.log(`[buscarAtivosPorProtheus] Buscando NFes para Protheus '${code}' | E-mail: '${emailNorm}'...`);

    // 1. Consulta Primária ao Firestore (Direta e sem bloqueios)
    try {
        let docsList = [];

        // 1a. Busca em /promotores/{code}/nfe_disponiveis
        if (code) {
            try {
                const subcolRef1 = collection(db, "promotores", code, "nfe_disponiveis");
                const snap1 = await getDocs(subcolRef1);
                if (!snap1.empty) {
                    docsList = snap1.docs;
                    console.log(`[Firestore Query] Encontrados ${docsList.length} documentos em /promotores/${code}/nfe_disponiveis!`);
                }
            } catch (e) {
                console.warn(`[Firestore Query Warning] /promotores/${code}/nfe_disponiveis:`, e.message);
            }
        }

        // 1b. Busca em /promotores/{emailNorm}/nfe_disponiveis
        if (docsList.length === 0 && emailNorm) {
            try {
                const subcolRef2 = collection(db, "promotores", emailNorm, "nfe_disponiveis");
                const snap2 = await getDocs(subcolRef2);
                if (!snap2.empty) {
                    docsList = snap2.docs;
                    console.log(`[Firestore Query] Encontrados ${docsList.length} documentos em /promotores/${emailNorm}/nfe_disponiveis!`);
                }
            } catch (e) {
                console.warn(`[Firestore Query Warning] /promotores/${emailNorm}/nfe_disponiveis:`, e.message);
            }
        }

        // 1c. Busca na coleção raiz nfe_disponiveis por codigoCliente
        if (docsList.length === 0 && code) {
            try {
                let q1 = query(collection(db, "nfe_disponiveis"), where("codigoCliente", "==", code));
                let snap3 = await getDocs(q1);
                if (snap3.empty) {
                    q1 = query(collection(db, "nfe_disponiveis"), where("codigoProtheus", "==", code));
                    snap3 = await getDocs(q1);
                }
                if (!snap3.empty) {
                    docsList = snap3.docs;
                    console.log(`[Firestore Query] Encontrados ${docsList.length} documentos na raiz nfe_disponiveis por código ${code}!`);
                }
            } catch (e) {
                console.warn(`[Firestore Query Warning] nfe_disponiveis por código ${code}:`, e.message);
            }
        }

        // 1d. Busca na coleção raiz nfe_disponiveis por emailUsuario
        if (docsList.length === 0 && emailNorm) {
            try {
                let q2 = query(collection(db, "nfe_disponiveis"), where("emailUsuario", "==", emailNorm));
                let snap4 = await getDocs(q2);
                if (snap4.empty) {
                    q2 = query(collection(db, "nfe_disponiveis"), where("email", "==", emailNorm));
                    snap4 = await getDocs(q2);
                }
                if (!snap4.empty) {
                    docsList = snap4.docs;
                    console.log(`[Firestore Query] Encontrados ${docsList.length} documentos na raiz nfe_disponiveis por e-mail ${emailNorm}!`);
                }
            } catch (e) {
                console.warn(`[Firestore Query Warning] nfe_disponiveis por e-mail ${emailNorm}:`, e.message);
            }
        }

        // 1e. Busca na coleção ativos_saldo por protheus
        if (docsList.length === 0 && code) {
            try {
                const q3 = query(collection(db, "ativos_saldo"), where("protheus", "==", code));
                const snap5 = await getDocs(q3);
                if (!snap5.empty) {
                    docsList = snap5.docs;
                    console.log(`[Firestore Query] Encontrados ${docsList.length} documentos na coleção ativos_saldo por protheus ${code}!`);
                }
            } catch (e) {
                console.warn(`[Firestore Query Warning] ativos_saldo:`, e.message);
            }
        }

        if (docsList.length > 0) {
            const itens = [];
            docsList.forEach(docSnap => {
                const d = docSnap.data();

                const dateObj = d.dataEmissao?.toDate ? d.dataEmissao.toDate() : (d.dataEmissao ? new Date(d.dataEmissao) : null);
                const dateStr = dateObj ? dateObj.toLocaleDateString('pt-BR') : (d.dataEnvioOriginal || d.dataEmissaoStr || "—");

                const nfRemessaVal     = d.nfRemessa || d.numeroNfe || d.notaFiscal || d.nfe || d.numeroNota || d.nf || docSnap.id;
                const codigoClienteVal = d.codigoCliente || d.codCliente || d.clienteId || d.codClienteProtheus || code || "—";
                const nomeClienteVal   = d.nomeCliente || d.cliente || d.razaoSocial || d.nomeFantasia || d.destino || "Cliente não informado";
                const produtoVal       = d.produto || d.codigoItem || d.codProduto || d.codigo || d.item || d.sku || "—";
                const descricaoVal     = d.descricao || d.descProduto || d.descricaoItem || d.nomeProduto || "—";
                const saldoVal         = Number(d.saldo !== undefined ? d.saldo : (d.saldoDisponivel !== undefined ? d.saldoDisponivel : (d.quantidade !== undefined ? d.quantidade : 1)));
                const pedidoVal        = d.pedido || d.numeroPedido || d.numPedido || "Poder de Terceiros";
                const grupoLinhaVal    = d.grupoLinha || d.grupo || "01";
                const descGrpLinhaVal  = d.descGrpLinha || d.descGrupo || "Máquinas / Acessórios";

                itens.push({
                    id: docSnap.id,
                    nfRemessa: nfRemessaVal,
                    codigoCliente: codigoClienteVal,
                    nomeCliente: nomeClienteVal,
                    produto: produtoVal,
                    descricao: descricaoVal,
                    saldo: saldoVal,
                    pedido: pedidoVal,
                    notaFiscal: nfRemessaVal,
                    codigoItem: produtoVal,
                    saldoDisponivel: saldoVal,
                    numeroSerie: d.numeroSerie || d.serie || "",
                    dataEnvioOriginal: dateStr,
                    grupoLinha: grupoLinhaVal,
                    descGrpLinha: descGrpLinhaVal,
                    status: d.status || "Disponível"
                });
            });

            console.log(`[Firestore Live] Sucesso: ${itens.length} NFes processadas para Protheus '${code}'`);
            return itens;
        }
    } catch (err) {
        console.warn("Consulta Firestore falhou:", err.message);
    }

    // 2. Fallback via Google Apps Script (apenas se Firestore estiver vazio)
    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL.startsWith("https://script.google.com")) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const url = `${GOOGLE_APPS_SCRIPT_URL}?protheus=${encodeURIComponent(code)}&email=${encodeURIComponent(emailNorm)}&action=buscar_ativos`;
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const data = await resp.json();
                if (data && Array.isArray(data.itens) && data.itens.length > 0) {
                    return formatarItensRetornados(data.itens);
                }
            }
        } catch (err) {
            console.warn("Apps Script indisponível:", err.message);
        }
    }

    return [];
}

/**
 * Normaliza e formata itens vindos do Google Apps Script
 */
function formatarItensRetornados(itensBrutos) {
    return itensBrutos.map((item, index) => ({
        id: item.id || `gas_${index + 1}`,
        codigoItem: String(item.codigoItem || item.codigo || item[0] || "").trim(),
        descricao: String(item.descricao || item.nome || item[1] || "").trim(),
        notaFiscal: String(item.notaFiscal || item.nf || item[2] || "").trim(),
        pedido: String(item.pedido || item.numPedido || item[3] || "").trim(),
        saldoDisponivel: Number(item.saldoDisponivel || item.saldo || item.qtd || item[4] || 1),
        numeroSerie: String(item.numeroSerie || item.serie || item[5] || "").trim(),
        dataEnvioOriginal: String(item.dataEnvioOriginal || item[6] || "").trim()
    }));
}

/**
 * Grava a solicitação confirmada no Firestore
 */
export async function gravarSolicitacaoNoFirestore(payload) {
    const anoAtual = new Date().getFullYear();
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const protocolo = `DEV-${anoAtual}-${randomHex}`;

    const documentoParaGravar = {
        protocolo: protocolo,
        dataCriacao: new Date().toISOString(),
        criadoEm: serverTimestamp(),
        status: "pendente", // Status inicial oficial
        historico_status: [
            {
                status: "pendente",
                statusLabel: "Pendente Análise",
                alteradoPor: payload.solicitante?.email || "Promotor",
                dataAlteracao: new Date().toISOString()
            }
        ],
        statusFiscal: "Aguardando Emissão NF-e / CC-e",
        solicitante: {
            email: payload.solicitante.email,
            nome: payload.solicitante.nome,
            protheus: payload.solicitante.protheus,
            filial: payload.solicitante.filial || "01 - Matriz",
            cargo: payload.solicitante.cargo || "Promotor Técnico"
        },
        itens: payload.itens.map(it => ({
            id: it.id,
            codigoItem: it.codigoItem,
            descricao: it.descricao,
            notaFiscal: it.notaFiscal,
            pedido: it.pedido,
            quantidadeDevolvida: Number(it.quantidadeDevolvida || 1),
            numeroSerie: it.numeroSerie || ""
        })),
        totalItens: payload.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0),
        volumes: {
            quantidadeCaixas: Number(payload.volumes.quantidadeCaixas),
            pesoAproximadoKg: payload.volumes.pesoAproximadoKg ? Number(payload.volumes.pesoAproximadoKg) : null,
            observacoesEmbalagem: payload.volumes.observacoesEmbalagem || ""
        },
        logistica: {
            tipo: payload.logistica.tipo, // 'braspress' ou 'transportadora_regional'
            filialBraspress: payload.logistica.filialBraspress || null,
            transportadoraRegional: payload.logistica.transportadoraRegional || null,
            motivoEscolhaRegional: payload.logistica.motivoEscolhaRegional || "",
            cidadeOrigem: payload.logistica.cidadeOrigem || "",
            ufOrigem: payload.logistica.ufOrigem || ""
        },
        observacoesGerais: payload.observacoesGerais || "",
        avisoFiscalConfirmado: true
    };

    try {
        const docRef = await addDoc(collection(db, "solicitacoes_devolucao"), documentoParaGravar);
        return {
            success: true,
            id: docRef.id,
            protocolo: protocolo,
            dados: documentoParaGravar
        };
    } catch (err) {
        console.error("Erro ao gravar solicitação no Firestore:", err);
        // Fallback local se estiver sem conexão com Firestore
        const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        localDevolucoes.unshift({ ...documentoParaGravar, id: "local_" + Date.now() });
        localStorage.setItem("makita_devolucoes_locais", JSON.stringify(localDevolucoes));

        return {
            success: true,
            id: "local_" + Date.now(),
            protocolo: protocolo,
            dados: documentoParaGravar,
            isLocalFallback: true
        };
    }
}

/**
 * Atualiza uma solicitação de devolução existente no Firestore (Edição de Itens, Volumes, Logística, etc.)
 */
export async function atualizarSolicitacaoNoFirestore(id, payload) {
    const documentoParaAtualizar = {
        ultimaAtualizacao: new Date().toISOString(),
        atualizadoEm: serverTimestamp(),
        solicitante: {
            email: payload.solicitante.email,
            nome: payload.solicitante.nome,
            protheus: payload.solicitante.protheus,
            filial: payload.solicitante.filial || "01 - Matriz",
            cargo: payload.solicitante.cargo || "Promotor Técnico"
        },
        itens: payload.itens.map(it => ({
            id: it.id || `${it.notaFiscal}_${it.codigoItem}`,
            codigoItem: it.codigoItem || it.produto || "",
            descricao: it.descricao || "",
            notaFiscal: it.notaFiscal || it.nfRemessa || "",
            pedido: it.pedido || "",
            quantidadeDevolvida: Number(it.quantidadeDevolvida || 1),
            numeroSerie: it.numeroSerie || ""
        })),
        totalItens: payload.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0),
        volumes: {
            quantidadeCaixas: Number(payload.volumes.quantidadeCaixas),
            pesoAproximadoKg: payload.volumes.pesoAproximadoKg ? Number(payload.volumes.pesoAproximadoKg) : null,
            observacoesEmbalagem: payload.volumes.observacoesEmbalagem || ""
        },
        logistica: {
            tipo: payload.logistica.tipo,
            filialBraspress: payload.logistica.filialBraspress || null,
            transportadoraRegional: payload.logistica.transportadoraRegional || null,
            motivoEscolhaRegional: payload.logistica.motivoEscolhaRegional || "",
            cidadeOrigem: payload.logistica.cidadeOrigem || "",
            ufOrigem: payload.logistica.ufOrigem || ""
        },
        observacoesGerais: payload.observacoesGerais || ""
    };

    try {
        if (!String(id).startsWith("local_")) {
            const docRef = doc(db, "solicitacoes_devolucao", id);
            await updateDoc(docRef, documentoParaAtualizar);
        }

        // Atualiza também no localStorage caso exista
        const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        const index = localDevolucoes.findIndex(s => s.id === id || s.protocolo === id || s.protocolo === payload.protocolo);
        if (index !== -1) {
            localDevolucoes[index] = { ...localDevolucoes[index], ...documentoParaAtualizar };
            localStorage.setItem("makita_devolucoes_locais", JSON.stringify(localDevolucoes));
        }

        return {
            success: true,
            id: id,
            protocolo: payload.protocolo,
            dados: documentoParaAtualizar
        };
    } catch (err) {
        console.error("Erro ao atualizar solicitação no Firestore:", err);
        throw err;
    }
}

/**
 * Busca histórico de solicitações do usuário logado
 */
export async function buscarHistoricoSolicitacoes(protheusCode, email) {
    const lista = [];

    try {
        const firestorePromise = (async () => {
            const q = query(
                collection(db, "solicitacoes_devolucao"),
                where("solicitante.protheus", "==", String(protheusCode).trim())
            );
            const snap = await getDocs(q);
            snap.forEach(d => {
                lista.push({ id: d.id, ...d.data() });
            });
            return lista;
        })();
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 2500));
        await Promise.race([firestorePromise, timeoutPromise]);
    } catch (err) {
        console.warn("Erro ao buscar histórico do Firestore:", err);
    }

    // Inclui histórico local (caso tenha fallback)
    const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
    localDevolucoes.forEach(loc => {
        if (loc.solicitante && loc.solicitante.protheus === String(protheusCode)) {
            if (!lista.some(item => item.protocolo === loc.protocolo)) {
                lista.push(loc);
            }
        }
    });

    // Ordena por data mais recente
    lista.sort((a, b) => new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0));
    return lista;
}

/**
 * Atualiza o status de uma solicitação no Firestore e registra o histórico de alteração
 */
export async function atualizarStatusSolicitacao(docIdOuProtocolo, novoStatusKey, adminEmail) {
    const statusObj = STATUS_DEVOLUCAO[novoStatusKey] || STATUS_DEVOLUCAO.pendente;
    const historicoEntry = {
        status: statusObj.key,
        statusLabel: statusObj.label,
        alteradoPor: adminEmail || "Administrador",
        dataAlteracao: new Date().toISOString()
    };

    let atualizouFirestore = false;

    // 1. Se for docId direto no Firestore
    try {
        if (docIdOuProtocolo && !String(docIdOuProtocolo).startsWith("local_")) {
            const docRef = doc(db, "solicitacoes_devolucao", String(docIdOuProtocolo));
            await updateDoc(docRef, {
                status: statusObj.key,
                historico_status: arrayUnion(historicoEntry),
                atualizadoEm: serverTimestamp()
            });
            atualizouFirestore = true;
        }
    } catch (e) {
        console.warn("Tentando atualizar por número de protocolo...", e);
    }

    // 2. Se não atualizou por docId, busca pelo número de protocolo no Firestore
    if (!atualizouFirestore) {
        try {
            const q = query(collection(db, "solicitacoes_devolucao"), where("protocolo", "==", String(docIdOuProtocolo)));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const dRef = snap.docs[0].ref;
                await updateDoc(dRef, {
                    status: statusObj.key,
                    historico_status: arrayUnion(historicoEntry),
                    atualizadoEm: serverTimestamp()
                });
                atualizouFirestore = true;
            }
        } catch (err) {
            console.error("Erro ao buscar/atualizar por protocolo no Firestore:", err);
        }
    }

    // 3. Atualiza no cache local (localStorage) como fallback resiliente
    try {
        const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        const idx = localDevolucoes.findIndex(s => s.id === docIdOuProtocolo || s.protocolo === docIdOuProtocolo);
        if (idx !== -1) {
            localDevolucoes[idx].status = statusObj.key;
            if (!localDevolucoes[idx].historico_status) localDevolucoes[idx].historico_status = [];
            localDevolucoes[idx].historico_status.push(historicoEntry);
            localStorage.setItem("makita_devolucoes_locais", JSON.stringify(localDevolucoes));
        }
    } catch (e) {
        console.warn("Erro ao atualizar localStorage:", e);
    }

    return {
        success: true,
        novoStatus: statusObj.key,
        statusObj: statusObj,
        historicoEntry: historicoEntry
    };
}

/**
 * Exclui permanentemente uma solicitação de devolução
 */
export async function excluirSolicitacao(docIdOuProtocolo) {
    if (!docIdOuProtocolo) throw new Error("ID ou Protocolo da solicitação não informado.");

    let excluiuFirestore = false;

    // 1. Tenta excluir por docId direto
    try {
        const docRef = doc(db, "solicitacoes_devolucao", String(docIdOuProtocolo));
        await deleteDoc(docRef);
        excluiuFirestore = true;
    } catch (e) {
        console.warn("Tentando excluir por protocolo no Firestore...", e);
    }

    // 2. Se não excluiu por docId, busca pelo protocolo
    if (!excluiuFirestore) {
        try {
            const q = query(collection(db, "solicitacoes_devolucao"), where("protocolo", "==", String(docIdOuProtocolo)));
            const snap = await getDocs(q);
            if (!snap.empty) {
                for (const d of snap.docs) {
                    await deleteDoc(d.ref);
                }
                excluiuFirestore = true;
            }
        } catch (err) {
            console.error("Erro ao excluir documento por protocolo no Firestore:", err);
        }
    }

    // 3. Remove do localStorage local
    try {
        const localDevolucoes = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        const filtradas = localDevolucoes.filter(s => s.id !== docIdOuProtocolo && s.protocolo !== docIdOuProtocolo);
        localStorage.setItem("makita_devolucoes_locais", JSON.stringify(filtradas));
    } catch (e) {
        console.warn("Erro ao atualizar localStorage:", e);
    }

    return { success: true };
}
