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
    carregarSolicitacaoParaEdicao,
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
    carregarTodasSolicitacoes,
    ouvirTodasSolicitacoesRealtime,
    cadastrarPromotorComSyncNfe
} from "./admin.js";

import { 
    STATUS_DEVOLUCAO, 
    normalizarStatus, 
    atualizarStatusSolicitacao,
    excluirSolicitacao 
} from "./api.js";

import { db, doc, getDoc, collection, query, where, getDocs } from "./firebase.js";
import { BRASPRESS_FILIAIS, buscarFilialBraspressPorCEP } from "./braspress.js";
import { FILIAIS_MAKITA } from "./filiais_makita.js";

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

// Modal Cadastrar Promotor
export function abrirModalCadastrarPromotor() {
    const modalCadPromotor = document.getElementById("modal-cadastrar-promotor");
    const formCadPromotor = document.getElementById("form-cadastrar-promotor");
    if (modalCadPromotor) {
        formCadPromotor?.reset();
        document.getElementById("cad-promotor-status-msg")?.classList.add("hidden");
        modalCadPromotor.classList.remove("hidden");
    }
}
window.abrirModalCadastrarPromotor = abrirModalCadastrarPromotor;

export function fecharModalCadPromotor() {
    const modalCadPromotor = document.getElementById("modal-cadastrar-promotor");
    if (modalCadPromotor) modalCadPromotor.classList.add("hidden");
}
window.fecharModalCadPromotor = fecharModalCadPromotor;

// Estado global do modal de detalhes
let _modalDetalhesCurrentSol = null;

// Navegação de Abas Principais (Nova Devolução vs Histórico vs Admin)
let currentTab = "devolucao"; // 'devolucao', 'historico', 'admin', 'adm-geral'

function setTab(tab) {
    currentTab = tab;
    
    // Atualiza botões do header com as cores e estilo padrão dos projetos Makita
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
        const btnTab = btn.dataset ? btn.dataset.tab : btn.getAttribute("data-tab");
        if (btnTab === tab) {
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

    if (tab === "devolucao") {
        if (!DevolucaoState.itensDisponiveis || DevolucaoState.itensDisponiveis.length === 0) {
            carregarItensDoUsuario();
        } else {
            renderFluxoDevolucao();
            renderMiniRelatorioAtivos();
        }
    } else if (tab === "historico") {
        renderHistorico();
    } else if (tab === "adm-geral" || tab === "admin") {
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
        loginLoading.classList.add("hidden", "pointer-events-none");
        loginLoading.style.setProperty("display", "none", "important");
    }

    if (!AuthState.user) {
        // Usuário deslogado → Exibe Tela de Login Microsoft Original
        if (loginScreen) {
            loginScreen.classList.remove("hidden");
            loginScreen.style.setProperty("display", "flex", "important");
        }
        if (appContainer) {
            appContainer.classList.add("hidden");
            appContainer.style.setProperty("display", "none", "important");
        }
        if (appHeader) {
            appHeader.classList.add("hidden");
            appHeader.style.setProperty("display", "none", "important");
        }
        if (appMain) {
            appMain.classList.add("hidden");
            appMain.style.setProperty("display", "none", "important");
        }
        if (blockScreen) {
            blockScreen.classList.add("hidden");
            blockScreen.style.setProperty("display", "none", "important");
        }

        const loginErrorEl = document.getElementById("login-error");
        if (loginErrorEl) {
            if (AuthState.errorMessage) {
                loginErrorEl.textContent = AuthState.errorMessage;
                loginErrorEl.classList.remove("hidden");
                loginErrorEl.style.removeProperty("display");
                loginErrorEl.style.setProperty("display", "block", "important");
            } else {
                loginErrorEl.textContent = "";
                loginErrorEl.classList.add("hidden");
                loginErrorEl.style.setProperty("display", "none", "important");
            }
        }
        return;
    }

    if (!AuthState.isAuthorized) {
        // Logado porém SEM código Protheus ou domínio inválido → Tela de bloqueio
        if (loginScreen) {
            loginScreen.classList.add("hidden");
            loginScreen.style.setProperty("display", "none", "important");
        }
        if (blockScreen) {
            blockScreen.classList.remove("hidden");
            blockScreen.style.setProperty("display", "flex", "important");
        }
        if (appContainer) {
            appContainer.classList.add("hidden");
            appContainer.style.setProperty("display", "none", "important");
        }
        if (appHeader) {
            appHeader.classList.add("hidden");
            appHeader.style.setProperty("display", "none", "important");
        }
        if (appMain) {
            appMain.classList.add("hidden");
            appMain.style.setProperty("display", "none", "important");
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
        loginScreen.style.setProperty("display", "none", "important");
    }
    if (loginLoading) {
        loginLoading.classList.add("hidden", "pointer-events-none");
        loginLoading.style.setProperty("display", "none", "important");
    }
    if (blockScreen) {
        blockScreen.classList.add("hidden");
        blockScreen.style.setProperty("display", "none", "important");
    }
    if (appContainer) {
        appContainer.classList.remove("hidden");
        appContainer.style.setProperty("display", "flex", "important");
    }
    if (appHeader) {
        appHeader.classList.remove("hidden");
        appHeader.style.setProperty("display", "block", "important");
    }
    if (appMain) {
        appMain.classList.remove("hidden");
        appMain.style.setProperty("display", "block", "important");
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
        // TELA EXCLUSIVA JONATHAN MELGAÇO: Painel Geral, Cadastrar Promotor e Sair com layout padronizado
        if (headerButtons) {
            headerButtons.innerHTML = `
                <button id="btn-nav-adm-todas" class="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" data-tab="adm-geral">
                    <i class="fa-solid fa-boxes-packing text-xs"></i> <span>Painel Geral de Devoluções</span>
                </button>
                <button id="btn-header-cadastrar-promotor" class="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" title="Cadastrar novo promotor e sincronizar NFs">
                    <i class="fa-solid fa-user-plus text-xs"></i> <span>Cadastrar Promotor</span>
                </button>
                <button id="btn-logout" class="flex items-center space-x-2 bg-white/15 hover:bg-white/25 border border-white/40 text-white backdrop-blur-md px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer" title="Sair do sistema">
                    <i class="fa-solid fa-right-from-bracket text-xs"></i> <span>Sair</span>
                </button>
            `;
            document.getElementById("btn-nav-adm-todas")?.addEventListener("click", () => setTab("adm-geral"));
            document.getElementById("btn-header-cadastrar-promotor")?.addEventListener("click", abrirModalCadastrarPromotor);
            document.getElementById("btn-logout")?.addEventListener("click", fazerLogout, { once: true });
        }
        if (containerMiniRelat) containerMiniRelat.classList.add("hidden");
        if (dashboardHeaderPromotor) dashboardHeaderPromotor.classList.add("hidden");

        setTab("adm-geral");
    } else {
        // TELA PADRÃO PROMOTORES: Nova Solicitação, Minhas Devoluções e Sair (Sem botão de cadastro)
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

    // Atualiza banner de modo de edição
    const bannerEdicao = document.getElementById("banner-modo-edicao");
    const lblProtocolo = document.getElementById("lbl-edicao-protocolo");
    if (bannerEdicao) {
        if (DevolucaoState.idEmEdicao) {
            bannerEdicao.classList.remove("hidden");
            const nomeSol = DevolucaoState.solicitanteEmEdicao?.nome ? ` (Solicitante: ${DevolucaoState.solicitanteEmEdicao.nome})` : "";
            if (lblProtocolo) lblProtocolo.textContent = `${DevolucaoState.protocoloEmEdicao || "#00000"}${nomeSol}`;
        } else {
            bannerEdicao.classList.add("hidden");
        }
    }

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

    // Oculta/Exibe Containers de cada Etapa (1 a 4)
    for (let i = 1; i <= 4; i++) {
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
        if (emptyEl) {
            const isAdmin = Boolean(AuthState.profile?.isAdmin || ADMIN_EMAILS.includes(AuthState.profile?.email));
            if (isAdmin) {
                emptyEl.innerHTML = `
                    <div class="w-14 h-14 bg-[#008497]/10 rounded-full flex items-center justify-center text-[#008497] text-2xl">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-slate-800">Painel do Administrador Geral</p>
                        <p class="text-xs text-slate-500 mt-1 max-w-md">Como administrador, sua conta gerencia todas as devoluções da equipe Makita do Brasil. Para visualizar e gerenciar as solicitações dos promotores, utilize a aba de gestão geral.</p>
                    </div>
                    <button type="button" onclick="window.appSetTab('adm-geral')" class="mt-2 px-4 py-2 bg-[#008497] hover:bg-[#006064] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-arrow-left"></i> Voltar para Todas as Solicitações
                    </button>
                `;
            } else {
                emptyEl.innerHTML = `
                    <div class="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 text-2xl">
                        <i class="fa-solid fa-file-circle-xmark"></i>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-slate-600">Nenhuma nota fiscal encontrada</p>
                        <p class="text-xs text-slate-400 mt-1">Não há NFes pendentes vinculadas ao seu código Protheus.<br>Entre em contato com o administrativo caso isso seja um engano.</p>
                    </div>
                `;
            }
            emptyEl.classList.remove("hidden");
            emptyEl.classList.add("flex");
        }
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
                <span class="font-bold text-[#008497] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0 self-start sm:self-center">${it.quantidadeDevolvida} un</span>
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
/**
 * Componente Customizado de Dropdown Searchable de Filiais Braspress (Design System)
 */
let _filiaisCustomSelectInitialized = false;

export function selecionarFilialBraspress(valor, dadosOpcionais = null) {
    const inputHidden = document.getElementById("select-filial-braspress");
    const lblTrigger = document.getElementById("label-filial-braspress");
    const sublblTrigger = document.getElementById("sublabel-filial-braspress");
    const containerOutra = document.getElementById("container-filial-outra");
    const container = document.getElementById("custom-select-filial-container");
    const menu = document.getElementById("menu-filial-braspress");

    const valLimpo = valor || "";
    if (inputHidden) inputHidden.value = valLimpo;
    DevolucaoState.logistica.filialBraspress = valLimpo;

    if (!valLimpo) {
        if (lblTrigger) lblTrigger.textContent = "Selecione ou busque uma filial Braspress...";
        if (sublblTrigger) {
            sublblTrigger.textContent = "";
            sublblTrigger.classList.add("hidden");
        }
        if (containerOutra) containerOutra.classList.add("hidden");
        return;
    }

    if (valLimpo === "outra") {
        if (lblTrigger) lblTrigger.textContent = "Outra filial / Digitar endereço manualmente";
        if (sublblTrigger) {
            sublblTrigger.textContent = "Informe o endereço completo abaixo";
            sublblTrigger.classList.remove("hidden");
        }
        if (containerOutra) containerOutra.classList.remove("hidden");
    } else {
        if (containerOutra) containerOutra.classList.add("hidden");
        
        // Tenta achar o objeto da filial
        const f = dadosOpcionais || BRASPRESS_FILIAIS.find(fil => 
            `${fil.cidade} - ${fil.nomeFantasia} (${fil.sigla}) / ${fil.uf}` === valLimpo ||
            valLimpo.includes(`(${fil.sigla})`)
        );

        if (f) {
            if (lblTrigger) lblTrigger.textContent = `[${f.uf}] ${f.cidade} — ${f.nomeFantasia} (${f.sigla})`;
            if (sublblTrigger) {
                sublblTrigger.textContent = `${f.logradouro}, ${f.logNumero} - ${f.bairro || ''} (Tel: ${f.fone || 'N/A'})`;
                sublblTrigger.classList.remove("hidden");
            }
        } else {
            if (lblTrigger) lblTrigger.textContent = valLimpo;
            if (sublblTrigger) sublblTrigger.classList.add("hidden");
        }
    }

    // Marca item selecionado no menu
    document.querySelectorAll("#options-filial-braspress .custom-select-option").forEach(opt => {
        const isSel = opt.dataset.value === valLimpo;
        opt.classList.toggle("is-selected", isSel);
        const checkIcon = opt.querySelector(".fa-check");
        if (checkIcon) {
            checkIcon.classList.toggle("opacity-100", isSel);
            checkIcon.classList.toggle("opacity-0", !isSel);
        }
    });

    // Fecha o menu
    if (container) container.classList.remove("open");
    if (menu) menu.classList.add("hidden");
}

export function initCustomSelectFiliais() {
    const container = document.getElementById("custom-select-filial-container");
    const trigger = document.getElementById("trigger-filial-braspress");
    const menu = document.getElementById("menu-filial-braspress");
    const searchInput = document.getElementById("search-input-filial-braspress");
    const optionsContainer = document.getElementById("options-filial-braspress");
    const countEl = document.getElementById("count-filiais-braspress");

    if (!container || !trigger || !menu || !optionsContainer) return;

    // Renderiza lista de opções formatadas em 2 linhas
    function renderOpcoesFiliais(filtro = "") {
        const t = filtro.toLowerCase().trim();
        const filiaisFiltradas = BRASPRESS_FILIAIS.filter(f => {
            if (!t) return true;
            const fullStr = `${f.cidade} ${f.nomeFantasia} ${f.sigla} ${f.uf} ${f.logradouro} ${f.bairro}`.toLowerCase();
            return fullStr.includes(t);
        });

        if (countEl) {
            countEl.textContent = `${filiaisFiltradas.length} unidade(s)`;
        }

        let html = filiaisFiltradas.map(f => {
            const optVal = `${f.cidade} - ${f.nomeFantasia} (${f.sigla}) / ${f.uf}`;
            const isSelected = DevolucaoState.logistica.filialBraspress === optVal;

            return `
                <div class="custom-select-option ${isSelected ? 'is-selected' : ''}" data-value="${optVal}" data-sigla="${f.sigla}">
                    <div class="min-w-0 flex-1">
                        <!-- Linha 1: Título da Filial em negrito -->
                        <div class="opt-title text-xs font-bold text-slate-800 flex items-center gap-2">
                            <span class="px-1.5 py-0.5 bg-slate-100 text-[#008497] font-mono text-[10px] font-bold rounded border border-slate-200">${f.uf}</span>
                            <span class="truncate">${f.cidade} — ${f.nomeFantasia} (${f.sigla})</span>
                        </div>
                        <!-- Linha 2: Endereço completo em cinza -->
                        <div class="text-[11px] text-slate-500 font-normal mt-0.5 truncate">
                            <i class="fa-solid fa-location-dot text-[10px] text-slate-400 mr-1"></i>${f.logradouro}, ${f.logNumero} - ${f.bairro || ''}
                        </div>
                    </div>
                    <i class="fa-solid fa-check text-xs text-[#008497] ${isSelected ? 'opacity-100' : 'opacity-0'} shrink-0"></i>
                </div>
            `;
        }).join("");

        // Opção "Outra filial" ao final
        const isOutraSel = DevolucaoState.logistica.filialBraspress === "outra";
        html += `
            <div class="custom-select-option bg-slate-50/70 border-t border-slate-200 ${isOutraSel ? 'is-selected' : ''}" data-value="outra">
                <div class="min-w-0 flex-1">
                    <div class="opt-title text-xs font-bold text-[#008497] flex items-center gap-2">
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                        <span>Outra filial / Digitar endereço manualmente</span>
                    </div>
                    <div class="text-[11px] text-slate-500 font-normal mt-0.5">
                        Selecione caso a base desejada não esteja na lista
                    </div>
                </div>
                <i class="fa-solid fa-check text-xs text-[#008497] ${isOutraSel ? 'opacity-100' : 'opacity-0'} shrink-0"></i>
            </div>
        `;

        if (filiaisFiltradas.length === 0) {
            html = `
                <div class="p-6 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-magnifying-glass text-xl mb-1 text-slate-300"></i>
                    <p class="font-medium text-slate-600">Nenhuma filial encontrada para "${filtro}".</p>
                </div>
            ` + html;
        }

        optionsContainer.innerHTML = html;
    }

    if (!_filiaisCustomSelectInitialized) {
        _filiaisCustomSelectInitialized = true;

        // Toggle dropdown open/close
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains("open");
            if (isOpen) {
                container.classList.remove("open");
                menu.classList.add("hidden");
                trigger.setAttribute("aria-expanded", "false");
            } else {
                // Fecha outros menus abertos
                document.querySelectorAll('.dropdown-acoes-menu.show').forEach(m => m.classList.remove('show'));
                container.classList.add("open");
                menu.classList.remove("hidden");
                trigger.setAttribute("aria-expanded", "true");
                renderOpcoesFiliais(searchInput?.value || "");
                setTimeout(() => searchInput?.focus(), 50);
            }
        });

        // Filtragem por digitação no search input
        searchInput?.addEventListener("input", (e) => {
            renderOpcoesFiliais(e.target.value);
        });

        // Clique em uma opção
        optionsContainer.addEventListener("click", (e) => {
            const opt = e.target.closest(".custom-select-option");
            if (!opt) return;
            const val = opt.dataset.value;
            const sigla = opt.dataset.sigla;
            const fObj = sigla ? BRASPRESS_FILIAIS.find(f => f.sigla === sigla) : null;
            selecionarFilialBraspress(val, fObj);
        });

        // Fecha ao clicar fora
        document.addEventListener("click", (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove("open");
                menu.classList.add("hidden");
                trigger.setAttribute("aria-expanded", "false");
            }
        });

        // Fecha com tecla ESC
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && container.classList.contains("open")) {
                container.classList.remove("open");
                menu.classList.add("hidden");
                trigger.setAttribute("aria-expanded", "false");
                trigger.focus();
            }
        });
    }

    renderOpcoesFiliais(searchInput?.value || "");
}

/**
 * ETAPA 3: Renderização de Logística (4 Modalidades)
 */
function renderEtapa3Logistica() {
    const tipo = DevolucaoState.logistica.tipo || "braspress";

    // Alterna visual dos cards de seleção
    document.querySelectorAll(".logistica-card").forEach(card => {
        const cardTipo = card.dataset.tipo;
        card.classList.toggle("selected", cardTipo === tipo);
    });

    const cBras = document.getElementById("container-braspress-fields");
    const cRetira = document.getElementById("container-braspress-retira-fields");
    const cMakita = document.getElementById("container-filial-makita-fields");
    const cReg = document.getElementById("container-regional-fields");

    if (cBras) cBras.classList.toggle("hidden", tipo !== "braspress");
    if (cRetira) cRetira.classList.toggle("hidden", tipo !== "braspress_retira");
    if (cMakita) cMakita.classList.toggle("hidden", tipo !== "filial_makita");
    if (cReg) cReg.classList.toggle("hidden", tipo !== "transportadora_regional");

    if (tipo === "braspress") {
        initCustomSelectFiliais();
        selecionarFilialBraspress(DevolucaoState.logistica.filialBraspress || "São Paulo - Matriz/Vila Maria (SP)");
    } else if (tipo === "braspress_retira") {
        const ret = DevolucaoState.logistica.braspressRetira;
        const elCep = document.getElementById("input-retira-cep");
        const elRua = document.getElementById("input-retira-rua");
        const elNum = document.getElementById("input-retira-numero");
        const elComp = document.getElementById("input-retira-complemento");
        const elBairro = document.getElementById("input-retira-bairro");
        const elCidade = document.getElementById("input-retira-cidade");
        const elUf = document.getElementById("input-retira-uf");
        const elRef = document.getElementById("input-retira-referencia");
        const elTel = document.getElementById("input-retira-telefone");

        if (elCep) elCep.value = ret?.cep || "";
        if (elRua) elRua.value = ret?.logradouro || "";
        if (elNum) elNum.value = ret?.numero || "";
        if (elComp) elComp.value = ret?.complemento || "";
        if (elBairro) elBairro.value = ret?.bairro || "";
        if (elCidade) elCidade.value = ret?.cidade || "";
        if (elUf) elUf.value = ret?.uf || "";
        if (elRef) elRef.value = ret?.referencia || "";
        if (elTel) elTel.value = ret?.telefone || "";
    } else if (tipo === "filial_makita") {
        renderFiliaisMakitaCards();
    } else if (tipo === "transportadora_regional") {
        const reg = DevolucaoState.logistica.transportadoraRegional;
        const elCnpj = document.getElementById("input-reg-cnpj");
        const elNome = document.getElementById("input-reg-nome");
        const elFantasia = document.getElementById("input-reg-fantasia");
        const elTel = document.getElementById("input-reg-tel");
        const elEnd = document.getElementById("input-reg-endereco");
        const elCidade = document.getElementById("input-reg-cidade");
        const elUf = document.getElementById("input-reg-uf");
        const elContato = document.getElementById("input-reg-contato");
        const elMotivo = document.getElementById("input-reg-motivo");

        if (elCnpj) elCnpj.value = reg?.cnpj || "";
        if (elNome) elNome.value = reg?.nome || "";
        if (elFantasia) elFantasia.value = reg?.nomeFantasia || "";
        if (elTel) elTel.value = reg?.telefone || "";
        if (elEnd) elEnd.value = reg?.logradouro || "";
        if (elCidade) elCidade.value = reg?.cidade || "";
        if (elUf) elUf.value = reg?.uf || "";
        if (elContato) elContato.value = reg?.contato || "";
        if (elMotivo) elMotivo.value = reg?.motivo || DevolucaoState.logistica.motivoEscolhaRegional || "";
    }
}

/**
 * Renderiza os cards das Unidades e Filiais Oficiais da Makita do Brasil
 */
function renderFiliaisMakitaCards() {
    const grid = document.getElementById("grid-filiais-makita-cards");
    if (!grid) return;

    const currentSelectedId = DevolucaoState.logistica?.filialMakita?.id || "sbc_cd";

    grid.innerHTML = FILIAIS_MAKITA.map(f => {
        const isSelected = f.id === currentSelectedId;
        return `
            <div class="filial-makita-card p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected ? 'border-[#008497] bg-[#008497]/5 ring-2 ring-[#008497]' : 'border-slate-200 bg-white hover:border-[#008497]/60 hover:bg-slate-50'}" data-id="${f.id}">
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-lg ${isSelected ? 'bg-[#008497] text-white' : 'bg-slate-100 text-[#008497]'} flex items-center justify-center text-xs shrink-0">
                                <i class="${f.icone}"></i>
                            </div>
                            <span class="font-bold text-xs ${isSelected ? 'text-[#008497]' : 'text-slate-800'}">${f.nome}</span>
                        </div>
                        ${isSelected ? '<i class="fa-solid fa-circle-check text-[#008497] text-sm"></i>' : '<div class="w-4 h-4 rounded-full border border-slate-300"></div>'}
                    </div>
                    <span class="text-[10px] text-slate-500 font-semibold block">${f.unidade}</span>
                    <p class="text-[11px] text-slate-600 mt-1 line-clamp-2">${f.logradouro} - ${f.bairro} (${f.cidade}/${f.uf})</p>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-500">
                    <span class="font-mono">${f.telefone}</span>
                    <span class="font-bold text-[#008497]">${f.destaque}</span>
                </div>
            </div>
        `;
    }).join("");

    grid.querySelectorAll(".filial-makita-card").forEach(card => {
        card.addEventListener("click", () => {
            const fid = card.dataset.id;
            const branch = FILIAIS_MAKITA.find(b => b.id === fid);
            if (branch) {
                DevolucaoState.logistica.filialMakita = branch;
                renderFiliaisMakitaCards();
                atualizarCardResumoFilialMakita(branch);
            }
        });
    });

    const initialBranch = FILIAIS_MAKITA.find(b => b.id === currentSelectedId) || FILIAIS_MAKITA[0];
    atualizarCardResumoFilialMakita(initialBranch);
}

function atualizarCardResumoFilialMakita(branch) {
    if (!branch) return;
    const elNome = document.getElementById("makita-sel-nome");
    const elUnidade = document.getElementById("makita-sel-unidade");
    const elCnpj = document.getElementById("makita-sel-cnpj");
    const elEndereco = document.getElementById("makita-sel-endereco");
    const elTelefone = document.getElementById("makita-sel-telefone");

    if (elNome) elNome.textContent = branch.nome;
    if (elUnidade) elUnidade.textContent = branch.unidade;
    if (elCnpj) elCnpj.textContent = branch.cnpj;
    if (elEndereco) elEndereco.textContent = `${branch.logradouro} - ${branch.bairro} - ${branch.cidade}/${branch.uf} - CEP: ${branch.cep}`;
    if (elTelefone) elTelefone.textContent = branch.telefone;
}

/**
 * ETAPA 4: Renderização de Resumo e Conferência
 */
function renderEtapa4Resumo() {
    const p = (DevolucaoState.idEmEdicao && DevolucaoState.solicitanteEmEdicao)
        ? DevolucaoState.solicitanteEmEdicao
        : AuthState.profile;
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
                    <span class="font-bold text-[#008497] bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-xs inline-block">
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
    const elPeso = document.getElementById("resumo-volumes-peso");
    if (elPeso) elPeso.textContent = DevolucaoState.volumes.pesoAproximadoKg ? `${DevolucaoState.volumes.pesoAproximadoKg} kg aprox.` : "Não informado";
    document.getElementById("resumo-volumes-obs").textContent = DevolucaoState.volumes.observacoesEmbalagem || "Nenhuma observação de embalagem.";

    // Logística Resumo para as 4 modalidades
    const tipo = DevolucaoState.logistica.tipo || "braspress";
    const elLogTipo = document.getElementById("resumo-logistica-tipo");
    const elLogDetalhe = document.getElementById("resumo-logistica-detalhe");

    if (tipo === "braspress") {
        const filial = DevolucaoState.logistica.filialBraspress === "outra" ? DevolucaoState.logistica.filialOutraTexto : DevolucaoState.logistica.filialBraspress;
        if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5"><i class="fa-solid fa-warehouse"></i> Retirada em Filial Brasspress</span>`;
        if (elLogDetalhe) elLogDetalhe.textContent = filial || "Filial não especificada";
    } else if (tipo === "braspress_retira") {
        const ret = DevolucaoState.logistica.braspressRetira;
        if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5"><i class="fa-solid fa-truck-pickup"></i> Brasspress Retira no Endereço</span>`;
        if (elLogDetalhe) elLogDetalhe.textContent = `${ret.logradouro || ''}, ${ret.numero || ''} - ${ret.bairro || ''} (${ret.cidade || ''}/${ret.uf || ''}) — CEP: ${ret.cep || ''}`;
    } else if (tipo === "filial_makita") {
        const mak = DevolucaoState.logistica.filialMakita;
        if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5"><i class="fa-solid fa-building-flag"></i> Retirada em Filial Makita</span>`;
        if (elLogDetalhe) elLogDetalhe.textContent = `${mak?.nome || 'Makita'} (${mak?.unidade || ''}) — ${mak?.logradouro || ''} (${mak?.cidade || ''}/${mak?.uf || ''}) — Tel: ${mak?.telefone || ''}`;
    } else if (tipo === "transportadora_regional") {
        const reg = DevolucaoState.logistica.transportadoraRegional;
        if (elLogTipo) elLogTipo.innerHTML = `<span class="text-slate-800 flex items-center gap-1.5"><i class="fa-solid fa-truck-ramp-box text-[#008497]"></i> Transportadora Regional Indicada</span>`;
        if (elLogDetalhe) elLogDetalhe.textContent = `${reg.nome || ''} ${reg.cnpj ? '(CNPJ: ' + reg.cnpj + ')' : ''} — ${reg.cidade || ''}/${reg.uf || ''} — Tel: ${reg.telefone || '-'}`;
    }

    document.getElementById("resumo-obs-gerais").textContent = DevolucaoState.observacoesGerais || "Sem observações adicionais.";

    // Atualiza texto do botão final conforme modo de edição
    const btnConfirmar = document.getElementById("btn-confirmar-final");
    if (btnConfirmar) {
        if (DevolucaoState.idEmEdicao) {
            btnConfirmar.innerHTML = `<i class="fa-solid fa-floppy-disk mr-2"></i> Salvar Alterações da Solicitação`;
            btnConfirmar.className = "px-8 py-3 bg-[#008497] hover:bg-[#006064] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer";
        } else {
            btnConfirmar.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Confirmar Solicitação`;
            btnConfirmar.className = "px-8 py-3 bg-[#008497] hover:bg-[#006064] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer";
        }
    }
}

let _modalSucessoTimer = null;

/**
 * Limpa completamente o estado da devolução e todos os inputs do formulário
 */
export function limparFormulariosEInputsDevolucao() {
    reiniciarFluxoDevolucao();
    _nfeListenersAttached = false;
    _nfeSearchTerm = "";
    _nfeFilterField = "todos";

    // 1. Limpa campos de volumes (Etapa 2)
    const elQtdVol = document.getElementById("input-qtd-volumes");
    if (elQtdVol) elQtdVol.value = "1";
    const elPesoVol = document.getElementById("input-peso-volumes");
    if (elPesoVol) elPesoVol.value = "";
    const elObsVol = document.getElementById("input-obs-volumes");
    if (elObsVol) elObsVol.value = "";

    // 2. Limpa campos de coleta Braspress Retira (Etapa 3)
    const idsColeta = [
        "input-retira-cep", "input-retira-rua", "input-retira-numero",
        "input-retira-complemento", "input-retira-bairro", "input-retira-cidade",
        "input-retira-uf", "input-retira-referencia", "input-retira-telefone"
    ];
    idsColeta.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 3. Limpa campos de transportadora regional (Etapa 3)
    const idsRegional = [
        "input-reg-cnpj", "input-reg-nome", "input-reg-fantasia", "input-reg-tel",
        "input-reg-endereco", "input-reg-cidade", "input-reg-uf", "input-reg-contato", "input-reg-motivo"
    ];
    idsRegional.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 4. Limpa busca de CEP Braspress, filial customizada e observações gerais
    const elCepBras = document.getElementById("input-cep-braspress");
    if (elCepBras) elCepBras.value = "";
    const elOutraFilial = document.getElementById("input-filial-braspress-outra");
    if (elOutraFilial) elOutraFilial.value = "";
    const elObsGerais = document.getElementById("input-obs-gerais-etapa3");
    if (elObsGerais) elObsGerais.value = "";
    const elSearchNfe = document.getElementById("input-nfe-search");
    if (elSearchNfe) elSearchNfe.value = "";

    // 5. Atualiza imediatamente o DOM para a Etapa 1 (Itens/Ativos)
    renderFluxoDevolucao();
    renderMiniRelatorioAtivos();
}

let _autoRedirectTimer = null;

export function cancelarAutoRedirecionamento() {
    if (_autoRedirectTimer) {
        clearTimeout(_autoRedirectTimer);
        _autoRedirectTimer = null;
    }
}

export function fecharModalSucesso(irParaNovaDevolucao = false) {
    if (_modalSucessoTimer) {
        clearTimeout(_modalSucessoTimer);
        _modalSucessoTimer = null;
    }
    cancelarAutoRedirecionamento();

    const modal = document.getElementById("modal-sucesso-devolucao");
    if (modal) {
        modal.classList.add("hidden");
    }
    limparFormulariosEInputsDevolucao();
        
        const isAdmin = Boolean(AuthState.profile?.isAdmin || ADMIN_EMAILS.includes(AuthState.profile?.email));
        if (isAdmin) {
            setTab("adm-geral");
            renderAdmGeralScreen();
        } else if (irParaNovaDevolucao === true) {
            // Clicou no botão "Nova Solicitação" -> Direciona imediatamente para Etapa 1
            setTab("devolucao");
            carregarItensDoUsuario().then(() => {
                renderFluxoDevolucao();
                renderMiniRelatorioAtivos();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        } else {
            // Fechou no "X" ou tempo esgotou (10s): Redireciona para Minhas Devoluções por 6 segundos e retorna para Ativos / Itens
            setTab("historico");
            carregarHistorico().then(() => {
                renderHistorico();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });

            showToast("Visualizando em Minhas Devoluções. Retornando para Ativos em 6s...", "info");

            _autoRedirectTimer = setTimeout(() => {
                // Se o usuário ainda estiver na aba de histórico e não tiver navegado manualmente
                if (currentTab === "historico") {
                    setTab("devolucao");
                    carregarItensDoUsuario().then(() => {
                        renderFluxoDevolucao();
                        renderMiniRelatorioAtivos();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        showToast("Pronto para uma nova solicitação de devolução.", "info");
                    });
                }
                _autoRedirectTimer = null;
            }, 6000);
        }
}

/**
 * Modal de Confirmação de Sucesso da Devolução
 */
function exibirModalSucessoDevolucao(sol) {
    const modal = document.getElementById("modal-sucesso-devolucao");
    if (!modal) return;

    const solicitanteNome = sol?.solicitante?.nome || AuthState.profile?.nome || "Colaborador";
    const protheusCode = sol?.solicitante?.protheus || AuthState.profile?.protheus || "—";
    const qtdVolumes = sol?.volumes?.quantidadeCaixas || DevolucaoState.volumes.quantidadeCaixas || 1;

    const elNome = document.getElementById("modal-sucesso-solicitante");
    const elProtheus = document.getElementById("modal-sucesso-protheus");
    const elVolumes = document.getElementById("modal-sucesso-volumes");
    const elListaItens = document.getElementById("modal-sucesso-itens-lista");

    if (elNome) {
        elNome.textContent = solicitanteNome;
        elNome.title = solicitanteNome;
    }
    if (elProtheus) elProtheus.textContent = protheusCode;
    if (elVolumes) elVolumes.textContent = `${qtdVolumes} ${qtdVolumes > 1 ? 'caixas' : 'caixa'}`;

    // Renderiza a lista de itens devolvidos
    if (elListaItens) {
        const itensArr = (sol && Array.isArray(sol.itens) && sol.itens.length > 0)
            ? sol.itens
            : Array.from(DevolucaoState.itensSelecionados.values());

        if (itensArr.length > 0) {
            elListaItens.innerHTML = itensArr.map(it => {
                const cod = it.codigoItem || it.produto || "—";
                const desc = it.descricao || "—";
                const nf = it.notaFiscal || it.nfRemessa || "—";
                const qtd = it.quantidadeDevolvida || it.quantidade || it.saldo || 1;

                return `
                    <div class="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs gap-2">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 whitespace-nowrap">
                                <span class="font-mono font-bold text-[#008497] shrink-0">${cod}</span>
                                <span class="text-[10px] text-slate-400 font-mono shrink-0">NF: ${nf}</span>
                            </div>
                            <p class="text-[11px] text-slate-600 truncate mt-0.5 whitespace-nowrap" title="${desc}">${desc}</p>
                        </div>
                        <span class="bg-[#008497] text-white font-bold px-2.5 py-0.5 rounded text-[11px] shrink-0 whitespace-nowrap shadow-2xs">
                            ${qtd} un
                        </span>
                    </div>
                `;
            }).join("");
        } else {
            elListaItens.innerHTML = `<p class="text-slate-400 text-center py-2 text-xs">Nenhum item especificado.</p>`;
        }
    }

    // Exibe o modal centralizado com backdrop
    modal.classList.remove("hidden");

    // Limpa timer anterior caso exista
    if (_modalSucessoTimer) {
        clearTimeout(_modalSucessoTimer);
        _modalSucessoTimer = null;
    }

    // Auto-close em no máximo 10 segundos
    _modalSucessoTimer = setTimeout(() => {
        fecharModalSucesso();
    }, 10000);
}

/**
 * Formata a célula de Logística para a tabela de Histórico e Gestão Geral ADM
 */
function _formatLogisticaColuna(logistica) {
    if (!logistica) return '<span class="text-slate-400 text-xs">—</span>';

    const tipo = logistica.tipo;
    if (tipo === "braspress") {
        const filial = logistica.filialBraspress === "outra" ? logistica.filialOutraTexto : logistica.filialBraspress;
        return `
            <div>
                <div class="font-semibold text-[#0f172a] text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-warehouse text-[#008497] text-xs"></i> Braspress (Filial)
                </div>
                <div class="text-[11px] text-[#64748b] font-normal truncate max-w-[200px]" title="${filial || ''}">${filial || 'Filial não indicada'}</div>
            </div>
        `;
    } else if (tipo === "braspress_retira") {
        const ret = logistica.braspressRetira;
        const endStr = ret ? `${ret.cidade || ''}/${ret.uf || ''} (CEP: ${ret.cep || '-'})` : 'Endereço indicado';
        return `
            <div>
                <div class="font-semibold text-[#0f172a] text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-truck-pickup text-[#008497] text-xs"></i> Braspress (Coleta)
                </div>
                <div class="text-[11px] text-[#64748b] font-normal truncate max-w-[200px]" title="${endStr}">${endStr}</div>
            </div>
        `;
    } else if (tipo === "filial_makita") {
        const mak = logistica.filialMakita;
        const nomeMak = mak?.nome || mak?.unidade || "Filial Oficial";
        return `
            <div>
                <div class="font-semibold text-[#0f172a] text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-building-flag text-[#008497] text-xs"></i> Filial Makita
                </div>
                <div class="text-[11px] text-[#64748b] font-normal truncate max-w-[200px]" title="${nomeMak}">${nomeMak}</div>
            </div>
        `;
    } else {
        const reg = logistica.transportadoraRegional;
        const regNome = reg?.nome || "Transp. Regional";
        const regLoc = reg ? `${reg.cidade || logistica.cidadeOrigem || ''}/${reg.uf || logistica.ufOrigem || ''}` : '';
        return `
            <div>
                <div class="font-semibold text-[#0f172a] text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-truck-ramp-box text-[#008497] text-xs"></i> Transp. Regional
                </div>
                <div class="text-[11px] text-[#64748b] font-normal truncate max-w-[200px]" title="${regNome} ${regLoc}">${regNome} ${regLoc ? '• ' + regLoc : ''}</div>
            </div>
        `;
    }
}

/**
 * Renderiza o ID/Protocolo na tabela (sem tooltip flutuante, popup no hover ou atributo title)
 * Clicável diretamente para abrir os detalhes da solicitação
 */
function _renderIdTooltip(sol, key) {
    const prot = sol.protocolo || sol.id || "S/ PROTOCOLO";
    const targetKey = key || sol.id || sol.protocolo || "";
    return `<button type="button" 
                    class="font-mono font-bold text-[#008497] hover:text-[#006064] hover:underline cursor-pointer text-xs bg-transparent border-0 p-0 text-left transition-colors" 
                    data-action="view" 
                    data-id="${targetKey}" 
                    onclick="window.appVerDetalhesSolicitacao('${targetKey}')">
                ${prot}
            </button>`;
}


export async function renderHistorico() {
    const listContainer = document.getElementById("historico-lista") || document.getElementById("historico-list-container");
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-[#008497]"></i>
            <p>Carregando histórico de devoluções...</p>
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

    listContainer.innerHTML = HistoricoState.solicitacoes.map((sol, index) => {
        const key = registrarSolicitacao(sol);
        const badge = getStatusBadge(sol.status);
        const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        const totalAtivos = sol.itens ? sol.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0) : Number(sol.totalItens || 1);
        const totalNFe = sol.itens ? (new Set(sol.itens.map(it => it.notaFiscal).filter(Boolean))).size || (new Set(sol.notasFiscais || [])).size || 1 : 1;
        const caixas = sol.volumes?.quantidadeCaixas || 1;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <!-- 1. ID / Protocolo -->
                <td class="whitespace-nowrap">
                    ${_renderIdTooltip(sol, key)}
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

                <!-- 5. Logística (4 Modalidades) -->
                <td class="whitespace-nowrap">
                    ${_formatLogisticaColuna(sol.logistica)}
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
                        <button type="button" class="btn-acoes-toggle cursor-pointer" data-toggle="dropdown" data-id="${key}">
                            <i class="fa-solid fa-ellipsis text-xs text-slate-700"></i>
                            <span>Ações</span>
                            <i class="fa-solid fa-chevron-down text-[9px] text-slate-400"></i>
                        </button>
                    
                        <!-- Lista / Menu Dropdown Dinâmico -->
                        <div class="dropdown-acoes-menu" id="dropdown-${key}">
                            <button type="button" class="dropdown-item cursor-pointer" data-action="view" data-id="${key}" onclick="window.appVerDetalhesSolicitacao('${key}')">
                                <i class="fa-solid fa-eye text-xs text-[#008497]"></i>
                                <span>Visualizar Detalhes</span>
                            </button>
                            <button type="button" class="dropdown-item cursor-pointer" data-action="edit" data-id="${key}">
                                <i class="fa-solid fa-pen-to-square text-xs text-[#008497]"></i>
                                <span>Editar Solicitação</span>
                            </button>
                            <div class="dropdown-divider"></div>
                            <button type="button" class="dropdown-item text-rose-600 hover:bg-rose-50 hover:text-rose-700" data-action="delete" data-id="${key}">
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
let _unsubscribeAdmRealtime = null;

export async function renderAdmGeralScreen() {
    const tbody = document.getElementById("tbody-adm-main-solicitacoes");

    if (tbody && (!_todasSolicitacoesCache || _todasSolicitacoesCache.length === 0)) {
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
        _filtrarERenderizarAdmGeral();
    } catch (e) {
        console.error("Erro ao carregar solicitações para o ADM:", e);
        _todasSolicitacoesCache = [];
        _filtrarERenderizarAdmGeral();
    }

    // Inicia listener em tempo real para sincronizar assim que promotores enviarem novas solicitações
    if (!_unsubscribeAdmRealtime) {
        _unsubscribeAdmRealtime = ouvirTodasSolicitacoesRealtime((novasSolicitacoes) => {
            _todasSolicitacoesCache = novasSolicitacoes;
            _filtrarERenderizarAdmGeral();
        });
    }
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
    const totalSolic = filtradas.length;

    const totalItens = filtradas.reduce((acc, s) => {
        const q = s.itens ? s.itens.reduce((sum, it) => sum + Number(it.quantidadeDevolvida || it.quantidade || 1), 0) : Number(s.totalItens || 0);
        return acc + q;
    }, 0);

    const totalBraspress = filtradas.filter(s => {
        const isBraspress = (s.logistica?.tipo === "braspress" || s.status === "brasspress");
        const statusAlterado = (s.status && s.status !== "pendente") || (Array.isArray(s.historico_status) && s.historico_status.length > 0);
        return isBraspress && statusAlterado;
    }).length;

    const totalRegional = filtradas.filter(s => {
        const isRegional = (s.logistica?.tipo === "transportadora_regional" || (s.logistica?.tipo !== "braspress" && s.status !== "brasspress"));
        const statusAlterado = (s.status && s.status !== "pendente") || (Array.isArray(s.historico_status) && s.historico_status.length > 0);
        return isRegional && statusAlterado;
    }).length;

    // Atualiza badges/cards de KPI no DOM
    const kpiSolic = document.getElementById("adm-main-kpi-total-solic") || document.getElementById("kpi-adm-total-solicitacoes");
    const kpiItens = document.getElementById("adm-main-kpi-total-itens") || document.getElementById("kpi-adm-total-itens");
    const kpiBras = document.getElementById("adm-main-kpi-braspress") || document.getElementById("kpi-adm-despacho-braspress");
    const kpiReg = document.getElementById("adm-main-kpi-regional") || document.getElementById("kpi-adm-transp-regionais");
    const admGreeting = document.getElementById("adm-main-greeting");

    if (kpiSolic) kpiSolic.textContent = totalSolic;
    if (kpiItens) kpiItens.textContent = `${totalItens} un`;
    if (kpiBras) kpiBras.textContent = totalBraspress;
    if (kpiReg) kpiReg.textContent = totalRegional;
    if (admGreeting && AuthState.profile) {
        admGreeting.textContent = `Olá, ${formatNomeTitleCase(AuthState.profile.nome)} 👋`;
    }

    if (filtradas.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-12 bg-white">
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
        tbody.innerHTML = filtradas.map((sol, index) => {
            const key = registrarSolicitacao(sol);
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
                    <!-- 1. ID / Protocolo -->
                    <td class="whitespace-nowrap">
                        ${_renderIdTooltip(sol, key)}
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

                    <!-- 6. Logística (4 Modalidades) -->
                    <td class="whitespace-nowrap">
                        ${_formatLogisticaColuna(sol.logistica)}
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
                            <button type="button" class="btn-acoes-toggle cursor-pointer" data-toggle="dropdown" data-id="${key}">
                                <i class="fa-solid fa-ellipsis text-xs text-slate-700"></i>
                                <span>Ações</span>
                                <i class="fa-solid fa-chevron-down text-[9px] text-slate-400"></i>
                            </button>

                            <!-- Lista / Menu Dropdown Dinâmico -->
                            <div class="dropdown-acoes-menu" id="dropdown-${key}">
                                <button type="button" class="dropdown-item cursor-pointer" data-action="view" data-id="${key}" onclick="window.appVerDetalhesSolicitacao('${key}')">
                                    <i class="fa-solid fa-eye text-xs text-[#008497]"></i>
                                    <span>Visualizar Detalhes</span>
                                </button>
                                <button type="button" class="dropdown-item cursor-pointer" data-action="edit" data-id="${key}">
                                    <i class="fa-solid fa-pen-to-square text-xs text-[#008497]"></i>
                                    <span>Editar Solicitação</span>
                                </button>
                                <div class="dropdown-divider"></div>
                                <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Alterar Status
                                </div>
                                ${Object.values(STATUS_DEVOLUCAO).map(st => `
                                    <button type="button" class="dropdown-item ${st.key === statusInfo.key ? 'font-bold text-[#008497]' : ''}" data-action="status" data-status="${st.key}" data-id="${key}">
                                        <i class="${st.icon} ${st.iconColor} text-xs w-4 text-center"></i>
                                        <span>${st.label}</span>
                                    </button>
                                `).join("")}
                                <div class="dropdown-divider"></div>
                                <button type="button" class="dropdown-item text-rose-600 hover:bg-rose-50 hover:text-rose-700" data-action="delete" data-id="${key}">
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
    const loginLoading = document.getElementById("login-loading");

    function showLoginErr(msg) {
        console.warn("[Makita Login] Erro na validação:", msg);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = "Seguinte";
        }
        if (loginLoading) {
            loginLoading.classList.add("hidden", "pointer-events-none");
            loginLoading.style.setProperty("display", "none", "important");
        }
        if (loginErrorEl) {
            loginErrorEl.textContent = msg;
            loginErrorEl.classList.remove("hidden");
            loginErrorEl.style.removeProperty("display");
            loginErrorEl.style.setProperty("display", "block", "important");
        }
        if (inputEl) inputEl.style.setProperty("border-bottom", "2px solid #e81123", "important");
    }
    function clearLoginErr() {
        if (loginErrorEl) {
            loginErrorEl.textContent = "";
            loginErrorEl.classList.add("hidden");
            loginErrorEl.style.setProperty("display", "none", "important");
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

    const emailInput = (inputEl?.value || "").trim().toLowerCase();
    console.log("[Makita Login] Clique / Enter detectado no login. Termo digitado:", emailInput);
    clearLoginErr();

    // 1. Validação de campo vazio
    if (!emailInput) {
        showLoginErr("Insira o seu endereço de e-mail corporativo completo.");
        inputEl?.focus();
        return;
    }

    // 2. Validação de formato (deve conter @)
    if (!emailInput.includes("@")) {
        showLoginErr("Insira o endereço de e-mail corporativo completo (exemplo: usuario@makita.com.br).");
        inputEl?.focus();
        return;
    }

    // 3. Validação estrita de domínio corporativo (@makita.com.br / @makitabr.onmicrosoft.com)
    const isDomainMakita = emailInput.endsWith("@makita.com.br") || emailInput.endsWith("@makitabr.onmicrosoft.com");
    if (!isDomainMakita) {
        showLoginErr("Acesso não permitido: Apenas contas corporativas (@makita.com.br) são autorizadas.");
        inputEl?.focus();
        return;
    }

    setBtnLoading(true);

    try {
        console.log("[Makita Login] Buscando vínculo Protheus para:", emailInput);
        const vinculo = await buscarVinculoProtheus(emailInput);
        console.log("[Makita Login] Resultado do vínculo:", vinculo);

        if (!vinculo) {
            setBtnLoading(false);
            showLoginErr(`O e-mail "${emailInput}" não foi encontrado na base autorizada de promotores da Makita.`);
            return;
        }

        console.log("[Makita Login] Realizando login para:", vinculo.email || emailInput);
        await simularLogin(vinculo.email || emailInput);
        console.log("[Makita Login] Login simulado concluído com sucesso!");

    } catch (err) {
        console.error("[Makita Login] Erro inesperado ao verificar acesso:", err);
        setBtnLoading(false);
        showLoginErr("Ocorreu um erro ao verificar o acesso. Tente novamente.");
    } finally {
        setTimeout(() => {
            if (!AuthState.user && btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = "Seguinte";
            }
        }, 3500);
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
    const btnLogin = document.getElementById("btn-seguinte");
    const inputLogin = document.getElementById("login-email");

    btnLogin?.addEventListener("click", (e) => {
        e.preventDefault();
        handleMsLogin();
    });

    inputLogin?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleMsLogin();
        }
    });

    document.addEventListener("click", (e) => {
        if (e.target && (e.target.id === "btn-seguinte" || e.target.closest("#btn-seguinte, #btn-login-ms"))) {
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
        btn.addEventListener("click", () => {
            cancelarAutoRedirecionamento();
            setTab(btn.dataset.tab);
        });
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
                const tipo = DevolucaoState.logistica.tipo || "braspress";
                if (tipo === "braspress") {
                    DevolucaoState.logistica.filialBraspress = document.getElementById("select-filial-braspress")?.value || "";
                    DevolucaoState.logistica.filialOutraTexto = document.getElementById("input-filial-braspress-outra")?.value || "";
                } else if (tipo === "braspress_retira") {
                    DevolucaoState.logistica.braspressRetira = {
                        cep: (document.getElementById("input-retira-cep")?.value || "").replace(/\D/g, ""),
                        logradouro: document.getElementById("input-retira-rua")?.value || "",
                        numero: document.getElementById("input-retira-numero")?.value || "",
                        complemento: document.getElementById("input-retira-complemento")?.value || "",
                        bairro: document.getElementById("input-retira-bairro")?.value || "",
                        cidade: document.getElementById("input-retira-cidade")?.value || "",
                        uf: (document.getElementById("input-retira-uf")?.value || "").toUpperCase(),
                        referencia: document.getElementById("input-retira-referencia")?.value || "",
                        telefone: document.getElementById("input-retira-telefone")?.value || "",
                        observacoes: document.getElementById("input-obs-gerais-etapa3")?.value || ""
                    };
                } else if (tipo === "filial_makita") {
                    // Filial selecionada já configurada no clique do card
                } else if (tipo === "transportadora_regional") {
                    DevolucaoState.logistica.transportadoraRegional = {
                        cnpj: (document.getElementById("input-reg-cnpj")?.value || "").replace(/\D/g, ""),
                        nome: document.getElementById("input-reg-nome")?.value || "",
                        nomeFantasia: document.getElementById("input-reg-fantasia")?.value || "",
                        telefone: document.getElementById("input-reg-tel")?.value || "",
                        logradouro: document.getElementById("input-reg-endereco")?.value || "",
                        cidade: document.getElementById("input-reg-cidade")?.value || "",
                        uf: (document.getElementById("input-reg-uf")?.value || "").toUpperCase(),
                        contato: document.getElementById("input-reg-contato")?.value || "",
                        motivo: document.getElementById("input-reg-motivo")?.value || ""
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

    // 6. Confirmação Final e Gravação no Firestore (Abre o Modal de Sucesso)
    document.getElementById("btn-confirmar-final")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirmar-final");
        const isEditing = Boolean(DevolucaoState.idEmEdicao);
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ${isEditing ? 'Salvando Alterações...' : 'Confirmando Solicitação...'}`;

        try {
            const res = await confirmarEGravarSolicitacao();
            showToast(isEditing ? "Solicitação de devolução atualizada com sucesso!" : "Solicitação de devolução registrada com sucesso!", "success");
            exibirModalSucessoDevolucao(res);
        } catch (err) {
            showToast("Erro ao gravar solicitação: " + err.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = isEditing 
                ? `<i class="fa-solid fa-floppy-disk mr-2"></i> Salvar Alterações da Solicitação`
                : `<i class="fa-solid fa-check mr-2"></i> Confirmar Solicitação`;
        }
    });

    // 6.1. Botão Cancelar Modo de Edição no Banner
    document.getElementById("btn-cancelar-edicao-banner")?.addEventListener("click", async () => {
        reiniciarFluxoDevolucao();
        const isAdmin = Boolean(AuthState.profile?.isAdmin || ADMIN_EMAILS.includes(AuthState.profile?.email));
        if (isAdmin) {
            setTab("adm-geral");
            renderAdmGeralScreen();
            showToast("Modo de edição cancelado. Retornando ao painel de administração.", "info");
        } else {
            await carregarItensDoUsuario();
            renderFluxoDevolucao();
            renderMiniRelatorioAtivos();
            showToast("Modo de edição cancelado. Pronto para nova solicitação.", "info");
        }
    });

    // 7. Botão Nova Devolução e Botão X de fechar dentro do Modal de Sucesso
    document.getElementById("btn-modal-nova-devolucao")?.addEventListener("click", () => fecharModalSucesso(true));
    document.getElementById("btn-fechar-modal-sucesso-x")?.addEventListener("click", () => fecharModalSucesso(false));

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
        if (elNome) elNome.innerHTML = `<i class="fa-solid fa-star text-[#008497] mr-1.5"></i> Filial Recomendada: <strong>${f.nomeFantasia} (${f.sigla})</strong>`;
        if (elDist) elDist.textContent = res.distanciaKm !== null ? `~ ${res.distanciaKm} km de você` : `Sugerida por ${f.uf}`;
        if (elEndUser) elEndUser.innerHTML = `<i class="fa-solid fa-location-dot text-[#008497] mr-1.5"></i> <strong>Seu endereço:</strong> ${res.enderecoUsuario}`;
        if (elDetalhes) elDetalhes.innerHTML = `<i class="fa-solid fa-building text-[#008497] mr-1.5"></i> <strong>Endereço Filial:</strong> ${f.logradouro}, ${f.logNumero} - ${f.bairro} (${f.cidade}/${f.uf}) <br> <i class="fa-solid fa-phone text-[#008497] mr-1.5 mt-1.5 inline-block"></i> <strong>Telefone:</strong> ${f.fone}`;

        if (cardResultado) cardResultado.classList.remove("hidden");

        // Seleciona automaticamente a filial recomendada no dropdown customizado
        const optVal = `${f.cidade} - ${f.nomeFantasia} (${f.sigla}) / ${f.uf}`;
        selecionarFilialBraspress(optVal, f);
    }

    btnBuscarCep?.addEventListener("click", handleBuscarFilialPorCep);
    inputCep?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleBuscarFilialPorCep();
        }
    });

    // 8.2. Busca de CEP para Brasspress Retira no Endereço
    const btnBuscarRetiraCep = document.getElementById("btn-buscar-retira-cep");
    const inputRetiraCep = document.getElementById("input-retira-cep");

    btnBuscarRetiraCep?.addEventListener("click", () => {
        buscarCepRetiraEndereco(inputRetiraCep?.value);
    });
    inputRetiraCep?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            buscarCepRetiraEndereco(inputRetiraCep?.value);
        }
    });

    // 8.3. Busca de CNPJ para Transportadora Regional
    const btnBuscarRegCnpj = document.getElementById("btn-buscar-reg-cnpj");
    const inputRegCnpj = document.getElementById("input-reg-cnpj");

    btnBuscarRegCnpj?.addEventListener("click", () => {
        buscarCnpjTransportadora(inputRegCnpj?.value);
    });
    inputRegCnpj?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            buscarCnpjTransportadora(inputRegCnpj?.value);
        }
    });

    // 8.4. Botão de Execução de Exclusão no Modal Customizado
    document.getElementById("btn-executar-exclusao-modal")?.addEventListener("click", async () => {
        if (!_solicitacaoParaExcluir) return;
        const sol = _solicitacaoParaExcluir;
        const id = sol.id || sol.protocolo;
        const protStr = sol.protocolo || id;

        fecharModalConfirmarExclusao();

        // Remoção otimista da interface
        if (_todasSolicitacoesCache) {
            _todasSolicitacoesCache = _todasSolicitacoesCache.filter(s => s.id !== id && s.protocolo !== id && s !== sol);
            _filtrarERenderizarAdmGeral();
        }
        if (HistoricoState.solicitacoes) {
            HistoricoState.solicitacoes = HistoricoState.solicitacoes.filter(s => s.id !== id && s.protocolo !== id && s !== sol);
            renderHistorico();
        }

        showToast(`Solicitação ${protStr} excluída com sucesso.`, "success");

        try {
            await excluirSolicitacao(id);
        } catch (err) {
            console.error("Erro ao persistir exclusão no Firestore:", err);
            showToast("Erro ao sincronizar exclusão com o Firestore.", "warning");
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
        dropzone.classList.add("border-[#008497]", "bg-slate-100/60");
    });

    dropzone?.addEventListener("dragleave", () => {
        dropzone.classList.remove("border-[#008497]", "bg-slate-100/60");
    });

    dropzone?.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("border-[#008497]", "bg-slate-100/60");
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
                <td class="p-2 font-mono text-center text-[#008497] font-semibold">${d.protheus}</td>
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
                <td class="p-2 font-mono text-center text-[#008497] font-semibold">${d.protheus}</td>
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
            renderAdmGeralScreen();
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

    // Modal Cadastrar Promotor com Auto-Sync de NF-e
    const btnAbrirCadPromotor = document.getElementById("btn-abrir-modal-cadastrar-promotor");
    const btnFecharCadPromotor = document.getElementById("btn-fechar-modal-cad-promotor");
    const btnCancelarCadPromotor = document.getElementById("btn-cancelar-cad-promotor");
    const formCadPromotor = document.getElementById("form-cadastrar-promotor");

    btnAbrirCadPromotor?.addEventListener("click", abrirModalCadastrarPromotor);
    btnFecharCadPromotor?.addEventListener("click", fecharModalCadPromotor);
    btnCancelarCadPromotor?.addEventListener("click", fecharModalCadPromotor);

    formCadPromotor?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const protheus = document.getElementById("cad-promotor-protheus")?.value || "";
        const email = document.getElementById("cad-promotor-email")?.value || "";
        const senha = document.getElementById("cad-promotor-senha")?.value || "";
        const btnSalvar = document.getElementById("btn-salvar-cad-promotor");
        const lblBtn = document.getElementById("lbl-btn-salvar-promotor");

        if (btnSalvar) {
            btnSalvar.disabled = true;
            if (lblBtn) lblBtn.textContent = "Salvando e Sincronizando...";
        }

        try {
            const res = await cadastrarPromotorComSyncNfe({ codigoProtheus: protheus, emailReal: email, senha: senha });
            showToast(`Promotor ${protheus} cadastrado com sucesso! ${res.notasAtualizadas} NF-e vinculadas ao e-mail ${email}.`, "success");
            fecharModalCadPromotor();
        } catch (err) {
            showToast("Erro ao cadastrar promotor: " + err.message, "error");
        } finally {
            if (btnSalvar) {
                btnSalvar.disabled = false;
                if (lblBtn) lblBtn.textContent = "Salvar e Sincronizar NFs";
            }
        }
    });

    // Bloco de Aba Flutuante Fixa na Lateral Direita (Exportar Excel)
    document.getElementById("fab-exportar-excel")?.addEventListener("click", () => {
        exportarSolicitacoesParaExcel();
    });

    document.getElementById("btn-header-export-excel")?.addEventListener("click", () => {
        exportarSolicitacoesParaExcel();
    });
    // 12. Modal de Detalhes da Solicitação (Pop-up Moderno)
    document.getElementById("btn-fechar-modal-detalhes")?.addEventListener("click", fecharModalDetalhesSolicitacao);
    document.getElementById("btn-fechar-modal-detalhes-footer")?.addEventListener("click", fecharModalDetalhesSolicitacao);
    document.getElementById("btn-editar-modal-detalhes")?.addEventListener("click", async () => {
        if (_modalDetalhesCurrentSol) {
            fecharModalDetalhesSolicitacao();
            showToast(`Carregando solicitação ${_modalDetalhesCurrentSol.protocolo || ''} para edição...`, "info");
            await carregarSolicitacaoParaEdicao(_modalDetalhesCurrentSol);
            window.appSetTab("devolucao");
            renderFluxoDevolucao();
            renderMiniRelatorioAtivos();
            window.scrollTo({ top: 0, behavior: "smooth" });
            showToast(`Modo de edição: Solicitação ${_modalDetalhesCurrentSol.protocolo || ''} pronta para alteração.`, "success");
        }
    });
    document.getElementById("modal-detalhes-solicitacao")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-detalhes-solicitacao") {
            fecharModalDetalhesSolicitacao();
        }
    });
}

// Registro em memória de todas as solicitações para abertura garantida do modal
const _solicitacoesMap = new Map();

export function registrarSolicitacao(sol) {
    if (!sol) return "";
    const key = String(sol.id || sol.protocolo || `sol_${Math.random().toString(36).substring(2)}`).trim();
    _solicitacoesMap.set(key, sol);
    _solicitacoesMap.set(key.toLowerCase(), sol);
    if (sol.id) {
        const sid = String(sol.id).trim();
        _solicitacoesMap.set(sid, sol);
        _solicitacoesMap.set(sid.toLowerCase(), sol);
    }
    if (sol.protocolo) {
        const prot = String(sol.protocolo).trim();
        _solicitacoesMap.set(prot, sol);
        _solicitacoesMap.set(prot.replace(/^#/, ""), sol);
        _solicitacoesMap.set(prot.toLowerCase(), sol);
        _solicitacoesMap.set(prot.replace(/^#/, "").toLowerCase(), sol);
    }
    return key;
}

/**
 * Função utilitária interna para localizar qualquer solicitação por ID, Protocolo ou Objeto
 */
function _buscarSolicitacaoPorId(idOuProt) {
    if (!idOuProt) return null;
    if (typeof idOuProt === 'object') return idOuProt;
    const rawId = String(idOuProt || "").trim();
    const cleanId = rawId.toLowerCase();
    const cleanNum = cleanId.replace(/^#/, "");

    // 1. Busca no Map global
    let found = _solicitacoesMap.get(rawId) ||
                _solicitacoesMap.get(cleanId) ||
                _solicitacoesMap.get(cleanNum) ||
                _solicitacoesMap.get(`#${cleanNum}`) ||
                _solicitacoesMap.get(`sol_${cleanId}`);

    if (found) return found;

    // 2. Busca nas listas em memória
    const todasListas = [
        ...(_todasSolicitacoesCache || []),
        ...(AdminState?.todasSolicitacoes || []),
        ...(HistoricoState?.solicitacoes || [])
    ];
    
    found = todasListas.find(s => {
        if (!s) return false;
        const sid = String(s.id || "").trim();
        const sidLower = sid.toLowerCase();
        const sprot = String(s.protocolo || "").trim();
        const sprotLower = sprot.toLowerCase();
        const sprotNum = sprotLower.replace(/^#/, "");

        return (sid && (sid === rawId || sidLower === cleanId)) || 
               (sprot && (sprot === rawId || sprotLower === cleanId)) || 
               (cleanNum && sprotNum === cleanNum) ||
               (cleanId && (sidLower.includes(cleanId) || sprotLower.includes(cleanId)));
    });

    if (found) {
        registrarSolicitacao(found);
        return found;
    }

    // 3. Busca no localStorage
    try {
        const locais = JSON.parse(localStorage.getItem("makita_devolucoes_locais") || "[]");
        found = locais.find(s => {
            if (!s) return false;
            const sid = String(s.id || "").trim();
            const sidLower = sid.toLowerCase();
            const sprot = String(s.protocolo || "").trim();
            const sprotLower = sprot.toLowerCase();
            const sprotNum = sprotLower.replace(/^#/, "");
            return (sid && (sid === rawId || sidLower === cleanId)) || 
                   (sprot && (sprot === rawId || sprotLower === cleanId)) || 
                   (cleanNum && sprotNum === cleanNum);
        });
        if (found) {
            registrarSolicitacao(found);
            return found;
        }
    } catch (e) {}

    return null;
}

/**
 * Abre o Modal Pop-up Moderno com Detalhes Completos da Solicitação (Sem Emojis, com FontAwesome Icons)
 */
export async function abrirModalDetalhesSolicitacao(idOuProtocolo) {
    let sol = _buscarSolicitacaoPorId(idOuProtocolo);
    
    // Se não encontrou na memória local, tenta buscar no Firestore diretamente
    if (!sol && idOuProtocolo) {
        try {
            const rawId = String(idOuProtocolo).trim();
            // 1. Busca por Document ID direto
            const dRef = doc(db, "solicitacoes_devolucao", rawId);
            const dSnap = await getDoc(dRef);
            if (dSnap.exists()) {
                sol = { id: dSnap.id, ...dSnap.data() };
                registrarSolicitacao(sol);
            } else {
                // 2. Busca por Protocolo
                const q = query(collection(db, "solicitacoes_devolucao"), where("protocolo", "==", rawId));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                    const docItem = qSnap.docs[0];
                    sol = { id: docItem.id, ...docItem.data() };
                    registrarSolicitacao(sol);
                }
            }
        } catch (err) {
            console.warn("[abrirModalDetalhesSolicitacao] Falha na busca remota da solicitação:", err);
        }
    }

    if (!sol) {
        console.warn("[abrirModalDetalhesSolicitacao] Solicitação não encontrada para:", idOuProtocolo);
        showToast("Solicitação não encontrada no momento. Tente atualizar a lista.", "warning");
        return;
    }

    _modalDetalhesCurrentSol = sol;

    const modal = document.getElementById("modal-detalhes-solicitacao");
    if (!modal) {
        console.error("Modal element #modal-detalhes-solicitacao não encontrado no DOM!");
        return;
    }

    try {
        let dataFmt = "-";
        try {
            const rawDate = sol.dataCriacao?.toDate ? sol.dataCriacao.toDate() : 
                            (sol.criadoEm?.toDate ? sol.criadoEm.toDate() : 
                            (sol.dataCriacao ? new Date(sol.dataCriacao) : 
                            (sol.criadoEm ? new Date(sol.criadoEm) : new Date())));
            if (!isNaN(rawDate.getTime())) {
                dataFmt = rawDate.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            }
        } catch (e) {
            dataFmt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        }

        const solicitanteNome = sol.solicitante?.nome || sol.solicitante?.email?.split("@")[0] || "Promotor";
        const solicitanteEmail = sol.solicitante?.email || "-";
        const protheus = sol.solicitante?.protheus || "-";
        const caixas = sol.volumes?.quantidadeCaixas || 1;
        const itensList = Array.isArray(sol.itens) ? sol.itens : (sol.produtos || []);
        const totalQtd = itensList.length > 0 ? itensList.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || it.quantidade || it.qtd || 1), 0) : Number(sol.totalItens || 1);

        // Preenche cabeçalho
        const badgeProt = document.getElementById("modal-detalhes-protocolo-badge");
        if (badgeProt) badgeProt.textContent = sol.protocolo || sol.id || "S/ PROTOCOLO";

        const badgeStatus = document.getElementById("modal-detalhes-status-badge");
        if (badgeStatus) {
            const stObj = normalizarStatus(sol.status);
            badgeStatus.className = `badge ${stObj.badgeClass || 'bg-amber-100 text-amber-800'}`;
            badgeStatus.innerHTML = `<i class="${stObj.icon || 'fa-solid fa-clock'} text-xs"></i> <span>${stObj.label || 'Pendente'}</span>`;
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

        const log = sol.logistica || {};
        const tipoLog = String(log.tipo || (sol.status === "brasspress" ? "braspress" : "")).toLowerCase();

        if (tipoLog === "braspress") {
            if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5 font-semibold"><i class="fa-solid fa-warehouse"></i> Braspress (Entrega em Filial)</span>`;
            if (elLogDestino) elLogDestino.textContent = log.filialBraspress || sol.filialBraspress || "Filial não informada";
            if (elLogEnd) elLogEnd.textContent = "Entrega direta na filial Braspress selecionada";
        } else if (tipoLog === "braspress_retira") {
            const ret = log.braspressRetira || {};
            if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5 font-semibold"><i class="fa-solid fa-truck-pickup"></i> Brasspress Retira no Endereço</span>`;
            if (elLogDestino) elLogDestino.textContent = `Coleta: ${ret.logradouro || "-"}, ${ret.numero || "-"} - ${ret.bairro || "-"}`;
            if (elLogEnd) elLogEnd.textContent = `${ret.cidade || "-"}/${ret.uf || "-"} — CEP: ${ret.cep || "-"} ${ret.telefone ? '— Tel: ' + ret.telefone : ''}`;
        } else if (tipoLog === "filial_makita") {
            const mak = log.filialMakita || {};
            if (elLogTipo) elLogTipo.innerHTML = `<span class="text-[#008497] flex items-center gap-1.5 font-semibold"><i class="fa-solid fa-building-flag"></i> Filial Oficial Makita</span>`;
            if (elLogDestino) elLogDestino.textContent = `${mak.nome || "Filial Makita"} (${mak.unidade || ""})`;
            if (elLogEnd) elLogEnd.textContent = `${mak.logradouro || ""} - ${mak.cidade || ""}/${mak.uf || ""} — Tel: ${mak.telefone || ""}`;
        } else {
            const regNome = log.transportadoraRegional?.nome || log.nomeTransportadora || "Transportadora Regional";
            const regCnpj = log.transportadoraRegional?.cnpj || log.cnpjTransportadora || "";
            if (elLogTipo) elLogTipo.innerHTML = `<span class="text-slate-700 flex items-center gap-1.5 font-semibold"><i class="fa-solid fa-truck-ramp-box text-[#008497]"></i> Transportadora Regional</span>`;
            if (elLogDestino) elLogDestino.textContent = `${regNome} ${regCnpj ? '(CNPJ: ' + regCnpj + ')' : ''}`;
            if (elLogEnd) elLogEnd.textContent = `Origem: ${log.cidadeOrigem || log.transportadoraRegional?.cidade || "-"} / ${log.ufOrigem || log.transportadoraRegional?.uf || "-"}`;
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
        if (countBadge) countBadge.textContent = `${itensList.length} ${itensList.length === 1 ? 'item' : 'itens'}`;

        if (tbody) {
            if (itensList.length > 0) {
                tbody.innerHTML = itensList.map((it, idx) => `
                    <tr class="border-b border-slate-100 hover:bg-slate-50/80 text-xs">
                        <td class="p-2.5 text-center font-semibold text-slate-400 align-middle">${idx + 1}</td>
                        <td class="p-2.5 font-semibold text-[#0f172a] align-middle">${it.codigoItem || it.produto || it.codigo || "-"}</td>
                        <td class="p-2.5 text-[#0f172a] font-normal align-middle">${it.descricao || it.desc || "-"}</td>
                        <td class="p-2.5 text-center text-[#64748b] font-normal align-middle">${it.notaFiscal || it.nfRemessa || it.nf || "-"}</td>
                        <td class="p-2.5 text-center text-[#64748b] font-normal align-middle">${it.pedido || it.numPedido || "-"}</td>
                        <td class="p-2.5 text-center font-semibold text-[#0f172a] align-middle">
                            ${it.quantidadeDevolvida || it.quantidade || it.qtd || 1} un
                        </td>
                    </tr>
                `).join("");
            } else {
                tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Nenhum item discriminado nesta devolução.</td></tr>`;
            }
        }
    } catch (err) {
        console.error("Erro ao preencher dados do modal de detalhes:", err);
    }

    // Exibe o modal com prioridade visual
    modal.classList.remove("hidden");
    modal.style.removeProperty("display");
    modal.style.setProperty("display", "flex", "important");
    modal.style.zIndex = "999999";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
}

export function fecharModalDetalhesSolicitacao() {
    const modal = document.getElementById("modal-detalhes-solicitacao");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.setProperty("display", "none", "important");
    }
}

// Garante disponibilidade global imediata para todos os navegadores e eventos
window.appVerDetalhesSolicitacao = abrirModalDetalhesSolicitacao;
window.abrirModalDetalhesSolicitacao = abrirModalDetalhesSolicitacao;
window.fecharModalDetalhesSolicitacao = fecharModalDetalhesSolicitacao;

/**
 * Consulta de CEP para a modalidade Brasspress Retira no Endereço (ViaCEP + BrasilAPI Fallback)
 */
export async function buscarCepRetiraEndereco(cep) {
    const cleanCep = (cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) {
        showToast("Informe um CEP válido com 8 dígitos (Ex: 01310-100).", "warning");
        return;
    }

    const btn = document.getElementById("btn-buscar-retira-cep");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Buscando...';
    }

    try {
        let data = null;
        try {
            const resp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            if (resp.ok) {
                const json = await resp.json();
                if (!json.erro) data = json;
            }
        } catch (e) {}

        if (!data) {
            try {
                const resp2 = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
                if (resp2.ok) {
                    const json2 = await resp2.json();
                    data = {
                        logradouro: json2.street,
                        bairro: json2.neighborhood,
                        localidade: json2.city,
                        uf: json2.state
                    };
                }
            } catch (e) {}
        }

        if (!data) {
            showToast("CEP não encontrado. Por favor, preencha o endereço manualmente.", "warning");
            return;
        }

        const elRua = document.getElementById("input-retira-rua");
        const elBairro = document.getElementById("input-retira-bairro");
        const elCidade = document.getElementById("input-retira-cidade");
        const elUf = document.getElementById("input-retira-uf");
        const elNum = document.getElementById("input-retira-numero");

        if (elRua) elRua.value = data.logradouro || "";
        if (elBairro) elBairro.value = data.bairro || "";
        if (elCidade) elCidade.value = data.localidade || "";
        if (elUf) elUf.value = data.uf || "";

        DevolucaoState.logistica.braspressRetira = {
            ...DevolucaoState.logistica.braspressRetira,
            cep: cleanCep,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || ""
        };

        if (elNum) elNum.focus();
        showToast(`Endereço localizado: ${data.logradouro} (${data.localidade}/${data.uf})`, "success");
    } catch (err) {
        showToast("Erro ao consultar CEP. Preencha os campos manualmente.", "warning");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar CEP';
        }
    }
}

/**
 * Consulta de CNPJ para a modalidade Transportadora Regional (BrasilAPI + OpenCNPJ Fallback)
 */
export async function buscarCnpjTransportadora(cnpj) {
    const cleanCnpj = (cnpj || "").replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
        showToast("Informe um CNPJ válido com 14 dígitos (Ex: 12.345.678/0001-90).", "warning");
        return;
    }

    const btn = document.getElementById("btn-buscar-reg-cnpj");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Consultando...';
    }

    try {
        let data = null;
        try {
            const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (resp.ok) data = await resp.json();
        } catch (e) {}

        if (!data) {
            try {
                const resp2 = await fetch(`https://open.cnpja.com/office/${cleanCnpj}`);
                if (resp2.ok) {
                    const json2 = await resp2.json();
                    data = {
                        razao_social: json2.company?.name || json2.alias,
                        nome_fantasia: json2.alias || json2.company?.name,
                        ddd_telefone_1: json2.phones?.[0]?.number || "",
                        logradouro: `${json2.address?.street || ""}, ${json2.address?.number || ""}`,
                        municipio: json2.address?.city,
                        uf: json2.address?.state
                    };
                }
            } catch (e) {}
        }

        if (!data) {
            showToast("CNPJ não encontrado na Receita Federal. Preencha os campos manualmente.", "warning");
            return;
        }

        const razao = data.razao_social || data.nome || "";
        const fantasia = data.nome_fantasia || data.fantasia || razao;
        const tel = data.ddd_telefone_1 || data.telefone || "";
        const endCompleto = [data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(" ");
        const cidade = data.municipio || data.cidade || "";
        const uf = data.uf || "";

        const elNome = document.getElementById("input-reg-nome");
        const elFantasia = document.getElementById("input-reg-fantasia");
        const elTel = document.getElementById("input-reg-tel");
        const elEnd = document.getElementById("input-reg-endereco");
        const elCidade = document.getElementById("input-reg-cidade");
        const elUf = document.getElementById("input-reg-uf");

        if (elNome) elNome.value = razao;
        if (elFantasia) elFantasia.value = fantasia;
        if (elTel) elTel.value = tel;
        if (elEnd) elEnd.value = endCompleto;
        if (elCidade) elCidade.value = cidade;
        if (elUf) elUf.value = uf;

        DevolucaoState.logistica.transportadoraRegional = {
            ...DevolucaoState.logistica.transportadoraRegional,
            cnpj: cleanCnpj,
            nome: razao,
            nomeFantasia: fantasia,
            telefone: tel,
            logradouro: endCompleto,
            cidade: cidade,
            uf: uf
        };

        showToast(`Transportadora localizada: ${razao} (${cidade}/${uf})`, "success");
    } catch (err) {
        showToast("Erro ao consultar CNPJ. Preencha os campos manualmente.", "warning");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Buscar CNPJ';
        }
    }
}

/**
 * Modal Customizado de Confirmação de Exclusão de Solicitação
 */
let _solicitacaoParaExcluir = null;

export function abrirModalConfirmarExclusao(idOuProt) {
    const sol = _buscarSolicitacaoPorId(idOuProt);
    if (!sol) {
        showToast("Solicitação não encontrada para exclusão.", "warning");
        return;
    }

    _solicitacaoParaExcluir = sol;

    const modal = document.getElementById("modal-confirmar-exclusao");
    if (!modal) return;

    const elProt = document.getElementById("modal-exc-protocolo");
    const elSol = document.getElementById("modal-exc-solicitante");
    const elItens = document.getElementById("modal-exc-itens");
    const elData = document.getElementById("modal-exc-data");

    const totalAtivos = sol.itens ? sol.itens.reduce((acc, it) => acc + Number(it.quantidadeDevolvida || 1), 0) : Number(sol.totalItens || 1);
    const dataFmt = new Date(sol.dataCriacao || Date.now()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const nomeSol = sol.solicitante?.nome || sol.solicitante?.email?.split("@")[0] || "Promotor";

    if (elProt) elProt.textContent = sol.protocolo || "S/ PROTOCOLO";
    if (elSol) elSol.textContent = `${nomeSol} (${sol.solicitante?.email || '-'})`;
    if (elItens) elItens.textContent = `${totalAtivos} item(ns)`;
    if (elData) elData.textContent = dataFmt;

    modal.classList.remove("hidden");
    modal.style.removeProperty("display");
    modal.style.setProperty("display", "flex", "important");
    modal.style.zIndex = "999999";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
}

export function fecharModalConfirmarExclusao() {
    const modal = document.getElementById("modal-confirmar-exclusao");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.setProperty("display", "none", "important");
    }
    _solicitacaoParaExcluir = null;
}

window.abrirModalConfirmarExclusao = abrirModalConfirmarExclusao;
window.fecharModalConfirmarExclusao = fecharModalConfirmarExclusao;
window.buscarCepRetiraEndereco = buscarCepRetiraEndereco;
window.buscarCnpjTransportadora = buscarCnpjTransportadora;

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
        } else if (action === 'edit') {
            const sol = _buscarSolicitacaoPorId(id);
            if (sol) {
                showToast(`Carregando solicitação ${sol.protocolo || id} para edição...`, "info");
                await carregarSolicitacaoParaEdicao(sol);
                window.appSetTab("devolucao");
                renderFluxoDevolucao();
                renderMiniRelatorioAtivos();
                window.scrollTo({ top: 0, behavior: "smooth" });
                showToast(`Modo de edição: Solicitação ${sol.protocolo || id} pronta para alteração.`, "success");
            } else {
                showToast("Solicitação não encontrada para edição.", "warning");
            }
        } else if (action === 'status') {
            const novoStatusKey = actionBtn.dataset.status;
            window.appAlterarStatusSolicitacao(id, novoStatusKey);
        } else if (action === 'delete') {
            abrirModalConfirmarExclusao(id);
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

/**
 * Detecção e Adaptação Multiplataforma (Desktop / Android / iOS)
 */
export function initDeviceAdaptations() {
    try {
        const ua = navigator.userAgent || navigator.vendor || window.opera || "";
        const platform = navigator.platform || "";
        const maxTouchPoints = navigator.maxTouchPoints || 0;

        let deviceType = "desktop";
        let isIOS = false;
        let isAndroid = false;

        // 1. Detecção Precisa de iOS (iPhone, iPad, iPod, incluindo iPadOS que finge ser MacIntel)
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || 
                            (platform === "MacIntel" && maxTouchPoints > 1) ||
                            (navigator.userAgentData?.platform === "iOS");

        // 2. Detecção de Android
        const isAndroidDevice = /android/i.test(ua) || (navigator.userAgentData?.platform === "Android");

        if (isIOSDevice) {
            deviceType = "ios";
            isIOS = true;
        } else if (isAndroidDevice) {
            deviceType = "android";
            isAndroid = true;
        } else {
            deviceType = "desktop";
        }

        // 3. Detecção de Recursos Touch
        const isTouchDevice = maxTouchPoints > 0 || 
                              'ontouchstart' in window || 
                              (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        // 4. Exposição de Variáveis Globais
        window.deviceType = deviceType;
        window.isIOS = isIOS;
        window.isAndroid = isAndroid;
        window.isMobile = (deviceType === "ios" || deviceType === "android");
        window.isTouchDevice = isTouchDevice;

        // 5. Adiciona classes ao HTML e BODY com segurança
        const root = document.documentElement;
        const body = document.body;

        if (root) {
            ["device-desktop", "device-android", "device-ios", "device-touch", "device-mobile"].forEach(cls => root.classList.remove(cls));
            root.classList.add(`device-${deviceType}`);
            if (isTouchDevice) root.classList.add("device-touch");
            if (window.isMobile) root.classList.add("device-mobile");
        }

        if (body) {
            ["device-desktop", "device-android", "device-ios", "device-touch", "device-mobile"].forEach(cls => body.classList.remove(cls));
            body.classList.add(`device-${deviceType}`);
            if (isTouchDevice) body.classList.add("device-touch");
            if (window.isMobile) body.classList.add("device-mobile");
        }

        // 6. Cálculo da Altura Real da Viewport (100dvh fallback para Safari iOS e Chrome Android)
        function updateAppHeight() {
            if (root) {
                const vh = window.innerHeight * 0.01;
                root.style.setProperty('--vh', `${vh}px`);
                root.style.setProperty('--app-height', `${window.innerHeight}px`);
            }
        }
        updateAppHeight();
        window.addEventListener('resize', updateAppHeight, { passive: true });
        window.addEventListener('orientationchange', () => setTimeout(updateAppHeight, 200), { passive: true });

        // 7. Prevenção de Teclado Virtual cobrindo Inputs (Android / iOS)
        if (window.isMobile) {
            document.addEventListener('focusin', (e) => {
                const target = e.target;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                    setTimeout(() => {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                }
            }, { passive: true });
        }

        console.log(`[DeviceAdaptation] Contexto Ativo: ${deviceType.toUpperCase()} | Touch: ${isTouchDevice}`);
    } catch (e) {
        console.warn("initDeviceAdaptations warning:", e);
    }
}

// Inicialização Robusta
async function bootApp() {
    initDeviceAdaptations();
    window.handleMsLogin = handleMsLogin;
    window.fecharModalSucesso = fecharModalSucesso;
    window.cancelarAutoRedirecionamento = cancelarAutoRedirecionamento;
    window.renderFluxoDevolucao = renderFluxoDevolucao;
    window.renderMiniRelatorioAtivos = renderMiniRelatorioAtivos;
    initEventListeners();
    subscribeAuth(updateAuthUI);
    await inicializarAuth();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootApp);
} else {
    bootApp();
}

