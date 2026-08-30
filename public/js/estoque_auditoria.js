/**
 * estoque_auditoria.js — Módulo de Auditoria e Cruzamento com o Catálogo do Projeto Estoque
 * 
 * Consulta o Firestore do projeto 'makita-projeto-estoque' (estoque_local_56 e estoque_local_57)
 * para identificar automaticamente itens em posse do promotor que não são mais comerciais
 * (fora de linha, descontinuados, obsoletos, inativos ou amostras) e sugerir devolução.
 */

import { dbEstoque, doc, getDoc } from "./firebase.js";
import { DevolucaoState, toggleItemSelecao } from "./devolucoes.js";
import { showToast } from "./app.js";

// Cache em memória para evitar consultas duplicadas de SKU
const _cacheStatusEstoque = new Map();

// Mapeamento oficial de status do Protheus / Projeto Estoque
export const STATUS_ESTOQUE_CONFIG = {
    'comercial': {
        key: 'comercial',
        label: 'Comercial',
        ehComercial: true,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'fa-solid fa-circle-check'
    },
    'ativo': {
        key: 'ativo',
        label: 'Ativo',
        ehComercial: true,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'fa-solid fa-circle-check'
    },
    'fora_de_linha': {
        key: 'fora_de_linha',
        label: 'Fora de Linha',
        ehComercial: false,
        motivo: 'Produto fora de linha — Devolução recomendada para desmobilização.',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        icon: 'fa-solid fa-ban'
    },
    'descontinuado': {
        key: 'descontinuado',
        label: 'Descontinuado',
        ehComercial: false,
        motivo: 'Item descontinuado pela engenharia da Makita.',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        icon: 'fa-solid fa-triangle-exclamation'
    },
    'obsoleto': {
        key: 'obsoleto',
        label: 'Obsoleto',
        ehComercial: false,
        motivo: 'Ativo de geração anterior substituído por novos modelos.',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: 'fa-solid fa-clock-rotate-left'
    },
    'inativo': {
        key: 'inativo',
        label: 'Inativo',
        ehComercial: false,
        motivo: 'SKU inativado no cadastro do ERP Protheus.',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        icon: 'fa-solid fa-power-off'
    },
    'amostra': {
        key: 'amostra',
        label: 'Amostra Técnica',
        ehComercial: false,
        motivo: 'Amostra ou protótipo técnico não destinado à comercialização.',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: 'fa-solid fa-vial'
    },
    'nao_comercial': {
        key: 'nao_comercial',
        label: 'Não Comercial',
        ehComercial: false,
        motivo: 'Ativo sem saldo ou sem cadastro comercial ativo no estoque.',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        icon: 'fa-solid fa-box-archive'
    }
};

/**
 * Consulta o status de um SKU individual no Firestore do projeto-estoque
 */
export async function consultarStatusItemEstoque(codigoProduto) {
    if (!codigoProduto) return null;
    const sku = String(codigoProduto).trim().toUpperCase();

    // 1. Verifica cache local
    if (_cacheStatusEstoque.has(sku)) {
        return _cacheStatusEstoque.get(sku);
    }

    // Regra rápida de Amostras
    if (sku.startsWith("SMP-") || sku.includes("AMOSTRA")) {
        const info = {
            sku: sku,
            status: "amostra",
            statusLabel: "Amostra Técnica",
            ehComercial: false,
            motivo: "Amostra ou protótipo técnico não destinado à comercialização.",
            config: STATUS_ESTOQUE_CONFIG.amostra
        };
        _cacheStatusEstoque.set(sku, info);
        return info;
    }

    // 2. Consulta Firestore do Projeto Estoque (Local 56 - Comercial)
    if (dbEstoque) {
        try {
            const docRef56 = doc(dbEstoque, "estoque_local_56", sku);
            const snap56 = await getDoc(docRef56);

            if (snap56.exists()) {
                const data = snap56.data();
                const rawStatus = (data.status || data.statusOriginal || "").toLowerCase().trim();
                
                let mappedKey = "comercial";
                if (rawStatus === "f" || rawStatus === "fora_de_linha") mappedKey = "fora_de_linha";
                else if (rawStatus === "d" || rawStatus === "descontinuado") mappedKey = "descontinuado";
                else if (rawStatus === "o" || rawStatus === "obsoleto") mappedKey = "obsoleto";
                else if (rawStatus === "i" || rawStatus === "inativo") mappedKey = "inativo";
                else if (rawStatus === "c" || rawStatus === "comercial" || rawStatus === "a" || rawStatus === "ativo") mappedKey = "comercial";
                else if (rawStatus) mappedKey = rawStatus;

                const cfg = STATUS_ESTOQUE_CONFIG[mappedKey] || STATUS_ESTOQUE_CONFIG.nao_comercial;
                const info = {
                    sku: sku,
                    descricao: data.descricao || "",
                    tipo: data.tipo || "MAQUINA",
                    status: mappedKey,
                    statusLabel: cfg.label,
                    ehComercial: cfg.ehComercial,
                    motivo: cfg.motivo || "",
                    config: cfg
                };
                _cacheStatusEstoque.set(sku, info);
                return info;
            }

            // 3. Consulta Firestore do Projeto Estoque (Local 57 - Promotores/Transferências)
            const docRef57 = doc(dbEstoque, "estoque_local_57", sku);
            const snap57 = await getDoc(docRef57);
            if (snap57.exists()) {
                const data57 = snap57.data();
                const rawStatus = (data57.status || data57.statusOriginal || "").toLowerCase().trim();
                let mappedKey = (rawStatus === "c" || rawStatus === "comercial" || rawStatus === "a" || rawStatus === "ativo") ? "comercial" : "nao_comercial";
                const cfg = STATUS_ESTOQUE_CONFIG[mappedKey] || STATUS_ESTOQUE_CONFIG.nao_comercial;

                const info = {
                    sku: sku,
                    descricao: data57.descricao || "",
                    tipo: data57.tipo || "MAQUINA",
                    status: mappedKey,
                    statusLabel: cfg.label,
                    ehComercial: cfg.ehComercial,
                    motivo: cfg.motivo || "Item registrado no estoque de promotores (Local 57).",
                    config: cfg
                };
                _cacheStatusEstoque.set(sku, info);
                return info;
            }

        } catch (err) {
            console.warn(`[Estoque Auditoria] Erro ao consultar SKU ${sku} no projeto-estoque:`, err.message);
        }
    }

    // 4. Se não encontrado na base comercial oficial, assume item não-comercial / sugerido
    const fallbackInfo = {
        sku: sku,
        status: "nao_comercial",
        statusLabel: "Fora do Catálogo Ativo",
        ehComercial: false,
        motivo: "SKU não localizado no estoque comercial ativo da Matriz.",
        config: STATUS_ESTOQUE_CONFIG.nao_comercial
    };
    _cacheStatusEstoque.set(sku, fallbackInfo);
    return fallbackInfo;
}

/**
 * Analisa a lista completa de ativos do promotor e retorna os não-comerciais
 */
export async function analisarAtivosPromotor(itensDisponiveis) {
    if (!itensDisponiveis || itensDisponiveis.length === 0) {
        return { totalItens: 0, totalNaoComerciais: 0, itensNaoComerciais: [], itensComerciais: [] };
    }

    const itensNaoComerciais = [];
    const itensComerciais = [];

    for (const item of itensDisponiveis) {
        const cod = item.codigoItem || item.produto || item.codProduto || "";
        const statusEstoque = await consultarStatusItemEstoque(cod);

        const itemComStatus = {
            ...item,
            auditoriaEstoque: statusEstoque
        };

        if (statusEstoque && !statusEstoque.ehComercial) {
            itensNaoComerciais.push(itemComStatus);
        } else {
            itensComerciais.push(itemComStatus);
        }
    }

    return {
        totalItens: itensDisponiveis.length,
        totalNaoComerciais: itensNaoComerciais.length,
        itensNaoComerciais: itensNaoComerciais,
        itensComerciais: itensComerciais
    };
}

/**
 * Atualiza o botão e badge de auditoria na Etapa 1
 */
export async function atualizarBotaoAuditoriaEtapa1() {
    const btn = document.getElementById("btn-auditoria-nao-comerciais");
    const badge = document.getElementById("badge-count-nao-comerciais");
    const itens = DevolucaoState.itensDisponiveis || [];

    if (!btn) return;

    if (itens.length === 0) {
        btn.classList.add("hidden");
        btn.classList.remove("inline-flex");
        return;
    }

    const analise = await analisarAtivosPromotor(itens);
    if (analise.totalNaoComerciais > 0) {
        if (badge) badge.textContent = analise.totalNaoComerciais;
        btn.classList.remove("hidden");
        btn.classList.add("inline-flex");
    } else {
        btn.classList.add("hidden");
        btn.classList.remove("inline-flex");
    }
}

/**
 * Abre o Modal de Auditoria e Sugestão de Devoluções de Itens Não-Comerciais
 */
export async function abrirModalAuditoriaNaoComerciais() {
    const modal = document.getElementById("modal-auditoria-estoque");
    const containerLista = document.getElementById("modal-auditoria-itens-lista");
    const lblCount = document.getElementById("modal-auditoria-count-total");
    const btnAplicar = document.getElementById("btn-aplicar-selecao-auditoria");

    if (!modal) return;

    // Exibe o modal com loading
    modal.classList.remove("hidden");
    if (containerLista) {
        containerLista.innerHTML = `
            <div class="py-12 text-center text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-[#008497] mb-2"></i>
                <p class="text-xs">Consultando catálogo do projeto-estoque...</p>
            </div>
        `;
    }

    const itens = DevolucaoState.itensDisponiveis || [];
    const analise = await analisarAtivosPromotor(itens);

    if (lblCount) lblCount.textContent = `${analise.totalNaoComerciais} item(ns) identificados`;

    if (analise.totalNaoComerciais === 0) {
        if (containerLista) {
            containerLista.innerHTML = `
                <div class="py-10 text-center text-slate-500">
                    <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl mb-2">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <strong class="text-xs text-slate-700 block">Todos os seus ativos são comerciais!</strong>
                    <p class="text-[11px] text-slate-400 mt-1">Não identificamos nenhum item fora de linha ou descontinuado na sua lista.</p>
                </div>
            `;
        }
        if (btnAplicar) btnAplicar.classList.add("hidden");
        return;
    }

    if (btnAplicar) {
        btnAplicar.classList.remove("hidden");
        btnAplicar.innerHTML = `<i class="fa-solid fa-check-double mr-1.5"></i> Selecionar ${analise.totalNaoComerciais} item(ns) para Devolução`;
    }

    // Renderiza a lista de itens com checkboxes marcados
    if (containerLista) {
        containerLista.innerHTML = analise.itensNaoComerciais.map((item, idx) => {
            const st = item.auditoriaEstoque || {};
            const cfg = st.config || STATUS_ESTOQUE_CONFIG.nao_comercial;
            const cod = item.codigoItem || item.produto || "—";
            const desc = item.descricao || "—";
            const nf = item.notaFiscal || item.nfRemessa || "—";
            const qtd = item.saldo !== undefined ? item.saldo : (item.saldoDisponivel || 1);

            return `
                <div class="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-all flex items-start gap-3 text-left">
                    <input 
                        type="checkbox" 
                        class="chk-item-auditoria mt-1 w-4 h-4 rounded border-slate-300 text-[#008497] focus:ring-[#008497] cursor-pointer shrink-0" 
                        data-id="${item.id}"
                        checked
                    >
                    <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-mono font-bold text-slate-800 text-xs bg-white px-2 py-0.5 rounded border border-slate-200">${cod}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeClass} flex items-center gap-1">
                                <i class="${cfg.icon} text-[9px]"></i> ${st.statusLabel || cfg.label}
                            </span>
                            <span class="text-[10px] font-mono text-slate-400">NF: ${nf}</span>
                            <span class="text-[10px] font-bold text-[#008497] ml-auto">Qtd: ${qtd} un</span>
                        </div>
                        <p class="text-xs font-medium text-slate-700 truncate" title="${desc}">${desc}</p>
                        <p class="text-[11px] text-amber-700 bg-amber-50/80 border border-amber-100 rounded px-2 py-1 leading-snug">
                            <i class="fa-solid fa-circle-info mr-1 text-[10px]"></i> ${st.motivo || cfg.motivo}
                        </p>
                    </div>
                </div>
            `;
        }).join("");
    }
}

/**
 * Fecha o Modal de Auditoria
 */
export function fecharModalAuditoriaNaoComerciais() {
    const modal = document.getElementById("modal-auditoria-estoque");
    if (modal) modal.classList.add("hidden");
}

/**
 * Aplica a seleção dos itens marcados no modal direto na Etapa 1
 */
export function aplicarSelecaoAuditoriaNaDevolucao() {
    const checkboxes = document.querySelectorAll(".chk-item-auditoria:checked");
    if (!checkboxes || checkboxes.length === 0) {
        showToast("Selecione ao menos 1 item para adicionar à devolução.", "warning");
        return;
    }

    let adicionados = 0;
    checkboxes.forEach(chk => {
        const itemId = chk.dataset.id;
        const itemObj = DevolucaoState.itensDisponiveis.find(it => it.id === itemId);
        if (itemObj) {
            toggleItemSelecao(itemObj, true);
            adicionados++;
        }
    });

    fecharModalAuditoriaNaoComerciais();

    // Re-renderiza a tabela da Etapa 1
    if (typeof window.renderFluxoDevolucao === "function") {
        window.renderFluxoDevolucao();
    }

    showToast(`${adicionados} item(ns) não-comerciais adicionados à sua devolução com sucesso!`, "success");
}

// Window global binds
window.abrirModalAuditoriaNaoComerciais = abrirModalAuditoriaNaoComerciais;
window.fecharModalAuditoriaNaoComerciais = fecharModalAuditoriaNaoComerciais;
window.aplicarSelecaoAuditoriaNaDevolucao = aplicarSelecaoAuditoriaNaDevolucao;
