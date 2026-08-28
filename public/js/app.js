/**
 * Orquestrador Principal do Sistema de Devoluções — Makita do Brasil
 */
import { 
    AuthState, 
    subscribeAuth, 
    loginComGoogle, 
    simularLogin, 
    buscarVinculoProtheus,
    fazerLogout,
    inicializarAuth
} from "./auth.js";

import { 
    DevolucaoState, 
    carregarItensDoUsuario, 
    toggleItemSelecao, 
    atualizarQuantidadeItem, 
    avancarEtapa, 
    voltarEtapa, 
    confirmarEGravarSolicitacao, 
    reiniciarFluxoDevolucao 
} from "./devolucoes.js";

import { 
    HistoricoState, 
    carregarHistorico, 
    getStatusBadge 
} from "./historico.js";

import { 
    AdminState, 
    processarArquivoExcel,
    processarTextoCopiadoDoExcel, 
    salvarBaseExcelNoFirestore, 
    cadastrarVinculoUsuario, 
    listarVinculosUsuarios, 
    carregarTodasSolicitacoes 
} from "./admin.js";

import { 
    STATUS_DEVOLUCAO, 
    normalizarStatus, 
    atualizarStatusSolicitacao,
    excluirSolicitacao 
} from "./api.js";

import { BRASPRESS_FILIAIS, buscarFilialBraspressPorCEP } from "./braspress.js";

// Helper de Toast Padronizado Makita
export function showToast(mensagem, tipo = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-msg ${tipo}`;

    toast.innerHTML = `
        <i class="fa-solid fa-circle-info toast-icon text-[#008497] text-base shrink-0 mt-0.5"></i>
        <div class="flex-1 toast-text text-[#00454A] text-xs font-semibold leading-snug">${mensagem}</div>
        <button class="text-slate-400 hover:text-slate-600 text-xs ml-2 cursor-pointer" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4500);
}

// Navegação de Abas Principais (Nova Devolução vs Histórico vs Admin)
let currentTab = "devolucao"; // 'devolucao', 'historico', 'admin', 'adm-geral'

function setTab(tab) {
    currentTab = tab;
    
    // Atualiza botões do header com as cores e estilo padrão dos projetos Makita
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.className = "nav-tab-btn flex items-center space-x-2 bg-white/30 border border-white text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer";
        } else {
            btn.className = "nav-tab-btn flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white/90 hover:text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer";
        }
    });

    // Alterna containers de visualização
    const viewDevolucao = document.getElementById("view-devolucao");
    const viewHistorico = document.getElementById("view-historico");
    const viewAdmin = document.getElementById("view-admin");
    const viewAdmGeral = document.getElementById("view-adm-geral");

    if (viewDevolucao) {
        viewDevolucao.classList.toggle("hidden", tab !== "devolucao");
        viewDevolucao.style.display = tab === "devolucao" ? "block" : "none";
    }
    if (viewHistorico) {
        viewHistorico.classList.toggle("hidden", tab !== "historico");
        viewHistorico.style.display = tab === "historico" ? "block" : "none";
    }
    if (viewAdmin) {
        viewAdmin.classList.toggle("hidden", tab !== "admin");
        viewAdmin.style.display = tab === "admin" ? "block" : "none";
    }
    if (viewAdmGeral) {
        viewAdmGeral.classList.toggle("hidden", tab !== "adm-geral");
        viewAdmGeral.style.display = tab === "adm-geral" ? "block" : "none";
    }

    if (tab === "historico") {
        renderHistorico();
    } else if (tab === "admin") {
        renderAdmin();
    } else if (tab === "adm-geral") {
        renderAdmGeralScreen();
    }
}

// Helper para formatação em PRI.MAIUSCULA (Title Case)
export function formatNomeTitleCase(nome) {
    if (!nome) return "";
    const lowerWords = new Set(["de", "da", "do", "dos", "das", "e"]);
    return nome.trim().toLowerCase().split(/\s+/).map((word, idx) => {
        if (!word) return "";
        if (idx > 0 && lowerWords.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
}

/**
 * Computa e renderiza o Mini Relatório de Ativos (KPI Cards)
 */
export function renderMiniRelatorioAtivos() {
    const itens = DevolucaoState.itensDisponiveis || [];
    
    let totalAtivos = 0;
    let totalMaquinas = 0;
    let totalBaterias = 0;
    let totalCarrKits = 0;
    let totalAcessorios = 0;

    const acessoriosGrp = new Set([
        "AC BITS", "AC OUTROS", "AC OPE", "AC LAMINAS DE SERRA", "AC DIAMANTADOS", 
        "AC SERRAS COPOS", "AC LAMINAS P/SERRA TICO-TICO,SABRE,FITA", "AC BROCAS PARA MADEIRA", 
        "AC ABRASIVOS", "AC BROCAS SDS PLUS", "AC CINZEIS", "AC FERRAMENTAS MANUAIS", 
        "AC BROCAS SDS MAX", "AC ESCOVAS DE CARVAO", "AC FLAP DISCS", "AC ESCOVAS DE ACO", 
        "AC BROCAS DE ACO RAPIDO", "AC LIXAS", "AC GRAMPOS E PINOS", "AC FACAS DE PLAINAS", 
        "AC BROCAS P/ CONCRETO", "AC FRESAS", "AC KITS"
    ]);

    const maquinasGrp = new Set([
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
    ]);

    const maquinaPrefixes = [
        "HR", "DHP", "TW", "GA", "VR", "VS", "CL", "HM", "DLS", "HS", "DUR", "HP", "DUB", "DUC", "DGP", 
        "DML", "JV", "CW", "DRC", "PS", "UA", "DTL", "BS", "MP", "AS", "M09", "DF", "DT", "TD", "JN", 
        "JS", "KP", "PJ", "RT", "RP", "SP", "UT", "UB", "UC", "UH", "UM", "UN", "UR", "UX", "VC", 
        "VV", "EB", "EG", "EK", "EW", "HW", "LC", "LW", "ML", "MS", "N19", "N37", "N59", "PK", "PW", "SK", "TL", "VT"
    ];

    const maquinaKeywords = [
        "MARTELETE", "ESMERILHADEIRA", "PARAFUSADEIRA", "FURADEIRA", "SERRA", "MARTELO", "SOPRADOR", 
        "ASPIRADOR", "ROÇADEIRA", "ELETROSERRA", "CHAVE", "AMOSTRA", "UNIDADE", "REFLETOR", "VIBRADOR", 
        "VARREDEIRA", "APLICADOR", "REFRIGERADOR", "POLIDORA", "MOTOPODA", "COMPRESSOR", "LIXADEIRA", 
        "TICO-TICO", "MOTOSSERRA", "LIMPADORA", "TESOURA", "CORTADOR", "PLAINA", "TUPIA", "FRESADORA"
    ];

    itens.forEach(item => {
        const grp = (item.descGrpLinha || item.desc_grp_linha || item.grupoLinha || item.grupo_linha || "").toUpperCase().trim();
        const prod = (item.produto || item.codigoItem || "").toUpperCase().trim();
        const desc = (item.descricao || "").toUpperCase().trim();
        const saldo = Number(item.saldo !== undefined ? item.saldo : (item.saldoDisponivel !== undefined ? item.saldoDisponivel : 1)) || 1;

        totalAtivos += saldo;

        let cat = null;

        // Regra 1: Validação direta por descGrpLinha / grupoLinha
        if (grp) {
            if (grp === "AC BATERIAS") {
                cat = "BATERIA";
            } else if (grp === "AC CARREGADORES") {
                cat = "CARREGADOR";
            } else if (acessoriosGrp.has(grp)) {
                cat = "ACESSORIO";
            } else if (maquinasGrp.has(grp)) {
                cat = "MAQUINA";
            }
        }

        // Regra 2: Fallback se grp for vazio ("") ou não cadastrado acima
        if (!cat) {
            const isCarregador = (
                prod.startsWith("DC") || prod.startsWith("191F") || prod.startsWith("1975") || prod.startsWith("1980") || prod.startsWith("ADP") ||
                desc.includes("CARREGADOR") || desc.includes("CARREG.") || desc.includes("CARREG ") || desc.includes("CHARGER") || desc.includes("KIT")
            );

            const isBateria = !isCarregador && (
                prod.startsWith("BL") || prod.startsWith("191B") || prod.startsWith("1974") || prod.startsWith("1972") || prod.startsWith("1963") || prod.startsWith("PDC") ||
                desc.startsWith("BATERIA") || desc.includes("BATERIA DE") || desc.includes("BATERIA LI-ION") || desc.includes("BATERIA LXT") || desc.includes("BATERIA XGT") || desc.includes("BAT.")
            ) && !maquinaKeywords.some(k => desc.includes(k));

            const isMaquina = !isCarregador && !isBateria && (
                prod.startsWith("SMP-") ||
                maquinaPrefixes.some(p => prod.startsWith(p)) ||
                maquinaKeywords.some(k => desc.includes(k))
            );

            if (isCarregador) cat = "CARREGADOR";
            else if (isBateria) cat = "BATERIA";
            else if (isMaquina) cat = "MAQUINA";
            else cat = "ACESSORIO";
        }

        if (cat === "CARREGADOR") totalCarrKits += saldo;
        else if (cat === "BATERIA") totalBaterias += saldo;
        else if (cat === "MAQUINA") totalMaquinas += saldo;
        else totalAcessorios += saldo;
    });

    const elTotal = document.getElementById("mini-relat-total");
    const elMaquinas = document.getElementById("mini-relat-maquinas");
    const elBaterias = document.getElementById("mini-relat-baterias");
    const elCarregadores = document.getElementById("mini-relat-carregadores");
    const elAcessorios = document.getElementById("mini-relat-acessorios");

    if (elTotal) elTotal.textContent = totalAtivos;
    if (elMaquinas) elMaquinas.textContent = totalMaquinas;
    if (elBaterias) elBaterias.textContent = totalBaterias;
    if (elCarregadores) elCarregadores.textContent = totalCarrKits;
    if (elAcessorios) elAcessorios.textContent = totalAcessorios;

    const elUserInfo = document.getElementById("mini-relat-user-info");
    if (elUserInfo && AuthState.profile) {
        const nomeTitle = formatNomeTitleCase(AuthState.profile.nome);
        elUserInfo.textContent = `${AuthState.profile.protheus} • ${nomeTitle}`;
    }
}

/**
 * Atualização Geral da Interface baseada no AuthState
 */
function updateAuthUI() {
    const loginScreen   = document.getElementById("login-screen");
    const loginLoading  = document.getElementById("login-loading");
    const blockScreen   = document.getElementById("block-screen");
    const appContainer  = document.getElementById("app-container");
    const appHeader     = document.getElementById("app-header");
    const appMain       = document.getElementById("app-main");
    const btnLoginMs    = document.getElementById("btn-seguinte");

    if (btnLoginMs) {
        btnLoginMs.disabled = false;
        btnLoginMs.innerHTML = "Seguinte";
    }
    if (loginLoading) {
        loginLoading.classList.add("hidden");
        loginLoading.style.display = "none";
    }

    if (!AuthState.user) {
        // Usuário deslogado → Exibe Tela de Login Microsoft Original
        if (loginScreen) {
            loginScreen.classList.remove("hidden");
            loginScreen.style.display = "flex";
        }
        if (appContainer) {
            appContainer.classList.add("hidden");
            appContainer.style.display = "none";
        }
        if (appHeader) {
            appHeader.classList.add("hidden");
            appHeader.style.display = "none";
        }
        if (appMain) {
            appMain.classList.add("hidden");
            appMain.style.display = "none";
        }
        if (blockScreen) {
            blockScreen.classList.add("hidden");
            blockScreen.style.display = "none";
        }
        return;
    }

    if (!AuthState.isAuthorized) {
        // Logado porém SEM código Protheus ou domínio inválido → Tela de bloqueio
        if (loginScreen) {
            loginScreen.classList.add("hidden");
            loginScreen.style.display = "none";
        }
        if (blockScreen) {
            blockScreen.classList.remove("hidden");
            blockScreen.style.display = "flex";
        }
        if (appContainer) {
            appContainer.classList.add("hidden");
            appContainer.style.display = "none";
        }
        if (appHeader) {
            appHeader.classList.add("hidden");
            appHeader.style.display = "none";
        }
        if (appMain) {
            appMain.classList.add("hidden");
            appMain.style.display = "none";
        }

        const blockEmailEl = document.getElementById("block-user-email");
        const blockMsgEl = document.getElementById("block-error-message");
        if (blockEmailEl) blockEmailEl.textContent = AuthState.user.email || "";
        if (blockMsgEl) blockMsgEl.textContent = AuthState.errorMessage || "Acesso restrito.";

        document.getElementById("btn-block-logout")?.addEventListener("click", fazerLogout, { once: true });
        return;
    }

    // Usuário autorizado e vinculado com sucesso!
    if (loginScreen) {
        loginScreen.classList.add("hidden");
        loginScreen.style.display = "none";
    }
    if (loginLoading) {
        loginLoading.classList.add("hidden");
        loginLoading.style.display = "none";
    }
    if (blockScreen) {
        blockScreen.classList.add("hidden");
        blockScreen.style.display = "none";
    }
    if (appContainer) {
        appContainer.classList.remove("hidden");
        appContainer.style.display = "flex";
    }
    if (appHeader) {
        appHeader.classList.remove("hidden");
        appHeader.style.display = "block";
    }
    if (appMain) {
        appMain.classList.remove("hidden");
        appMain.style.display = "block";
    }

    // Preenche cabeçalho
    const nomeBruto = AuthState.profile.nome || AuthState.profile.email?.split("@")[0] || "Colaborador";
    const nomeFormatted = formatNomeTitleCase(nomeBruto);

    const elHeaderName = document.getElementById("header-user-name");
    if (elHeaderName) elHeaderName.textContent = nomeFormatted;
    const elHeaderProtheus = document.getElementById("header-user-protheus");
    if (elHeaderProtheus) elHeaderProtheus.textContent = `Protheus: ${AuthState.profile.protheus}`;
    const elHeaderFilial = document.getElementById("header-user-filial");
    if (elHeaderFilial) elHeaderFilial.textContent = AuthState.profile.filial;

    // Saudação no dashboard com PRI.MAIUSCULA (Title Case)
    const greetingEl = document.getElementById("main-page-greeting");
    if (greetingEl) {
        greetingEl.textContent = `Olá, ${nomeFormatted} 👋`;
    }
    const admGreetingEl = document.getElementById("adm-main-greeting");
    if (admGreetingEl) {
        admGreetingEl.textContent = `Olá, ${nomeFormatted} 👋`;
    }

    // Botão logout no header
    document.getElementById("btn-logout")?.addEventListener("click", fazerLogout, { once: true });

    // Configuração de Perfil: Jonathan Melgaço / Admin vs Promotores
    const emailLower = String(AuthState.profile?.email || "").toLowerCase().trim();
    const isUserAdmin = emailLower === "j_melgaco@makita.com.br" || emailLower.startsWith("j_melgaco@") || emailLower === "88901" || AuthState.profile?.protheus === "88901";

    const headerButtons = document.getElementById("header-buttons");
    const containerMiniRelat = document.getElementById("container-mini-relatorio");
    const dashboardHeaderPromotor = document.getElementById("dashboard-header-promotor");

    if (isUserAdmin) {
        // TELA EXCLUSIVA JONATHAN MELGAÇO: apenas Painel Geral e Sair (NUNCA Nova Solicitação ou Minhas Devoluções)
        if (headerButtons) {
            headerButtons.innerHTML = `
                <button id="btn-nav-adm-todas" class="nav-tab-btn flex items-center space-x-2 bg-white/30 border border-white text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" data-tab="adm-geral">
                    <i class="fa-solid fa-boxes-packing text-xs"></i> <span>Painel Geral de Devoluções</span>
                </button>
                <button id="btn-logout" class="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" title="Sair do sistema">
                    <i class="fa-solid fa-right-from-bracket text-xs"></i> <span>Sair</span>
                </button>
            `;
            document.getElementById("btn-nav-adm-todas")?.addEventListener("click", () => setTab("adm-geral"));
            document.getElementById("btn-logout")?.addEventListener("click", fazerLogout, { once: true });
        }
        if (containerMiniRelat) containerMiniRelat.classList.add("hidden");
        if (dashboardHeaderPromotor) dashboardHeaderPromotor.classList.add("hidden");

        setTab("adm-geral");
    } else {
        // TELA PADRÃO PROMOTORES: Nova Solicitação, Minhas Devoluções e Sair
        if (headerButtons) {
            headerButtons.innerHTML = `
                <button id="btn-nav-nova" class="nav-tab-btn flex items-center space-x-2 bg-white/30 border border-white text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" data-tab="devolucao">
                    <i class="fa-solid fa-box-open text-xs"></i> <span>Nova Solicitação</span>
                </button>
                <button id="btn-nav-historico" class="nav-tab-btn flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white/90 hover:text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" data-tab="historico">
                    <i class="fa-solid fa-clock-rotate-left text-xs"></i> <span>Minhas Devoluções</span>
                </button>
                <button id="btn-logout" class="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" title="Sair do sistema">
                    <i class="fa-solid fa-right-from-bracket text-xs"></i> <span>Sair</span>
                </button>
            `;
            document.getElementById("btn-nav-nova")?.addEventListener("click", () => setTab("devolucao"));
            document.getElementById("btn-nav-historico")?.addEventListener("click", () => setTab("historico"));
            document.getElementById("btn-logout")?.addEventListener("click", fazerLogout, { once: true });
        }
        if (containerMiniRelat) containerMiniRelat.classList.remove("hidden");
        if (dashboardHeaderPromotor) dashboardHeaderPromotor.classList.remove("hidden");

        setTab("devolucao");
        carregarItensDoUsuario().then(() => {
            renderMiniRelatorioAtivos();
            renderFluxoDevolucao();
        });
    }
}


/**
 * Renderização do Fluxo de Devolução por Etapas
 */
function renderFluxoDevolucao() {
    const step = DevolucaoState.etapaAtual;

    // Atualiza Step Bar Indicator
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`step-indicator-${i}`);
        if (!stepEl) continue;
        stepEl.classList.remove("active", "completed");
        if (i < step) {
            stepEl.classList.add("completed");
        } else if (i === step) {
            stepEl.classList.add("active");
        }
    }

    // Oculta/Exibe Containers de cada Etapa
    for (let i = 1; i <= 5; i++) {
        const pane = document.getElementById(`step-pane-${i}`);
        if (pane) {
            pane.classList.toggle("hidden", i !== step);
        }
    }

    // Renderiza o conteúdo específico da etapa ativa
    if (step === 1) renderEtapa1Itens();
    if (step === 2) renderEtapa2Volumes();
    if (step === 3) renderEtapa3Logistica();
    if (step === 4) renderEtapa4Resumo();
    if (step === 5) renderEtapa5Sucesso();
}

/**
 * ETAPA 1: Nova UX de Seleção de Notas Fiscais com Filtros
 */
let _nfeSearchTerm = "";
let _nfeFilterField = "todos"; // "todos" | "nfe" | "cliente" | "codigo"
let _nfeListenersAttached = false;

function renderEtapa1Itens() {
    _renderNFeTable();
    _attachNFeListeners();
}

function _nfeFilteredList() {
    const itens = DevolucaoState.itensDisponiveis;
    const t = _nfeSearchTerm.toLowerCase().trim();
    if (!t) return itens;

    return itens.filter(item => {
        const nfRemessaStr     = (item.nfRemessa || item.notaFiscal || "").toLowerCase();
        const codClienteStr    = (item.codigoCliente || "").toLowerCase();
        const nomeClienteStr   = (item.nomeCliente || "").toLowerCase();
        const produtoStr       = (item.produto || item.codigoItem || "").toLowerCase();
        const descricaoStr     = (item.descricao || "").toLowerCase();
        const pedidoStr        = (item.pedido || "").toLowerCase();

        const inNfe     = nfRemessaStr.includes(t);
        const inCliente = nomeClienteStr.includes(t) || codClienteStr.includes(t);
        const inCodigo  = produtoStr.includes(t);

        if (_nfeFilterField === "nfe")     return inNfe;
        if (_nfeFilterField === "cliente") return inCliente;
        if (_nfeFilterField === "codigo")  return inCodigo;
        return inNfe || inCliente || inCodigo || descricaoStr.includes(t) || pedidoStr.includes(t);
    });
}

function _renderNFeTable() {
    const loadingEl    = document.getElementById("nfe-loading-state");
    const emptyEl      = document.getElementById("nfe-empty-state");
    const noResultsEl  = document.getElementById("nfe-no-results-state");
    const tableWrapper = document.getElementById("nfe-table-container");
    const footerEl     = document.getElementById("nfe-table-footer");
    const tbody        = document.getElementById("nfe-table-body");

    // --- Loading state ---
    if (DevolucaoState.carregando) {
        loadingEl?.classList.remove("hidden");
        emptyEl?.classList.add("hidden");
        noResultsEl?.classList.add("hidden");
        tableWrapper?.classList.add("hidden");
        footerEl?.classList.add("hidden");
        return;
    }
    loadingEl?.classList.add("hidden");

    // --- Empty state (no NFes for this user) ---
    if (!DevolucaoState.itensDisponiveis || DevolucaoState.itensDisponiveis.length === 0) {
        emptyEl?.classList.remove("hidden");
        emptyEl?.classList.add("flex");
        noResultsEl?.classList.add("hidden");
        tableWrapper?.classList.add("hidden");
        footerEl?.classList.add("hidden");
        return;
    }
    emptyEl?.classList.add("hidden");
    emptyEl?.classList.remove("flex");

    const filtered = _nfeFilteredList();

    // --- No search results ---
    if (filtered.length === 0) {
        noResultsEl?.classList.remove("hidden");
        noResultsEl?.classList.add("flex");
        tableWrapper?.classList.add("hidden");
        footerEl?.classList.add("hidden");
        return;
    }
    noResultsEl?.classList.add("hidden");
    noResultsEl?.classList.remove("flex");

    // --- Render table rows ---
    tableWrapper?.classList.remove("hidden");
    footerEl?.classList.remove("hidden");

    if (tbody) {
        tbody.innerHTML = filtered.map(item => {
            const isSelected = DevolucaoState.itensSelecionados.has(item.id);
            const nfRemessa     = item.nfRemessa || item.notaFiscal || "—";
            const codigoCliente = item.codigoCliente || "—";
            const nomeCliente   = item.nomeCliente || "—";
            const produto       = item.produto || item.codigoItem || "—";
            const descricao     = item.descricao || "—";
            const saldo         = item.saldo !== undefined ? item.saldo : (item.saldoDisponivel !== undefined ? item.saldoDisponivel : 1);
            const pedido        = item.pedido || "—";

            return `
                <tr class="nfe-table-row ${isSelected ? 'nfe-row-selected' : ''}" data-id="${item.id}" data-nfe="${nfRemessa}" data-cliente="${nomeCliente}" data-codigo="${produto}">
                    <td class="px-3 py-3 text-center">
                        <input type="checkbox" class="nfe-row-checkbox" data-id="${item.id}" ${isSelected ? "checked" : ""}>
                    </td>
                    <td class="px-3 py-3">
                        <span class="nfe-number-badge">${nfRemessa}</span>
                    </td>
                    <td class="px-3 py-3 font-mono text-xs font-semibold text-slate-700">${codigoCliente}</td>
                    <td class="px-3 py-3">
                        <div class="text-xs font-semibold text-slate-800 leading-snug">${nomeCliente}</div>
                    </td>
                    <td class="px-3 py-3 font-mono text-xs font-bold text-slate-700">${produto}</td>
                    <td class="px-3 py-3 text-xs text-slate-600">${descricao}</td>
                    <td class="px-3 py-3 text-center font-mono font-bold text-xs text-[#008497]">${saldo}</td>
                    <td class="px-3 py-3 text-xs font-mono text-slate-500">${pedido}</td>
                </tr>
            `;
        }).join("");

        // Attach row-level events
        tbody.querySelectorAll(".nfe-row-checkbox").forEach(cb => {
            cb.addEventListener("change", e => {
                e.stopPropagation();
                const itemId = e.target.dataset.id;
                const itemObj = DevolucaoState.itensDisponiveis.find(it => it.id === itemId);
                if (itemObj) {
                    toggleItemSelecao(itemObj, e.target.checked);
                    _updateNFeSelectionUI();
                }
            });
        });

        tbody.querySelectorAll(".nfe-table-row").forEach(row => {
            row.addEventListener("click", e => {
                if (e.target.type === "checkbox") return;
                const cb = row.querySelector(".nfe-row-checkbox");
                if (cb) {
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });
        });
    }

    // Update footer count
    const totalCount = document.getElementById("nfe-footer-count");
    if (totalCount) totalCount.textContent = `${DevolucaoState.itensDisponiveis.length} nota(s) fiscal(is) disponíve${DevolucaoState.itensDisponiveis.length === 1 ? "l" : "is"}`;

    _updateNFeSelectionUI();
    renderMiniRelatorioAtivos();
}

function _updateNFeSelectionUI() {
    const total = DevolucaoState.itensSelecionados.size;

    // Badge counter
    const badge = document.getElementById("nfe-selection-badge");
    const countEl = document.getElementById("nfe-selected-count");
    if (badge && countEl) {
        countEl.textContent = total;
        badge.classList.toggle("hidden", total === 0);
        // Pulse animation
        countEl.classList.remove("pulse-once");
        void countEl.offsetWidth; // reflow
        countEl.classList.add("pulse-once");
    }

    // Footer selected label
    const footerLabel = document.getElementById("nfe-footer-selected-label");
    if (footerLabel) {
        footerLabel.textContent = total > 0 ? `${total} selecionada(s)` : "";
        footerLabel.classList.toggle("hidden", total === 0);
    }

    // Advance button
    const btnAvançar = document.getElementById("btn-avancar-para-volumes");
    if (btnAvançar) {
        btnAvançar.disabled = total === 0;
    }

    // Sync select-all checkbox
    const selectAll = document.getElementById("nfe-select-all");
    if (selectAll) {
        const filtered = _nfeFilteredList();
        const allChecked = filtered.length > 0 && filtered.every(it => DevolucaoState.itensSelecionados.has(it.id));
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && total > 0 && filtered.some(it => DevolucaoState.itensSelecionados.has(it.id));
    }

    // Highlight rows
    document.querySelectorAll("#nfe-table-body .nfe-table-row").forEach(row => {
        const isSelected = DevolucaoState.itensSelecionados.has(row.dataset.id);
        row.classList.toggle("nfe-row-selected", isSelected);
    });
}

function _attachNFeListeners() {
    if (_nfeListenersAttached) return;
    _nfeListenersAttached = true;

    // Search input
    const searchInput = document.getElementById("nfe-search-input");
    const clearBtn = document.getElementById("nfe-search-clear");
    if (searchInput) {
        searchInput.addEventListener("input", e => {
            _nfeSearchTerm = e.target.value;
            if (clearBtn) clearBtn.classList.toggle("hidden", !_nfeSearchTerm);
            _renderNFeTable();
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            _nfeSearchTerm = "";
            clearBtn.classList.add("hidden");
            _renderNFeTable();
        });
    }

    // Filter chips
    document.querySelectorAll(".nfe-filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".nfe-filter-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            _nfeFilterField = chip.dataset.filter || "todos";
            _renderNFeTable();
        });
    });

    // Select-all checkbox
    const selectAll = document.getElementById("nfe-select-all");
    if (selectAll) {
        selectAll.addEventListener("change", () => {
            const filtered = _nfeFilteredList();
            if (selectAll.checked) {
                filtered.forEach(item => toggleItemSelecao(item, true));
            } else {
                filtered.forEach(item => toggleItemSelecao(item, false));
            }
            _renderNFeTable();
        });
    }

    // Advance button (Step 1 → Step 2)
    const btnAvançar = document.getElementById("btn-avancar-para-volumes");
    if (btnAvançar) {
        btnAvançar.addEventListener("click", () => {
            if (DevolucaoState.itensSelecionados.size === 0) return;
            DevolucaoState.etapaAtual = 2;
            renderFluxoDevolucao();
        });
    }
}


/**
 * ETAPA 2: Renderização de Volumes e Embalagem
 */
function renderEtapa2Volumes() {
    const totalItens = Array.from(DevolucaoState.itensSelecionados.values()).reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0);
    const badgeEl = document.getElementById("step2-total-itens-badge");
    if (badgeEl) badgeEl.textContent = `${totalItens} selecionado(s)`;

    // Lista resumo rápido de itens
    const quickList = document.getElementById("step2-selected-quicklist");
    if (quickList) {
        quickList.innerHTML = Array.from(DevolucaoState.itensSelecionados.values()).map(it => `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs gap-2 hover:border-[#008497]/40 transition-colors">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                    <span class="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0">${it.codigoItem}</span>
                    <span class="text-slate-800 font-medium leading-relaxed break-words flex-1">${it.descricao}</span>
                </div>
                <span class="font-bold text-[#008497] bg-teal-50 px-2 py-0.5 rounded border border-teal-200 whitespace-nowrap shrink-0 self-start sm:self-center">${it.quantidadeDevolvida} un</span>
            </div>
        `).join("");
    }

    // Sincroniza inputs com o estado
    document.getElementById("input-qtd-volumes").value = DevolucaoState.volumes.quantidadeCaixas || 1;
    const inputPeso = document.getElementById("input-peso-volumes");
    if (inputPeso) inputPeso.value = DevolucaoState.volumes.pesoAproximadoKg || "";
    document.getElementById("input-obs-volumes").value = DevolucaoState.volumes.observacoesEmbalagem || "";
}

/**
 * ETAPA 3: Renderização de Logística
 */
function renderEtapa3Logistica() {
    const tipo = DevolucaoState.logistica.tipo;

    // Alterna visual dos cards de seleção
    document.querySelectorAll(".logistica-card").forEach(card => {
        const cardTipo = card.dataset.tipo;
        card.classList.toggle("selected", cardTipo === tipo);
    });

    document.getElementById("container-braspress-fields").classList.toggle("hidden", tipo !== "braspress");
    document.getElementById("container-regional-fields").classList.toggle("hidden", tipo !== "transportadora_regional");

    // Popula filiais Braspress se estiver vazio (106 filiais oficiais)
    const selectFiliais = document.getElementById("select-filial-braspress");
    if (selectFiliais && selectFiliais.options.length <= 1) {
        selectFiliais.innerHTML = '<option value="">-- Selecione a Filial Braspress de Referência --</option>' +
            BRASPRESS_FILIAIS.map(f => {
                const optVal = `${f.cidade} - ${f.nomeFantasia} (${f.sigla}) / ${f.uf}`;
                const optText = `[${f.uf}] ${f.cidade} — ${f.nomeFantasia} (${f.sigla}) | ${f.logradouro}, ${f.logNumero}`;
                return `<option value="${optVal}" data-sigla="${f.sigla}">${optText}</option>`;
            }).join("") + '<option value="outra">Outra filial (digitar endereço)</option>';
    }

    // Sincroniza campos regionais
    const reg = DevolucaoState.logistica.transportadoraRegional;
    document.getElementById("input-reg-nome").value = reg.nome || "";
    document.getElementById("input-reg-tel").value = reg.telefone || "";
    document.getElementById("input-reg-cidade").value = reg.cidade || "";
    document.getElementById("input-reg-uf").value = reg.uf || "";
    document.getElementById("input-reg-contato").value = reg.contato || "";
    document.getElementById("input-reg-motivo").value = DevolucaoState.logistica.motivoEscolhaRegional || "";
}

/**
 * ETAPA 4: Renderização de Resumo e Conferência
 */
function renderEtapa4Resumo() {
    const p = AuthState.profile;
    const elNome = document.getElementById("resumo-solicitante-nome");
    if (elNome) elNome.textContent = p?.nome || "";
    const elEmail = document.getElementById("resumo-solicitante-email");
    if (elEmail) elEmail.textContent = p?.email || "";

    // Tabela de itens do resumo com alinhamento e formatação perfeitos
    const itensBody = document.getElementById("resumo-itens-body");
    const itensArray = Array.from(DevolucaoState.itensSelecionados.values());
    const totalItensQtd = itensArray.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0);

    if (itensBody) {
        itensBody.innerHTML = itensArray.map(it => `
            <tr class="border-b border-slate-100 text-xs hover:bg-slate-50/80 transition-colors">
                <td class="p-3 text-left font-mono font-bold text-slate-800 whitespace-nowrap">
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200">${it.codigoItem}</span>
                </td>
                <td class="p-3 text-left text-slate-800 font-medium leading-relaxed">${it.descricao}</td>
                <td class="p-3 text-center font-mono text-slate-700 whitespace-nowrap">${it.notaFiscal || "-"}</td>
                <td class="p-3 text-center font-mono text-slate-600 whitespace-nowrap">${it.pedido || "-"}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <span class="font-bold text-[#008497] bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 text-xs inline-block">
                        ${it.quantidadeDevolvida} un
                    </span>
                </td>
            </tr>
        `).join("");
    }

    const elTotalCount = document.getElementById("resumo-total-itens-count");
    if (elTotalCount) elTotalCount.textContent = `${totalItensQtd} unidade(s)`;

    // Volumes
    document.getElementById("resumo-volumes-count").textContent = `${DevolucaoState.volumes.quantidadeCaixas} volume(s) / caixa(s)`;
    document.getElementById("resumo-volumes-peso").textContent = DevolucaoState.volumes.pesoAproximadoKg ? `${DevolucaoState.volumes.pesoAproximadoKg} kg aprox.` : "Não informado";
    document.getElementById("resumo-volumes-obs").textContent = DevolucaoState.volumes.observacoesEmbalagem || "Nenhuma observação de embalagem.";

    // Logística
    if (DevolucaoState.logistica.tipo === "braspress") {
        const filial = DevolucaoState.logistica.filialBraspress === "outra" ? DevolucaoState.logistica.filialOutraTexto : DevolucaoState.logistica.filialBraspress;
        document.getElementById("resumo-logistica-tipo").textContent = "Retirada em Filial Brasspress";
        document.getElementById("resumo-logistica-detalhe").textContent = filial || "Filial não especificada";
    } else {
        const reg = DevolucaoState.logistica.transportadoraRegional;
        document.getElementById("resumo-logistica-tipo").textContent = "Transportadora Regional Indicada";
        document.getElementById("resumo-logistica-detalhe").textContent = `${reg.nome} (${reg.cidade}/${reg.uf}) — Tel: ${reg.telefone || "N/A"}`;
    }

    document.getElementById("resumo-obs-gerais").textContent = DevolucaoState.observacoesGerais || "Sem observações adicionais.";
}

/**
 * ETAPA 5: Sucesso e Comprovante
 */
function renderEtapa5Sucesso() {
    const sol = DevolucaoState.solicitacaoConcluida;
    if (!sol) return;

    document.getElementById("sucesso-protocolo-badge").textContent = sol.protocolo;
    document.getElementById("sucesso-data-hora").textContent = new Date().toLocaleString("pt-BR");
    document.getElementById("sucesso-solicitante-nome").textContent = AuthState.profile?.nome || "";
    document.getElementById("sucesso-protheus-code").textContent = AuthState.profile?.protheus || "";
    document.getElementById("sucesso-total-volumes").textContent = `${DevolucaoState.volumes.quantidadeCaixas} caixas`;

    // Preenche a seção de impressão
    const printSection = document.getElementById("print-protocol-content");
    if (printSection) {
        printSection.innerHTML = `
            <div class="border-b-2 border-[#008497] pb-4 mb-4 flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">MAKITA DO BRASIL — SOLICITAÇÃO DE DEVOLUÇÃO</h2>
                    <p class="text-xs text-slate-500">Comprovante Interno de Registro de Devolução de Máquinas/Ativos</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-bold text-slate-400">PROTOCOLO</span>
                    <div class="text-lg font-mono font-bold text-[#008497]">${sol.protocolo}</div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-xs mb-4">
                <div><strong>Solicitante:</strong> ${AuthState.profile?.nome} (${AuthState.profile?.email})</div>
                <div><strong>Código Protheus:</strong> ${AuthState.profile?.protheus} - ${AuthState.profile?.filial}</div>
                <div><strong>Data do Registro:</strong> ${new Date().toLocaleString("pt-BR")}</div>
                <div><strong>Volumes (Caixas):</strong> ${DevolucaoState.volumes.quantidadeCaixas}</div>
            </div>
            <div class="mb-4">
                <strong class="text-xs">Modalidade de Logística:</strong>
                <p class="text-xs text-slate-600">${DevolucaoState.logistica.tipo === 'braspress' ? 'Retirada Filial Braspress: ' + DevolucaoState.logistica.filialBraspress : 'Transportadora Regional: ' + DevolucaoState.logistica.transportadoraRegional.nome}</p>
            </div>
            <table class="w-full text-xs text-left border-collapse mb-4">
                <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                        <th class="p-2">Código Item</th>
                        <th class="p-2">Descrição da Máquina</th>
                        <th class="p-2">Nota Fiscal</th>
                        <th class="p-2">Pedido</th>
                        <th class="p-2 text-right">Qtd</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(DevolucaoState.itensSelecionados.values()).map(it => `
                        <tr class="border-b border-slate-200">
                            <td class="p-2 font-mono font-bold">${it.codigoItem}</td>
                            <td class="p-2">${it.descricao}</td>
                            <td class="p-2 font-mono">${it.notaFiscal}</td>
                            <td class="p-2 font-mono">${it.pedido}</td>
                            <td class="p-2 text-right font-bold">${it.quantidadeDevolvida}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            <div class="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <strong>Aviso Fiscal:</strong> Esta solicitação foi registrada no sistema. A emissão da Nota Fiscal de Devolução (NF-e) ou Carta de Correção (CC-e) será efetuada manualmente pelo setor fiscal da Makita do Brasil.
            </div>
        `;
    }
}

/**
 * Renderização da Aba de Histórico
 */
async function renderHistorico() {
    const listContainer = document.getElementById("historico-list-container");
    listContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
            <i class="fa-solid fa-spinner fa-spin text-2xl text-[#008497] mb-2"></i>
            <p>Carregando histórico de solicitações...</p>
        </div>
    `;

    await carregarHistorico();

    if (HistoricoState.solicitacoes.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="7" class="p-12 text-center text-slate-400">
                    <i class="fa-regular fa-folder-open text-3xl mb-2 text-slate-300"></i>
                    <p class="font-medium text-slate-600">Nenhuma solicitação de devolução registrada até o momento.</p>
                </td>
            </tr>
        `;
        return;
    }

    listContainer.innerHTML = HistoricoState.solicitacoes.map(sol => {
        const badge = getStatusBadge(sol.status);
        const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        const totalAtivos = sol.itens ? sol.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0) : Number(sol.totalItens || 1);
        const totalNFe = sol.itens ? (new Set(sol.itens.map(it => it.notaFiscal).filter(Boolean))).size || (new Set(sol.notasFiscais || [])).size || 1 : 1;
        const caixas = sol.volumes?.quantidadeCaixas || 1;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <!-- 1. ID / Protocolo -->
                <td class="whitespace-nowrap">
                    <span class="font-semibold text-[#0f172a] text-xs">${sol.protocolo || "-"}</span>
                </td>

                <!-- 2. Data Registro -->
                <td class="whitespace-nowrap text-[#0f172a] text-xs font-medium">
                    ${dataFmt}
                </td>

                <!-- 3. Ativos (Total Ativos e Total NFe sem quebra de linha) -->
                <td class="whitespace-nowrap">
                    <div class="font-semibold text-[#0f172a] text-xs">${totalAtivos} ${totalAtivos === 1 ? 'ativo' : 'ativos'}</div>
                    <div class="text-[11px] text-[#64748b] font-normal">Total de ${totalNFe} NFe</div>
                </td>

                <!-- 4. Volumes -->
                <td class="text-center whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a]">
                        <i class="fa-solid fa-box text-[#008497] text-xs"></i> ${caixas} cx
                    </span>
                </td>

                <!-- 5. Logística (Texto completo sem truncamento) -->
                <td class="whitespace-nowrap">
                    ${sol.logistica?.tipo === "braspress" ? `
                        <div class="font-semibold text-[#008497] flex items-center gap-1.5 text-xs">
                            <i class="fa-solid fa-warehouse text-[#008497]"></i> Braspress
                        </div>
                        <div class="text-[11px] text-[#0f172a] font-normal mt-0.5">${sol.logistica?.filialBraspress || "Filial não informada"}</div>
                    ` : `
                        <div class="font-semibold text-amber-700 flex items-center gap-1.5 text-xs">
                            <i class="fa-solid fa-truck-ramp-box text-amber-600"></i> ${sol.logistica?.transportadoraRegional?.nome || "Transp. Regional"}
                        </div>
                        <div class="text-[11px] text-[#0f172a] font-normal mt-0.5">${sol.logistica?.cidadeOrigem || ""} ${sol.logistica?.ufOrigem ? '(' + sol.logistica.ufOrigem + ')' : ''}</div>
                    `}
                </td>

                <!-- 6. Coluna Específica para Status -->
                <td class="whitespace-nowrap text-center">
                    <span class="badge ${badge.bg}">
                        <i class="fa-solid fa-${badge.icon} text-xs"></i>
                        <span>${badge.label}</span>
                    </span>
                </td>

                <!-- 7. Coluna Específica para Ações -->
                <td class="whitespace-nowrap">
                    <div class="menu-acoes-container">
                        <!-- Botão de Ação -->
                        <button class="btn-acoes-toggle" data-toggle="dropdown" data-id="${sol.id || sol.protocolo}">
                            <i class="fa-solid fa-ellipsis text-xs text-slate-700"></i>
                            <span>Ações</span>
                            <i class="fa-solid fa-chevron-down text-[9px] text-slate-400"></i>
                        </button>
                    
                        <!-- Lista / Menu Dropdown Dinâmico -->
                        <div class="dropdown-acoes-menu" id="dropdown-${sol.id || sol.protocolo}">
                            <button class="dropdown-item" data-action="view" data-id="${sol.id || sol.protocolo}">
                                <i class="fa-solid fa-eye text-xs text-slate-500"></i>
                                <span>Visualizar Detalhes</span>
                            </button>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item text-rose-600 hover:bg-rose-50 hover:text-rose-700" data-action="delete" data-id="${sol.id || sol.protocolo}">
                                <i class="fa-solid fa-trash-can text-rose-500 text-xs w-4 text-center"></i>
                                <span>Excluir Solicitação</span>
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Renderização e Gestão da Tela Exclusiva de ADM (Jonathan Melgaço - Padrão Projeto Passagens)
 */
let _todasSolicitacoesCache = [];

export async function renderAdmGeralScreen() {
    const tbody = document.getElementById("tbody-adm-main-solicitacoes");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-16 bg-white">
                    <i class="fa-solid fa-spinner fa-spin text-3xl text-[#008497] mb-2"></i>
                    <p class="text-xs text-slate-500 font-medium">Carregando todas as solicitações do sistema...</p>
                </td>
            </tr>
        `;
    }

    try {
        _todasSolicitacoesCache = await carregarTodasSolicitacoes();
    } catch (e) {
        console.error("Erro ao carregar solicitações para o ADM:", e);
        _todasSolicitacoesCache = [];
    }

    _filtrarERenderizarAdmGeral();
}

function _filtrarERenderizarAdmGeral() {
    const tbody = document.getElementById("tbody-adm-main-solicitacoes");
    const termo = (document.getElementById("input-search-adm-main")?.value || "").toLowerCase().trim();

    let filtradas = _todasSolicitacoesCache;
    if (termo) {
        filtradas = _todasSolicitacoesCache.filter(sol => {
            const prot = String(sol.protocolo || "").toLowerCase();
            const nome = String(sol.solicitante?.nome || "").toLowerCase();
            const email = String(sol.solicitante?.email || "").toLowerCase();
            const protheus = String(sol.solicitante?.protheus || "").toLowerCase();
            const filial = String(sol.logistica?.filialBraspress || "").toLowerCase();
            const regional = String(sol.logistica?.transportadoraRegional?.nome || "").toLowerCase();
            const itensStr = sol.itens ? sol.itens.map(i => `${i.codigoItem} ${i.descricao} ${i.notaFiscal}`).join(" ").toLowerCase() : "";

            return prot.includes(termo) || nome.includes(termo) || email.includes(termo) ||
                   protheus.includes(termo) || filial.includes(termo) || regional.includes(termo) || itensStr.includes(termo);
        });
    }

    // Atualiza KPIs Principais
    // 1. Total de Solicitações: quantidade total de solicitações lançadas pelos usuários
    const totalSolic = filtradas.length;

    // 2. Ativos / Itens Devolvidos: quantidade total de ativos/itens solicitados para devolução
    const totalItens = filtradas.reduce((acc, s) => {
        const q = s.itens ? s.itens.reduce((sum, it) => sum + Number(it.quantidadeDevolvida || it.quantidade || 1), 0) : Number(s.totalItens || 0);
        return acc + q;
    }, 0);

    // 3. Despacho Braspress: quantidade de solicitações Braspress cujo status foi alterado dentro do botão ações
    const totalBraspress = filtradas.filter(s => {
        const isBraspress = (s.logistica?.tipo === "braspress" || s.status === "brasspress");
        const statusAlterado = (s.status && s.status !== "pendente") || (Array.isArray(s.historico_status) && s.historico_status.length > 0);
        return isBraspress && statusAlterado;
    }).length;

    // 4. Transp. Regionais: quantidade de solicitações Regionais cujo status foi alterado dentro do botão ações
    const totalRegional = filtradas.filter(s => {
        const isRegional = (s.logistica?.tipo === "transportadora_regional" || (s.logistica?.tipo !== "braspress" && s.status !== "brasspress"));
        const statusAlterado = (s.status && s.status !== "pendente") || (Array.isArray(s.historico_status) && s.historico_status.length > 0);
        return isRegional && statusAlterado;
    }).length;

    const elKpiSolic = document.getElementById("adm-main-kpi-total-solic");
    if (elKpiSolic) elKpiSolic.textContent = totalSolic;
    const elKpiItens = document.getElementById("adm-main-kpi-total-itens");
    if (elKpiItens) elKpiItens.textContent = `${totalItens} un`;
    const elKpiBraspress = document.getElementById("adm-main-kpi-braspress");
    if (elKpiBraspress) elKpiBraspress.textContent = totalBraspress;
    const elKpiRegional = document.getElementById("adm-main-kpi-regional");
    if (elKpiRegional) elKpiRegional.textContent = totalRegional;

    if (filtradas.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-16 bg-white">
                        <div class="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 text-2xl mx-auto mb-3">
                            <i class="fa-solid fa-inbox"></i>
                        </div>
                        <p class="text-sm font-semibold text-slate-600">Nenhuma solicitação de devolução registrada no momento.</p>
                        <p class="text-xs text-slate-400 mt-1">Assim que os promotores realizarem solicitações, elas aparecerão listadas aqui.</p>
                    </td>
                </tr>
            `;
        }
        return;
    }

    if (tbody) {
        tbody.innerHTML = filtradas.map(sol => {
            const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            const totalAtivos = sol.itens ? sol.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0) : Number(sol.totalItens || 1);
            const totalNFe = sol.itens ? (new Set(sol.itens.map(it => it.notaFiscal).filter(Boolean))).size || (new Set(sol.notasFiscais || [])).size || 1 : 1;
            const caixas = sol.volumes?.quantidadeCaixas || 1;
            const solicitanteNome = sol.solicitante?.nome || sol.solicitante?.email?.split("@")[0] || "Promotor";
            const solicitanteEmail = sol.solicitante?.email || "-";
            const protheus = sol.solicitante?.protheus || "-";
            const statusInfo = normalizarStatus(sol.status);

            return `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <!-- 1. ID / Protocolo (Minimalista Padrão Passagens) -->
                    <td class="whitespace-nowrap">
                        <span class="font-semibold text-[#0f172a] text-xs">${sol.protocolo || "-"}</span>
                    </td>

                    <!-- 2. Data Registro -->
                    <td class="whitespace-nowrap text-[#0f172a] text-xs font-medium">
                        ${dataFmt}
                    </td>

                    <!-- 3. Solicitante (Promotor / Vendedor com Cód. Protheus) -->
                    <td class="whitespace-nowrap">
                        <div class="font-semibold text-[#0f172a] text-xs">${solicitanteNome}</div>
                        <div class="text-[11px] text-[#64748b] font-normal">${solicitanteEmail}</div>
                        <div class="text-[11px] text-[#64748b] font-normal">Cód. Protheus: <strong class="text-[#64748b] font-semibold">${protheus}</strong></div>
                    </td>

                    <!-- 4. Ativos (Total de Ativos e Total de NFe) -->
                    <td class="whitespace-nowrap">
                        <div class="font-semibold text-[#0f172a] text-xs">${totalAtivos} ${totalAtivos === 1 ? 'ativo' : 'ativos'}</div>
                        <div class="text-[11px] text-[#64748b] font-normal">Total de ${totalNFe} NFe</div>
                    </td>

                    <!-- 5. Volumes -->
                    <td class="text-center whitespace-nowrap">
                        <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a]">
                            <i class="fa-solid fa-box text-[#008497] text-xs"></i> ${caixas} cx
                        </span>
                    </td>

                    <!-- 6. Logística (Texto completo sem truncamento) -->
                    <td class="whitespace-nowrap">
                        ${sol.logistica?.tipo === "braspress" ? `
                            <div class="font-semibold text-[#008497] flex items-center gap-1.5 text-xs">
                                <i class="fa-solid fa-warehouse text-[#008497]"></i> Braspress
                            </div>
                            <div class="text-[11px] text-[#0f172a] font-normal mt-0.5">${sol.logistica?.filialBraspress || "Filial não informada"}</div>
                        ` : `
                            <div class="font-semibold text-amber-700 flex items-center gap-1.5 text-xs">
                                <i class="fa-solid fa-truck-ramp-box text-amber-600"></i> ${sol.logistica?.transportadoraRegional?.nome || "Transp. Regional"}
                            </div>
                            <div class="text-[11px] text-[#0f172a] font-normal mt-0.5">${sol.logistica?.cidadeOrigem || ""} ${sol.logistica?.ufOrigem ? '(' + sol.logistica.ufOrigem + ')' : ''}</div>
                        `}
                    </td>

                    <!-- 7. Status (Badge Minimalista Padrão Passagens) -->
                    <td class="whitespace-nowrap text-center">
                        <span class="badge ${statusInfo.badgeClass}">
                            <i class="${statusInfo.icon} text-xs"></i>
                            <span>${statusInfo.label}</span>
                        </span>
                    </td>

                    <!-- 8. Ações (Menu Dropdown Padronizado) -->
                    <td class="whitespace-nowrap">
                        <div class="menu-acoes-container">
                            <!-- Botão de Ação -->
                            <button class="btn-acoes-toggle" data-toggle="dropdown" data-id="${sol.id || sol.protocolo}">
                                <i class="fa-solid fa-ellipsis text-xs text-slate-700"></i>
                                <span>Ações</span>
                                <i class="fa-solid fa-chevron-down text-[9px] text-slate-400"></i>
                            </button>

                            <!-- Lista / Menu Dropdown Dinâmico -->
                            <div class="dropdown-acoes-menu" id="dropdown-${sol.id || sol.protocolo}">
                                <button class="dropdown-item" data-action="view" data-id="${sol.id || sol.protocolo}">
                                    <i class="fa-solid fa-eye text-xs text-slate-500"></i>
                                    <span>Visualizar Detalhes</span>
                                </button>
                                <div class="dropdown-divider"></div>
                                <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Alterar Status
                                </div>
                                ${Object.values(STATUS_DEVOLUCAO).map(st => `
                                    <button class="dropdown-item ${st.key === statusInfo.key ? 'font-bold text-[#008497]' : ''}" data-action="status" data-status="${st.key}" data-id="${sol.id || sol.protocolo}">
                                        <i class="${st.icon} ${st.iconColor} text-xs w-4 text-center"></i>
                                        <span>${st.label}</span>
                                    </button>
                                `).join("")}
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item text-rose-600 hover:bg-rose-50 hover:text-rose-700" data-action="delete" data-id="${sol.id || sol.protocolo}">
                                    <i class="fa-solid fa-trash-can text-rose-500 text-xs w-4 text-center"></i>
                                    <span>Excluir Solicitação</span>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }
}

/**
 * Exporta todas as solicitações para Excel (.xlsx)
 */
export function exportarSolicitacoesParaExcel() {
    if (!_todasSolicitacoesCache || _todasSolicitacoesCache.length === 0) {
        showToast("Nenhuma solicitação para exportar.", "warning");
        return;
    }

    if (typeof XLSX === "undefined") {
        showToast("Biblioteca SheetJS não disponível.", "error");
        return;
    }

    const rows = [];
    _todasSolicitacoesCache.forEach(sol => {
        const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR");
        const solicitanteNome = sol.solicitante?.nome || sol.solicitante?.email?.split("@")[0] || "";
        const solicitanteEmail = sol.solicitante?.email || "";
        const protheus = sol.solicitante?.protheus || "";
        const logisticaTipo = sol.logistica?.tipo === "braspress" ? "Braspress" : "Transportadora Regional";
        const logisticaDestino = sol.logistica?.filialBraspress || sol.logistica?.transportadoraRegional?.nome || "";
        const caixas = sol.volumes?.quantidadeCaixas || 1;

        if (sol.itens && sol.itens.length > 0) {
            sol.itens.forEach(it => {
                rows.push({
                    "Protocolo": sol.protocolo || "",
                    "Data Criação": dataFmt,
                    "Solicitante": solicitanteNome,
                    "E-mail": solicitanteEmail,
                    "Cód. Protheus": protheus,
                    "Código Item": it.codigoItem || "",
                    "Descrição do Item": it.descricao || "",
                    "Nota Fiscal": it.notaFiscal || "",
                    "Nº Pedido": it.pedido || "",
                    "Qtd Devolvida": it.quantidadeDevolvida || 1,
                    "Qtd Caixas": caixas,
                    "Tipo Logística": logisticaTipo,
                    "Filial / Transportadora": logisticaDestino,
                    "Observações": sol.observacoesGerais || ""
                });
            });
        } else {
            rows.push({
                "Protocolo": sol.protocolo || "",
                "Data Criação": dataFmt,
                "Solicitante": solicitanteNome,
                "E-mail": solicitanteEmail,
                "Cód. Protheus": protheus,
                "Código Item": "",
                "Descrição do Item": "",
                "Nota Fiscal": "",
                "Nº Pedido": "",
                "Qtd Devolvida": sol.totalItens || 1,
                "Qtd Caixas": caixas,
                "Tipo Logística": logisticaTipo,
                "Filial / Transportadora": logisticaDestino,
                "Observações": sol.observacoesGerais || ""
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitações de Devolução");
    XLSX.writeFile(workbook, `Makita_Devolucoes_Geral_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Planilha Excel gerada e baixada com sucesso!", "success");
}

/**
 * Fluxo de Login Microsoft / Corporativo
 */
export async function handleMsLogin() {
    const inputEl      = document.getElementById("login-email") || document.getElementById("login-email-ms");
    const btnEl        = document.getElementById("btn-seguinte") || document.getElementById("btn-login-ms");
    const loginErrorEl = document.getElementById("login-error");

    function showLoginErr(msg) {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = "Seguinte";
        }
        if (loginErrorEl) {
            loginErrorEl.textContent = msg;
            loginErrorEl.classList.remove("hidden");
        }
        if (inputEl) inputEl.style.setProperty("border-bottom", "2px solid #e81123", "important");
    }
    function clearLoginErr() {
        if (loginErrorEl) {
            loginErrorEl.textContent = "";
            loginErrorEl.classList.add("hidden");
        }
        if (inputEl) inputEl.style.removeProperty("border-bottom");
    }
    function setBtnLoading(loading) {
        if (!btnEl) return;
        if (loading) {
            btnEl.disabled = true;
            btnEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        } else {
            btnEl.disabled = false;
            btnEl.innerHTML = "Seguinte";
        }
    }

    const term = (inputEl?.value || "").trim().toLowerCase();
    clearLoginErr();

    if (!term) {
        showLoginErr("Insira um endereço de e-mail.");
        inputEl?.focus();
        return;
    }

    setBtnLoading(true);

    try {
        const vinculo = await buscarVinculoProtheus(term);

        if (!vinculo) {
            setBtnLoading(false);
            showLoginErr(`O utilizador "${term}" não está autorizado a aceder ao sistema.`);
            return;
        }

        const loginUser = vinculo.email || (term.includes("@") ? term : `${term}@makita.com.br`);
        await simularLogin(loginUser);

    } catch (err) {
        console.error("Erro ao verificar acesso:", err);
        setBtnLoading(false);
        showLoginErr("Ocorreu um erro ao verificar o acesso. Tente novamente.");
    }
}

// Global window aliases for inline onclick callbacks
window.handleLogin = handleMsLogin;
window.handleMsLogin = handleMsLogin;
window.fazerLogout = fazerLogout;
window.setTab = setTab;
window.renderAdmGeralScreen = renderAdmGeralScreen;
window.carregarItensDoUsuario = carregarItensDoUsuario;

/**
 * Inicialização dos Event Listeners globais
 */
function initEventListeners() {
    // 1. Handlers de Eventos da Tela de Login
    document.addEventListener("click", (e) => {
        if (e.target.closest("#btn-seguinte, #btn-login-ms")) {
            e.preventDefault();
            handleMsLogin();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.target.id === "login-email" || e.target.id === "login-email-ms")) {
            e.preventDefault();
            handleMsLogin();
        }
    });

    document.addEventListener("input", (e) => {
        if (e.target.id === "login-email" || e.target.id === "login-email-ms") {
            const loginErrorEl = document.getElementById("login-error");
            if (loginErrorEl) {
                loginErrorEl.textContent = "";
                loginErrorEl.classList.add("hidden");
            }
            e.target.classList.remove("border-b-[#a4262c]", "border-b-2");
        }
    });

    // 2. Abas de Navegação
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => setTab(btn.dataset.tab));
    });

    // 3. Busca de itens na Etapa 1
    document.getElementById("input-search-itens")?.addEventListener("input", () => {
        renderEtapa1Itens();
    });

    // Checkbox selecionar todos
    document.getElementById("checkbox-select-all-itens")?.addEventListener("change", (e) => {
        const checked = e.target.checked;
        DevolucaoState.itensDisponiveis.forEach(it => {
            toggleItemSelecao(it, checked);
        });
        renderEtapa1Itens();
    });

    // 4. Botões de Navegação do Fluxo (Avançar / Voltar)
    document.querySelectorAll(".btn-avancar-etapa").forEach(btn => {
        btn.addEventListener("click", () => {
            // Sincroniza dados da etapa antes de avançar
            if (DevolucaoState.etapaAtual === 2) {
                DevolucaoState.volumes.quantidadeCaixas = document.getElementById("input-qtd-volumes")?.value || 1;
                DevolucaoState.volumes.pesoAproximadoKg = document.getElementById("input-peso-volumes")?.value || "";
                DevolucaoState.volumes.observacoesEmbalagem = document.getElementById("input-obs-volumes")?.value || "";
            } else if (DevolucaoState.etapaAtual === 3) {
                if (DevolucaoState.logistica.tipo === "braspress") {
                    DevolucaoState.logistica.filialBraspress = document.getElementById("select-filial-braspress")?.value || "";
                    DevolucaoState.logistica.filialOutraTexto = document.getElementById("input-filial-braspress-outra")?.value || "";
                } else {
                    DevolucaoState.logistica.transportadoraRegional = {
                        nome: document.getElementById("input-reg-nome")?.value || "",
                        telefone: document.getElementById("input-reg-tel")?.value || "",
                        cidade: document.getElementById("input-reg-cidade")?.value || "",
                        uf: document.getElementById("input-reg-uf")?.value || "",
                        contato: document.getElementById("input-reg-contato")?.value || ""
                    };
                    DevolucaoState.logistica.motivoEscolhaRegional = document.getElementById("input-reg-motivo")?.value || "";
                }
                DevolucaoState.observacoesGerais = document.getElementById("input-obs-gerais-etapa3")?.value || "";
            }

            const res = avancarEtapa();
            if (!res.valido) {
                showToast(res.mensagem, "warning");
            } else {
                renderFluxoDevolucao();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });

    document.querySelectorAll(".btn-voltar-etapa").forEach(btn => {
        btn.addEventListener("click", () => {
            voltarEtapa();
            renderFluxoDevolucao();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    // 5. Seleção de Tipo Logístico (Cards)
    document.querySelectorAll(".logistica-card").forEach(card => {
        card.addEventListener("click", () => {
            DevolucaoState.logistica.tipo = card.dataset.tipo;
            renderEtapa3Logistica();
        });
    });

    // 6. Confirmação Final e Gravação no Firestore
    document.getElementById("btn-confirmar-final")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirmar-final");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Confirmando Solicitação...`;

        try {
            const res = await confirmarEGravarSolicitacao();
            showToast("Solicitação de devolução registrada com sucesso!", "success");
            renderFluxoDevolucao();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            showToast("Erro ao gravar solicitação: " + err.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Confirmar Solicitação`;
        }
    });

    // 7. Botão Nova Devolução após sucesso
    document.getElementById("btn-nova-devolucao")?.addEventListener("click", () => {
        _nfeListenersAttached = false;
        _nfeSearchTerm = "";
        _nfeFilterField = "todos";
        reiniciarFluxoDevolucao();
        carregarItensDoUsuario().then(() => {
            renderFluxoDevolucao();
        });
    });


    // 8. Botão de Impressão do Comprovante
    document.getElementById("btn-imprimir-protocolo")?.addEventListener("click", () => {
        window.print();
    });

    // 8.1. Busca por CEP para encontrar a Filial Braspress mais próxima
    const btnBuscarCep = document.getElementById("btn-buscar-cep-braspress");
    const inputCep = document.getElementById("input-cep-braspress");

    async function handleBuscarFilialPorCep() {
        const cepVal = inputCep?.value || "";
        const cepLimpo = cepVal.replace(/\D/g, "");

        if (!cepVal || cepLimpo.length !== 8) {
            showToast("Digite um CEP válido com 8 dígitos (Ex: 01310-100 ou 13480-000).", "warning");
            return;
        }

        if (btnBuscarCep) {
            btnBuscarCep.disabled = true;
            btnBuscarCep.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Calculando...';
        }

        const res = await buscarFilialBraspressPorCEP(cepLimpo);

        if (btnBuscarCep) {
            btnBuscarCep.disabled = false;
            btnBuscarCep.innerHTML = '<i class="fa-solid fa-magnifying-glass-location mr-1"></i> Buscar Filial';
        }

        const cardResultado = document.getElementById("container-resultado-cep-braspress");
        if (!res.ok) {
            showToast(res.mensagem, "warning");
            if (cardResultado) cardResultado.classList.add("hidden");
            return;
        }

        // Exibe resultado e atualiza os elementos na tela
        const elNome = document.getElementById("txt-cep-filial-nome");
        const elDist = document.getElementById("txt-cep-distancia");
        const elEndUser = document.getElementById("txt-cep-endereco-usuario");
        const elDetalhes = document.getElementById("txt-cep-filial-detalhes");

        const f = res.filialRecomendada;
        if (elNome) elNome.innerHTML = `<i class="fa-solid fa-star text-amber-500 mr-1"></i> Filial Recomendada: <strong>${f.nomeFantasia} (${f.sigla})</strong>`;
        if (elDist) elDist.textContent = res.distanciaKm !== null ? `~ ${res.distanciaKm} km de você` : `Sugerida por ${f.uf}`;
        if (elEndUser) elEndUser.innerHTML = `<i class="fa-solid fa-location-dot text-[#008497] mr-1.5"></i> <strong>Seu endereço:</strong> ${res.enderecoUsuario}`;
        if (elDetalhes) elDetalhes.innerHTML = `<i class="fa-solid fa-building text-slate-500 mr-1.5"></i> <strong>Endereço Filial:</strong> ${f.logradouro}, ${f.logNumero} - ${f.bairro} (${f.cidade}/${f.uf}) <br> <i class="fa-solid fa-phone text-slate-500 mr-1.5 mt-1"></i> <strong>Telefone:</strong> ${f.fone}`;

        if (cardResultado) cardResultado.classList.remove("hidden");

        // Seleciona automaticamente a filial recomendada no select
        const selectFiliais = document.getElementById("select-filial-braspress");
        if (selectFiliais) {
            let foundIndex = -1;
            for (let i = 0; i < selectFiliais.options.length; i++) {
                const optText = selectFiliais.options[i].text;
                if (optText.includes(`(${f.sigla})`)) {
                    foundIndex = i;
                    break;
                }
            }

            if (foundIndex !== -1) {
                selectFiliais.selectedIndex = foundIndex;
                DevolucaoState.logistica.filialBraspress = selectFiliais.options[foundIndex].value;
            }
        }

        showToast(`Filial Braspress ${f.nomeFantasia} (${f.sigla}) identificada como a mais próxima!`, "success");
    }

    btnBuscarCep?.addEventListener("click", handleBuscarFilialPorCep);
    inputCep?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleBuscarFilialPorCep();
        }
    });

    // 9. Admin: Alternância de abas de importação (Arquivo vs Colar)
    const tabBtnFile = document.getElementById("tab-btn-import-file");
    const tabBtnPaste = document.getElementById("tab-btn-import-paste");
    const panelFile = document.getElementById("panel-import-file");
    const panelPaste = document.getElementById("panel-import-paste");

    tabBtnFile?.addEventListener("click", () => {
        tabBtnFile.classList.add("text-[#008497]", "border-b-2", "border-[#008497]", "font-bold");
        tabBtnFile.classList.remove("text-slate-500", "font-medium");
        tabBtnPaste.classList.remove("text-[#008497]", "border-b-2", "border-[#008497]", "font-bold");
        tabBtnPaste.classList.add("text-slate-500", "font-medium");
        panelFile?.classList.remove("hidden");
        panelPaste?.classList.add("hidden");
    });

    tabBtnPaste?.addEventListener("click", () => {
        tabBtnPaste.classList.add("text-[#008497]", "border-b-2", "border-[#008497]", "font-bold");
        tabBtnPaste.classList.remove("text-slate-500", "font-medium");
        tabBtnFile.classList.remove("text-[#008497]", "border-b-2", "border-[#008497]", "font-bold");
        tabBtnFile.classList.add("text-slate-500", "font-medium");
        panelPaste?.classList.remove("hidden");
        panelFile?.classList.add("hidden");
    });

    // Upload / Drag and Drop de Arquivo .xlsx
    const dropzone = document.getElementById("dropzone-excel-file");
    const inputFile = document.getElementById("input-excel-file");

    dropzone?.addEventListener("click", () => inputFile?.click());

    dropzone?.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("border-[#008497]", "bg-teal-50/50");
    });

    dropzone?.addEventListener("dragleave", () => {
        dropzone.classList.remove("border-[#008497]", "bg-teal-50/50");
    });

    dropzone?.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-[#008497]", "bg-teal-50/50");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processarArquivoUpload(e.dataTransfer.files[0]);
        }
    });

    inputFile?.addEventListener("change", async (e) => {
        if (e.target.files && e.target.files[0]) {
            await processarArquivoUpload(e.target.files[0]);
        }
    });

    async function processarArquivoUpload(file) {
        showToast(`Lendo arquivo "${file.name}"...`, "info");
        const res = await processarArquivoExcel(file);
        if (!res.sucesso) {
            showToast(res.mensagem, "error");
            return;
        }

        document.getElementById("excel-preview-count").textContent = `${res.totalLinhas} linhas identificadas (Aba: ${res.abaLida})`;
        const previewContainer = document.getElementById("excel-preview-table-body");
        previewContainer.innerHTML = res.dados.slice(0, 10).map(d => `
            <tr class="border-b border-slate-100 text-xs">
                <td class="p-2 font-mono font-bold">${d.codigoItem}</td>
                <td class="p-2">${d.descricao}</td>
                <td class="p-2 font-mono">${d.notaFiscal}</td>
                <td class="p-2 font-mono">${d.pedido}</td>
                <td class="p-2 font-bold text-center">${d.saldoDisponivel}</td>
                <td class="p-2 font-mono text-center text-teal-700">${d.protheus}</td>
            </tr>
        `).join("");

        document.getElementById("container-excel-preview").classList.remove("hidden");
        showToast(`${res.totalLinhas} itens extraídos da planilha com sucesso! Revise e clique em "Salvar Base".`, "success");
    }

    // Processar e Salvar Dados Colados do Excel (Ctrl+V)
    document.getElementById("btn-processar-excel-colado")?.addEventListener("click", () => {
        const texto = document.getElementById("textarea-excel-paste")?.value || "";
        const protheusAlvo = document.getElementById("input-excel-protheus-alvo")?.value || "";

        const parseRes = processarTextoCopiadoDoExcel(texto, protheusAlvo);
        if (!parseRes.sucesso) {
            showToast(parseRes.mensagem, "error");
            return;
        }

        document.getElementById("excel-preview-count").textContent = `${parseRes.totalLinhas} linhas identificadas`;
        const previewContainer = document.getElementById("excel-preview-table-body");
        previewContainer.innerHTML = parseRes.dados.slice(0, 10).map(d => `
            <tr class="border-b border-slate-100 text-xs">
                <td class="p-2 font-mono font-bold">${d.codigoItem}</td>
                <td class="p-2">${d.descricao}</td>
                <td class="p-2 font-mono">${d.notaFiscal}</td>
                <td class="p-2 font-mono">${d.pedido}</td>
                <td class="p-2 font-bold text-center">${d.saldoDisponivel}</td>
                <td class="p-2 font-mono text-center text-teal-700">${d.protheus}</td>
            </tr>
        `).join("");

        document.getElementById("container-excel-preview").classList.remove("hidden");
        showToast(`${parseRes.totalLinhas} itens processados com sucesso. Revise e clique em "Salvar Base".`, "info");
    });

    document.getElementById("btn-salvar-excel-firestore")?.addEventListener("click", async () => {
        const protheusAlvo = document.getElementById("input-excel-protheus-alvo")?.value || "";
        const btn = document.getElementById("btn-salvar-excel-firestore");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Salvando...`;

        try {
            await salvarBaseExcelNoFirestore(AdminState.dadosParseadosExcel, protheusAlvo);
            showToast("Base de ativos importada com sucesso no Firestore!", "success");
            document.getElementById("textarea-excel-paste").value = "";
            document.getElementById("container-excel-preview").classList.add("hidden");
        } catch (e) {
            showToast("Erro ao salvar base: " + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Salvar Base no Firestore`;
        }
    });

    // 10. Admin: Cadastrar Vínculo
    document.getElementById("form-cadastrar-vinculo")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("admin-input-email").value;
        const protheus = document.getElementById("admin-input-protheus").value;
        const nome = document.getElementById("admin-input-nome").value;
        const filial = document.getElementById("admin-input-filial").value;

        try {
            await cadastrarVinculoUsuario(email, protheus, nome, filial);
            showToast(`Vínculo de ${email} (${protheus}) salvo com sucesso!`, "success");
            document.getElementById("form-cadastrar-vinculo").reset();
            renderAdmin();
        } catch (err) {
            showToast("Erro ao cadastrar vínculo: " + err.message, "error");
        }
    });

    // 11. Tela Exclusiva de ADM (Jonathan Melgaço)
    document.getElementById("btn-adm-refresh-main")?.addEventListener("click", () => {
        renderAdmGeralScreen();
    });

    document.getElementById("input-search-adm-main")?.addEventListener("input", () => {
        _filtrarERenderizarAdmGeral();
    });

    document.getElementById("btn-adm-export-excel-main")?.addEventListener("click", () => {
        exportarSolicitacoesParaExcel();
    });

    document.getElementById("btn-header-export-excel")?.addEventListener("click", () => {
        exportarSolicitacoesParaExcel();
    });
    // 12. Modal de Detalhes da Solicitação (Pop-up Moderno)
    document.getElementById("btn-fechar-modal-detalhes")?.addEventListener("click", fecharModalDetalhesSolicitacao);
    document.getElementById("btn-fechar-modal-detalhes-footer")?.addEventListener("click", fecharModalDetalhesSolicitacao);
    document.getElementById("modal-detalhes-solicitacao")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-detalhes-solicitacao") {
            fecharModalDetalhesSolicitacao();
        }
    });
}

/**
 * Abre o Modal Pop-up Moderno com Detalhes Completos da Solicitação (Sem Emojis, com FontAwesome Icons)
 */
export function abrirModalDetalhesSolicitacao(idOuProtocolo) {
    const sol = (_todasSolicitacoesCache || []).find(s => s.id === idOuProtocolo || s.protocolo === idOuProtocolo) ||
                (HistoricoState.solicitacoes || []).find(s => s.id === idOuProtocolo || s.protocolo === idOuProtocolo);
    
    if (!sol) {
        showToast("Solicitação não encontrada.", "warning");
        return;
    }

    const modal = document.getElementById("modal-detalhes-solicitacao");
    if (!modal) return;

    const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR");
    const solicitanteNome = sol.solicitante?.nome || sol.solicitante?.email?.split("@")[0] || "Promotor";
    const solicitanteEmail = sol.solicitante?.email || "-";
    const protheus = sol.solicitante?.protheus || "-";
    const filial = sol.solicitante?.filial || "01 - Matriz";
    const caixas = sol.volumes?.quantidadeCaixas || 1;
    const totalQtd = sol.itens ? sol.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0) : Number(sol.totalItens || 1);

    // Preenche cabeçalho
    const badgeProt = document.getElementById("modal-detalhes-protocolo-badge");
    if (badgeProt) badgeProt.textContent = sol.protocolo || "S/ PROTOCOLO";

    const badgeStatus = document.getElementById("modal-detalhes-status-badge");
    if (badgeStatus) {
        const stObj = normalizarStatus(sol.status);
        badgeStatus.className = `badge ${stObj.badgeClass}`;
        badgeStatus.innerHTML = `<i class="${stObj.icon} text-xs"></i> <span>${stObj.label}</span>`;
    }

    // Preenche cards
    const elNome = document.getElementById("modal-det-nome");
    if (elNome) elNome.textContent = solicitanteNome;
    const elEmail = document.getElementById("modal-det-email");
    if (elEmail) elEmail.textContent = solicitanteEmail;
    const elProt = document.getElementById("modal-det-protheus");
    if (elProt) elProt.textContent = protheus;

    const elLogTipo = document.getElementById("modal-det-log-tipo");
    const elLogDestino = document.getElementById("modal-det-log-destino");
    const elLogEnd = document.getElementById("modal-det-log-endereco");

    if (sol.logistica?.tipo === "braspress") {
        if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5 font-semibold"><i class="fa-solid fa-warehouse"></i> Braspress</span>`;
        if (elLogDestino) elLogDestino.textContent = sol.logistica?.filialBraspress || "Filial não informada";
        if (elLogEnd) elLogEnd.textContent = "Entrega direta na filial Braspress selecionada";
    } else {
        const regNome = sol.logistica?.transportadoraRegional?.nome || "Transportadora Regional";
        if (elLogTipo) elLogTipo.innerHTML = `<span class="text-amber-700 flex items-center gap-1.5 font-semibold"><i class="fa-solid fa-truck-ramp-box"></i> Transportadora Regional</span>`;
        if (elLogDestino) elLogDestino.textContent = regNome;
        if (elLogEnd) elLogEnd.textContent = `Origem: ${sol.logistica?.cidadeOrigem || "-"} / ${sol.logistica?.ufOrigem || "-"}`;
    }

    const elData = document.getElementById("modal-det-data");
    if (elData) elData.textContent = dataFmt;
    const elVol = document.getElementById("modal-det-volumes");
    if (elVol) elVol.textContent = `${caixas} cx`;
    const elTotItens = document.getElementById("modal-det-total-itens");
    if (elTotItens) elTotItens.textContent = `${totalQtd} ${totalQtd === 1 ? 'item' : 'itens'}`;

    const elObs = document.getElementById("modal-det-observacoes");
    if (elObs) elObs.textContent = sol.observacoesGerais || "Nenhuma observação registrada.";

    // Preenche tabela de itens
    const tbody = document.getElementById("modal-det-tbody-itens");
    const countBadge = document.getElementById("modal-det-itens-count");
    if (countBadge) countBadge.textContent = `${sol.itens ? sol.itens.length : 0} ${sol.itens && sol.itens.length === 1 ? 'item' : 'itens'}`;

    if (tbody) {
        if (sol.itens && sol.itens.length > 0) {
            tbody.innerHTML = sol.itens.map((it, idx) => `
                <tr class="border-b border-slate-100 hover:bg-slate-50/80 text-xs">
                    <td class="p-2.5 text-center font-semibold text-slate-400 align-middle">${idx + 1}</td>
                    <td class="p-2.5 font-semibold text-[#0f172a] align-middle">${it.codigoItem || "-"}</td>
                    <td class="p-2.5 text-[#0f172a] font-normal align-middle">${it.descricao || "-"}</td>
                    <td class="p-2.5 text-center text-[#64748b] font-normal align-middle">${it.notaFiscal || "-"}</td>
                    <td class="p-2.5 text-center text-[#64748b] font-normal align-middle">${it.pedido || "-"}</td>
                    <td class="p-2.5 text-center font-semibold text-[#0f172a] align-middle">
                        ${it.quantidadeDevolvida || 1} un
                    </td>
                </tr>
            `).join("");
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Nenhum item discriminado nesta devolução.</td></tr>`;
        }
    }

    modal.classList.remove("hidden");
}

export function fecharModalDetalhesSolicitacao() {
    const modal = document.getElementById("modal-detalhes-solicitacao");
    if (modal) modal.classList.add("hidden");
}

function prepararEImprimirProtocolo(sol) {
    const printSection = document.getElementById("print-protocol-content");
    if (!printSection || !sol) return;

    const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR");
    const solicitanteNome = sol.solicitante?.nome || sol.solicitante?.email?.split("@")[0] || "Promotor";
    const solicitanteEmail = sol.solicitante?.email || "-";
    const protheus = sol.solicitante?.protheus || "-";
    const filial = sol.solicitante?.filial || "01 - Matriz";
    const caixas = sol.volumes?.quantidadeCaixas || 1;

    printSection.innerHTML = `
        <div class="border-b-2 border-[#008497] pb-4 mb-4 flex justify-between items-center">
            <div>
                <h2 class="text-xl font-bold text-slate-800">MAKITA DO BRASIL — SOLICITAÇÃO DE DEVOLUÇÃO</h2>
                <p class="text-xs text-slate-500">Comprovante Interno de Registro de Devolução de Máquinas/Ativos</p>
            </div>
            <div class="text-right">
                <span class="text-xs font-bold text-slate-400">PROTOCOLO</span>
                <div class="text-lg font-mono font-bold text-[#008497]">${sol.protocolo || "-"}</div>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-xs mb-4">
            <div><strong>Solicitante:</strong> ${solicitanteNome} (${solicitanteEmail})</div>
            <div><strong>Código Protheus:</strong> ${protheus} - ${filial}</div>
            <div><strong>Data do Registro:</strong> ${dataFmt}</div>
            <div><strong>Volumes (Caixas):</strong> ${caixas}</div>
        </div>
        <div class="mb-4">
            <strong class="text-xs">Modalidade de Logística:</strong>
            <p class="text-xs text-slate-600">${sol.logistica?.tipo === 'braspress' ? 'Retirada Filial Braspress: ' + (sol.logistica?.filialBraspress || '-') : 'Transportadora Regional: ' + (sol.logistica?.transportadoraRegional?.nome || '-')}</p>
        </div>
        <table class="w-full text-xs text-left border-collapse mb-4">
            <thead>
                <tr class="bg-slate-100 border-b border-slate-300">
                    <th class="p-2">Código Item</th>
                    <th class="p-2">Descrição da Máquina</th>
                    <th class="p-2">Nota Fiscal</th>
                    <th class="p-2">Pedido</th>
                    <th class="p-2 text-right">Qtd</th>
                </tr>
            </thead>
            <tbody>
                ${(sol.itens || []).map(it => `
                    <tr class="border-b border-slate-200">
                        <td class="p-2 font-mono font-bold">${it.codigoItem}</td>
                        <td class="p-2">${it.descricao}</td>
                        <td class="p-2 font-mono">${it.notaFiscal || "-"}</td>
                        <td class="p-2 font-mono">${it.pedido || "-"}</td>
                        <td class="p-2 text-right font-bold">${it.quantidadeDevolvida || 1} un</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        <div class="mt-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
            <strong>Observações:</strong>
            <p class="text-slate-600 mt-1">${sol.observacoesGerais || "Sem observações."}</p>
        </div>
    `;

    window.print();
}

// Expõe helpers globais para callbacks inline do HTML
window.appSetTab = setTab;
window.appVerDetalhesSolicitacao = abrirModalDetalhesSolicitacao;

window.appAlterarStatusSolicitacao = async (idOuProtocolo, novoStatusKey) => {
    // Fecha todos os menus abertos
    document.querySelectorAll('.dropdown-acoes-menu.show').forEach(m => m.classList.remove('show'));

    const sol = (_todasSolicitacoesCache || []).find(s => s.id === idOuProtocolo || s.protocolo === idOuProtocolo);
    if (!sol) {
        showToast("Solicitação não encontrada para atualização.", "error");
        return;
    }

    const adminEmail = AuthState.profile?.email || "j_melgaco@makita.com.br";
    const statusObj = STATUS_DEVOLUCAO[novoStatusKey] || STATUS_DEVOLUCAO.pendente;

    // Atualização otimista imediata na interface
    sol.status = statusObj.key;
    if (!sol.historico_status) sol.historico_status = [];
    sol.historico_status.push({
        status: statusObj.key,
        statusLabel: statusObj.label,
        alteradoPor: adminEmail,
        dataAlteracao: new Date().toISOString()
    });

    _filtrarERenderizarAdmGeral();
    showToast(`Status atualizado com sucesso: ${statusObj.label}`, "success");

    try {
        await atualizarStatusSolicitacao(idOuProtocolo, novoStatusKey, adminEmail);
    } catch (err) {
        console.error("Erro ao persistir status no Firestore:", err);
        showToast("Erro ao sincronizar com o Firestore (mantido localmente).", "warning");
    }
};

// Gerenciamento compartilhado de cliques nos botões/dropdowns de Ações (Padrão Projeto Passagens)
document.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest('[data-toggle="dropdown"]');
    if (toggleBtn) {
        e.stopPropagation();
        const container = toggleBtn.closest('.menu-acoes-container');
        const targetMenu = container ? container.querySelector('.dropdown-acoes-menu') : null;
        const isCurrentlyShown = targetMenu && targetMenu.classList.contains('show');

        // Fecha todos os outros abertos
        document.querySelectorAll('.dropdown-acoes-menu.show').forEach(m => m.classList.remove('show'));

        if (targetMenu && !isCurrentlyShown) {
            const rect = toggleBtn.getBoundingClientRect();
            const menuWidth = 190;
            let leftPos = rect.right - menuWidth;
            if (leftPos < 10) leftPos = 10;

            // Detecta se cabe abaixo ou precisa abrir para cima
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 240) {
                targetMenu.style.top = 'auto';
                targetMenu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
            } else {
                targetMenu.style.bottom = 'auto';
                targetMenu.style.top = `${rect.bottom + 4}px`;
            }

            targetMenu.style.left = `${leftPos}px`;
            targetMenu.classList.add('show');
        }
        return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
        document.querySelectorAll('.dropdown-acoes-menu.show').forEach(m => m.classList.remove('show'));
        const action = actionBtn.dataset.action;
        const id = actionBtn.dataset.id;

        if (action === 'view') {
            abrirModalDetalhesSolicitacao(id);
        } else if (action === 'status') {
            const novoStatusKey = actionBtn.dataset.status;
            window.appAlterarStatusSolicitacao(id, novoStatusKey);
        } else if (action === 'delete') {
            const sol = (_todasSolicitacoesCache || []).find(s => s.id === id || s.protocolo === id) ||
                        (HistoricoState.solicitacoes || []).find(s => s.id === id || s.protocolo === id);
            const protStr = sol?.protocolo || id;
            
            const confirmou = confirm(`Deseja realmente excluir esta solicitação de devolução (${protStr})?\nEsta ação não poderá ser desfeita.`);
            if (!confirmou) return;

            // Remoção otimista da interface
            if (_todasSolicitacoesCache) {
                _todasSolicitacoesCache = _todasSolicitacoesCache.filter(s => s.id !== id && s.protocolo !== id);
                _filtrarERenderizarAdmGeral();
            }
            if (HistoricoState.solicitacoes) {
                HistoricoState.solicitacoes = HistoricoState.solicitacoes.filter(s => s.id !== id && s.protocolo !== id);
                renderHistorico();
            }

            showToast(`Solicitação ${protStr} excluída com sucesso.`, "success");

            try {
                await excluirSolicitacao(id);
            } catch (err) {
                console.error("Erro ao persistir exclusão no Firestore:", err);
                showToast("Erro ao sincronizar exclusão com o Firestore.", "warning");
            }
        }
        return;
    }

    // Fecha se clicou em qualquer outro ponto fora
    document.querySelectorAll('.dropdown-acoes-menu.show').forEach(m => m.classList.remove('show'));
});

// Fecha dropdowns ao rolar a página ou tabela
window.addEventListener("scroll", () => {
    document.querySelectorAll('.dropdown-acoes-menu.show').forEach(m => m.classList.remove('show'));
}, { passive: true });

// Inicialização Robusta
async function bootApp() {
    window.handleMsLogin = handleMsLogin;
    initEventListeners();
    subscribeAuth(updateAuthUI);
    await inicializarAuth();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootApp);
} else {
    bootApp();
}

