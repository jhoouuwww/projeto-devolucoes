/**
 * Módulo de Histórico de Solicitações de Devolução
 */
import { buscarHistoricoSolicitacoes, normalizarStatus } from "./api.js";

export const HistoricoState = {
    solicitacoes: [],
    carregando: false,
    solicitacaoSelecionada: null,
    termoBusca: ""
};

/**
 * Carrega a lista de solicitações
 */
export async function carregarHistorico() {
    if (!AuthState.profile || !AuthState.profile.protheus) return;

    HistoricoState.carregando = true;
    try {
        HistoricoState.solicitacoes = await buscarHistoricoSolicitacoes(
            AuthState.profile.protheus,
            AuthState.profile.email
        );
    } catch (err) {
        console.error("Erro ao carregar histórico:", err);
        HistoricoState.solicitacoes = [];
    } finally {
        HistoricoState.carregando = false;
    }
}

/**
 * Retorna as classes CSS e ícones para cada status
 */
export function getStatusBadge(status) {
    const stObj = normalizarStatus(status);
    return {
        bg: stObj.badgeClass,
        icon: stObj.icon.replace("fa-solid ", ""),
        label: stObj.label,
        dotClass: stObj.dotClass
    };
}
