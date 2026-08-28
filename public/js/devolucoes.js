/**
 * Módulo de Fluxo de Solicitação de Devoluções
 */
import { AuthState } from "./auth.js";
import { buscarAtivosPorProtheus, gravarSolicitacaoNoFirestore, atualizarSolicitacaoNoFirestore } from "./api.js";
import { FILIAIS_BRASPRESS } from "./config.js";

export const DevolucaoState = {
    etapaAtual: 1, // 1: Itens, 2: Volumes, 3: Logística, 4: Resumo, 5: Sucesso
    itensDisponiveis: [],
    itensSelecionados: new Map(), // id -> { item, quantidadeDevolvida }
    filtroTexto: "",
    idEmEdicao: null, // ID do documento caso esteja editando
    protocoloEmEdicao: null, // Protocolo original caso esteja editando
    volumes: {
        quantidadeCaixas: 1,
        pesoAproximadoKg: "",
        observacoesEmbalagem: ""
    },
    logistica: {
        tipo: "braspress", // 'braspress' ou 'transportadora_regional'
        filialBraspress: "São Paulo - Matriz/Vila Maria (SP)",
        filialOutraTexto: "",
        transportadoraRegional: {
            nome: "",
            telefone: "",
            cidade: "",
            uf: "",
            contato: ""
        },
        motivoEscolhaRegional: ""
    },
    observacoesGerais: "",
    carregando: false,
    solicitacaoConcluida: null
};

/**
 * Inicializa e carrega os itens do colaborador logado
 */
export async function carregarItensDoUsuario() {
    if (!AuthState.profile || !AuthState.profile.protheus) return;

    DevolucaoState.carregando = true;
    DevolucaoState.itensSelecionados.clear();
    DevolucaoState.etapaAtual = 1;
    DevolucaoState.solicitacaoConcluida = null;

    try {
        const itens = await buscarAtivosPorProtheus(AuthState.profile.protheus, AuthState.profile.email);
        DevolucaoState.itensDisponiveis = itens || [];
    } catch (err) {
        console.error("Erro ao carregar itens:", err);
        DevolucaoState.itensDisponiveis = [];
    } finally {
        DevolucaoState.carregando = false;
    }
}

/**
 * Carrega uma solicitação existente para modo de edição completo
 */
export async function carregarSolicitacaoParaEdicao(sol) {
    DevolucaoState.idEmEdicao = sol.id || sol.protocolo;
    DevolucaoState.protocoloEmEdicao = sol.protocolo;
    DevolucaoState.etapaAtual = 1;
    DevolucaoState.solicitacaoConcluida = null;

    // 1. Carrega os itens do usuário no Firestore primeiro
    await carregarItensDoUsuario();

    // 2. Popula itensSelecionados e garante presença na lista disponível
    DevolucaoState.itensSelecionados.clear();
    if (Array.isArray(sol.itens)) {
        sol.itens.forEach(it => {
            const cod = it.codigoItem || it.produto || "";
            const nf = it.notaFiscal || it.nfRemessa || "";
            const qtdDev = Number(it.quantidadeDevolvida || it.quantidade || 1);

            // Tenta achar correspondente na lista disponível
            let itemEncontrado = DevolucaoState.itensDisponiveis.find(disp => 
                (disp.id === it.id) || 
                ((disp.codigoItem === cod || disp.produto === cod) && (disp.notaFiscal === nf || disp.nfRemessa === nf))
            );

            if (!itemEncontrado) {
                // Se o item não estiver na lista (ex: estava com saldo 0 após submissão), adiciona como disponível
                itemEncontrado = {
                    id: it.id || `edit_${nf}_${cod}`,
                    codigoItem: cod,
                    produto: cod,
                    descricao: it.descricao || "",
                    notaFiscal: nf,
                    nfRemessa: nf,
                    pedido: it.pedido || "",
                    saldoDisponivel: qtdDev,
                    saldo: qtdDev,
                    numeroSerie: it.numeroSerie || ""
                };
                DevolucaoState.itensDisponiveis.unshift(itemEncontrado);
            } else {
                // Ajusta saldo somando a quantidade previamente reservada
                itemEncontrado.saldoDisponivel = Math.max(Number(itemEncontrado.saldoDisponivel || itemEncontrado.saldo || 0), qtdDev);
            }

            DevolucaoState.itensSelecionados.set(itemEncontrado.id, {
                ...itemEncontrado,
                quantidadeDevolvida: qtdDev
            });
        });
    }

    // 3. Popula volumes
    DevolucaoState.volumes = {
        quantidadeCaixas: Number(sol.volumes?.quantidadeCaixas || 1),
        pesoAproximadoKg: sol.volumes?.pesoAproximadoKg || "",
        observacoesEmbalagem: sol.volumes?.observacoesEmbalagem || ""
    };

    // 4. Popula logística
    DevolucaoState.logistica = {
        tipo: sol.logistica?.tipo || "braspress",
        filialBraspress: sol.logistica?.filialBraspress || "São Paulo - Matriz/Vila Maria (SP)",
        filialOutraTexto: "",
        transportadoraRegional: {
            nome: sol.logistica?.transportadoraRegional?.nome || "",
            telefone: sol.logistica?.transportadoraRegional?.telefone || "",
            cidade: sol.logistica?.transportadoraRegional?.cidade || sol.logistica?.cidadeOrigem || "",
            uf: sol.logistica?.transportadoraRegional?.uf || sol.logistica?.ufOrigem || "",
            contato: sol.logistica?.transportadoraRegional?.contato || ""
        },
        motivoEscolhaRegional: sol.logistica?.motivoEscolhaRegional || ""
    };

    // 5. Observações gerais
    DevolucaoState.observacoesGerais = sol.observacoesGerais || "";
}

/**
 * Alterna a seleção de um item
 */
export function toggleItemSelecao(item, selecionado, qtd = 1) {
    if (selecionado) {
        DevolucaoState.itensSelecionados.set(item.id, {
            ...item,
            quantidadeDevolvida: Math.min(qtd, item.saldoDisponivel || 1)
        });
    } else {
        DevolucaoState.itensSelecionados.delete(item.id);
    }
}

/**
 * Atualiza quantidade a devolver de um item selecionado
 */
export function atualizarQuantidadeItem(itemId, novaQtd) {
    if (DevolucaoState.itensSelecionados.has(itemId)) {
        const item = DevolucaoState.itensSelecionados.get(itemId);
        const qtdNumerica = Math.max(1, Math.min(Number(novaQtd), item.saldoDisponivel || 1));
        item.quantidadeDevolvida = qtdNumerica;
        DevolucaoState.itensSelecionados.set(itemId, item);
    }
}

/**
 * Valida a etapa atual antes de avançar
 */
export function validarEtapa(etapa) {
    if (etapa === 1) {
        if (DevolucaoState.itensSelecionados.size === 0) {
            return { valido: false, mensagem: "Selecione ao menos 1 item/máquina para devolução." };
        }
        return { valido: true };
    }

    if (etapa === 2) {
        const caixas = Number(DevolucaoState.volumes.quantidadeCaixas);
        if (!caixas || caixas < 1) {
            return { valido: false, mensagem: "Informe uma quantidade válida de volumes/caixas (mínimo 1)." };
        }
        return { valido: true };
    }

    if (etapa === 3) {
        if (DevolucaoState.logistica.tipo === "braspress") {
            if (!DevolucaoState.logistica.filialBraspress && !DevolucaoState.logistica.filialOutraTexto) {
                return { valido: false, mensagem: "Selecione ou informe a filial Braspress para retirada." };
            }
        } else if (DevolucaoState.logistica.tipo === "transportadora_regional") {
            const reg = DevolucaoState.logistica.transportadoraRegional;
            if (!reg.nome || reg.nome.trim().length < 2) {
                return { valido: false, mensagem: "Informe o nome/razão social da transportadora regional." };
            }
            if (!reg.cidade || !reg.uf) {
                return { valido: false, mensagem: "Informe a cidade e UF da base da transportadora." };
            }
        }
        return { valido: true };
    }

    return { valido: true };
}

/**
 * Avança para a próxima etapa
 */
export function avancarEtapa() {
    const validacao = validarEtapa(DevolucaoState.etapaAtual);
    if (!validacao.valido) {
        return validacao;
    }
    if (DevolucaoState.etapaAtual < 4) {
        DevolucaoState.etapaAtual += 1;
    }
    return { valido: true };
}

/**
 * Volta para a etapa anterior
 */
export function voltarEtapa() {
    if (DevolucaoState.etapaAtual > 1) {
        DevolucaoState.etapaAtual -= 1;
    }
}

/**
 * Envia a solicitação final para o Firestore (criação ou atualização)
 */
export async function confirmarEGravarSolicitacao() {
    if (DevolucaoState.itensSelecionados.size === 0) {
        throw new Error("Nenhum item selecionado.");
    }

    const payload = {
        solicitante: {
            email: AuthState.profile.email,
            nome: AuthState.profile.nome,
            protheus: AuthState.profile.protheus,
            filial: AuthState.profile.filial,
            cargo: AuthState.profile.cargo
        },
        itens: Array.from(DevolucaoState.itensSelecionados.values()),
        volumes: {
            quantidadeCaixas: Number(DevolucaoState.volumes.quantidadeCaixas),
            pesoAproximadoKg: DevolucaoState.volumes.pesoAproximadoKg || null,
            observacoesEmbalagem: DevolucaoState.volumes.observacoesEmbalagem || ""
        },
        logistica: {
            tipo: DevolucaoState.logistica.tipo,
            filialBraspress: DevolucaoState.logistica.tipo === "braspress" ? 
                (DevolucaoState.logistica.filialBraspress === "outra" ? DevolucaoState.logistica.filialOutraTexto : DevolucaoState.logistica.filialBraspress) : null,
            transportadoraRegional: DevolucaoState.logistica.tipo === "transportadora_regional" ? DevolucaoState.logistica.transportadoraRegional : null,
            motivoEscolhaRegional: DevolucaoState.logistica.motivoEscolhaRegional || "",
            cidadeOrigem: DevolucaoState.logistica.transportadoraRegional.cidade || "",
            ufOrigem: DevolucaoState.logistica.transportadoraRegional.uf || ""
        },
        observacoesGerais: DevolucaoState.observacoesGerais || ""
    };

    let resultado;
    if (DevolucaoState.idEmEdicao) {
        resultado = await atualizarSolicitacaoNoFirestore(DevolucaoState.idEmEdicao, {
            ...payload,
            protocolo: DevolucaoState.protocoloEmEdicao
        });
    } else {
        resultado = await gravarSolicitacaoNoFirestore(payload);
    }

    DevolucaoState.solicitacaoConcluida = resultado;
    return resultado;
}

/**
 * Reinicia o fluxo para nova solicitação
 */
export function reiniciarFluxoDevolucao() {
    DevolucaoState.etapaAtual = 1;
    DevolucaoState.idEmEdicao = null;
    DevolucaoState.protocoloEmEdicao = null;
    DevolucaoState.itensSelecionados.clear();
    DevolucaoState.volumes = {
        quantidadeCaixas: 1,
        pesoAproximadoKg: "",
        observacoesEmbalagem: ""
    };
    DevolucaoState.logistica = {
        tipo: "braspress",
        filialBraspress: "São Paulo - Matriz/Vila Maria (SP)",
        filialOutraTexto: "",
        transportadoraRegional: {
            nome: "",
            telefone: "",
            cidade: "",
            uf: "",
            contato: ""
        },
        motivoEscolhaRegional: ""
    };
    DevolucaoState.observacoesGerais = "";
    DevolucaoState.solicitacaoConcluida = null;
}
