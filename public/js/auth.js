/**
 * Módulo de Autenticação e Verificação de Vínculo Protheus
 */
import { 
    auth, 
    googleProvider,
    signInWithPopup, 
    signInWithEmailAndPassword,
    signOut, 
    onAuthStateChanged,
    db,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "./firebase.js";
import { ADMIN_EMAILS, VINCULOS_INICIAIS } from "./config.js";

export const AuthState = {
    user: null,
    profile: null, // { email, nome, protheus, filial, cargo, isAdmin }
    isAuthorized: false,
    errorMessage: null,
    listeners: []
};

export function subscribeAuth(callback) {
    if (typeof callback === "function" && !AuthState.listeners.includes(callback)) {
        AuthState.listeners.push(callback);
    }
}

function notifyAuth() {
    AuthState.listeners.forEach(fn => {
        try {
            fn(AuthState);
        } catch (err) {
            console.error("Erro no listener de Auth:", err);
        }
    });
}

// Flag que bloqueia o onAuthStateChanged de desfazer um simularLogin
let _simSessionActive = false;

/**
 * Busca o vínculo Protheus pelo e-mail, username ou código Protheus
 */
export async function buscarVinculoProtheus(inputStr) {
    if (!inputStr) return null;
    const rawTerm = inputStr.toLowerCase().trim();
    const cleanUser = rawTerm.split("@")[0].trim();
    const emailWithDomain = rawTerm.includes("@") ? rawTerm : `${cleanUser}@makita.com.br`;
    const term = emailWithDomain;

    // 1. Tenta buscar na Base Local (VINCULOS_INICIAIS) primeiro (Instantâneo / 0ms)
    for (const [k, v] of Object.entries(VINCULOS_INICIAIS)) {
        const emailUser = k.toLowerCase().trim();
        const username = emailUser.split("@")[0];
        const protheusCode = String(v.protheus || "").trim();
        const nomeUser = (v.nome || "").toLowerCase().trim();

        if (
            term === emailUser || 
            rawTerm === emailUser || 
            cleanUser === username || 
            rawTerm === username || 
            rawTerm === protheusCode || 
            cleanUser === protheusCode || 
            rawTerm === nomeUser || 
            (rawTerm.length >= 3 && nomeUser.includes(rawTerm)) || 
            (cleanUser.length >= 3 && nomeUser.includes(cleanUser))
        ) {
            return {
                protheus: v.protheus,
                nome: v.nome,
                filial: v.filial || "01 - Matriz",
                cargo: v.cargo || "Promotor Técnico",
                isAdmin: ADMIN_EMAILS.includes(emailUser) || v.isAdmin === true,
                email: emailUser
            };
        }
    }

    // 2. Fallback Admin conhecido em memória
    if (
        ADMIN_EMAILS.includes(term) || 
        ADMIN_EMAILS.includes(cleanUser) || 
        cleanUser === "j_melgaco" || 
        cleanUser === "88901" || 
        cleanUser === "admin" ||
        cleanUser.includes("melgaco") || 
        cleanUser.includes("jonathan")
    ) {
        return {
            protheus: "88901",
            nome: "Jonathan Melgaço",
            filial: "01 - Matriz",
            cargo: "Administrador / Suporte",
            isAdmin: true,
            email: "j_melgaco@makita.com.br"
        };
    }

    // 3. Busca no Firestore em paralelo com tratamento individual de exceção
    try {
        const firestorePromise = (async () => {
            const checks = [
                // 3a. Busca direta por ID em usuarios_protheus
                (async () => {
                    try {
                        const snap = await getDoc(doc(db, "usuarios_protheus", emailWithDomain));
                        if (snap.exists()) {
                            const data = snap.data();
                            return {
                                protheus: String(data.protheus || data.codigoProtheus || data.codProtheus || "").trim(),
                                nome: data.nome || data.nomeCompleto || cleanUser.replace(/[._-]/g, " "),
                                filial: data.filial || "01 - Matriz",
                                cargo: data.cargo || "Promotor Técnico",
                                isAdmin: ADMIN_EMAILS.includes(emailWithDomain) || !!data.isAdmin,
                                email: data.email || emailWithDomain
                            };
                        }
                    } catch (e) {}
                    return null;
                })(),

                // 3b. Busca direta por ID (código protheus) em usuarios_app
                (async () => {
                    try {
                        const snap = await getDoc(doc(db, "usuarios_app", cleanUser));
                        if (snap.exists()) {
                            const data = snap.data();
                            const userEmail = data.email || emailWithDomain;
                            return {
                                protheus: String(data.codigoProtheus || cleanUser).trim(),
                                nome: data.nome || userEmail.split("@")[0].replace(/[._-]/g, " "),
                                filial: data.filial || "01 - Matriz",
                                cargo: data.cargo || "Promotor Técnico",
                                isAdmin: ADMIN_EMAILS.includes(userEmail),
                                email: userEmail
                            };
                        }
                    } catch (e) {}
                    return null;
                })(),

                // 3c. Query em usuarios_app por email
                (async () => {
                    try {
                        const q = query(collection(db, "usuarios_app"), where("email", "==", emailWithDomain));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            const data = snap.docs[0].data();
                            return {
                                protheus: String(data.codigoProtheus || snap.docs[0].id).trim(),
                                nome: data.nome || cleanUser.replace(/[._-]/g, " "),
                                filial: data.filial || "01 - Matriz",
                                cargo: data.cargo || "Promotor Técnico",
                                isAdmin: ADMIN_EMAILS.includes(emailWithDomain),
                                email: data.email || emailWithDomain
                            };
                        }
                    } catch (e) {}
                    return null;
                })(),

                // 3d. Query em usuarios_protheus por email
                (async () => {
                    try {
                        const q = query(collection(db, "usuarios_protheus"), where("email", "==", emailWithDomain));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            const data = snap.docs[0].data();
                            return {
                                protheus: String(data.protheus || data.codigoProtheus || "").trim(),
                                nome: data.nome || data.nomeCompleto || cleanUser.replace(/[._-]/g, " "),
                                filial: data.filial || "01 - Matriz",
                                cargo: data.cargo || "Promotor Técnico",
                                isAdmin: ADMIN_EMAILS.includes(emailWithDomain) || !!data.isAdmin,
                                email: data.email || emailWithDomain
                            };
                        }
                    } catch (e) {}
                    return null;
                })(),

                // 3e. Query em promotores
                (async () => {
                    try {
                        const q = query(collection(db, "promotores"), where("email", "==", emailWithDomain));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            const data = snap.docs[0].data();
                            return {
                                protheus: String(data.protheus || data.codigoProtheus || snap.docs[0].id).trim(),
                                nome: data.nome || cleanUser.replace(/[._-]/g, " "),
                                filial: data.filial || "01 - Matriz",
                                cargo: data.cargo || "Promotor Técnico",
                                isAdmin: ADMIN_EMAILS.includes(emailWithDomain),
                                email: data.email || emailWithDomain
                            };
                        }
                    } catch (e) {}
                    return null;
                })()
            ];

            const results = await Promise.all(checks);
            return results.find(r => r && r.protheus) || null;
        })();

        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3000));
        const resultadoFirestore = await Promise.race([firestorePromise, timeoutPromise]);
        if (resultadoFirestore && resultadoFirestore.protheus) {
            return resultadoFirestore;
        }
    } catch (err) {
        console.warn("Aviso ao consultar Firestore para vínculo Protheus:", err.message);
    }

    // 4. Fallback para qualquer colaborador com e-mail corporativo Makita
    if (term.endsWith("@makita.com.br") || term.endsWith("@makitabr.onmicrosoft.com")) {
        const username = cleanUser.replace(/[._-]/g, " ");
        return {
            protheus: "99999",
            nome: username,
            filial: "01 - Matriz",
            cargo: "Promotor Técnico",
            isAdmin: ADMIN_EMAILS.includes(term) || cleanUser === "j_melgaco",
            email: term
        };
    }

    // Se não pertence ao domínio corporativo nem à base autorizada, retorna null
    return null;
}

/**
 * Validação e Processamento de Usuário Logado
 */
async function processarUsuarioLogado(firebaseUser, vinculoPreCarregado = null) {
    if (!firebaseUser) {
        AuthState.user = null;
        AuthState.profile = null;
        AuthState.isAuthorized = false;
        AuthState.errorMessage = null;
        notifyAuth();
        return;
    }

    let email = firebaseUser.email ? firebaseUser.email.toLowerCase().trim() : "";
    if (email && !email.includes("@")) {
        email = `${email}@makita.com.br`;
    }

    // Regra 1: Validação de Domínio Corporativo (@makita.com.br)
    const isDomainMakita = email.endsWith("@makita.com.br") || 
                           email.endsWith("@makitabr.onmicrosoft.com") ||
                           email === "j_melgaco@makita.com.br";

    if (!isDomainMakita) {
        try { await signOut(auth); } catch (e) {}
        try { sessionStorage.removeItem("makita_auth_session"); } catch (e) {}
        try { localStorage.removeItem("makita_auth_session"); } catch (e) {}

        AuthState.user = null;
        AuthState.profile = null;
        AuthState.isAuthorized = false;
        AuthState.errorMessage = `Acesso negado: O e-mail "${email || 'informado'}" não pertence ao domínio corporativo (@makita.com.br). O acesso é exclusivo para colaboradores da Makita Brasil.`;
        notifyAuth();
        return;
    }

    // Regra 2: Consulta de Vínculo Protheus
    const cleanUser = email.split("@")[0].trim();
    const isMasterAdmin = email === "j_melgaco@makita.com.br" || cleanUser === "j_melgaco" || cleanUser === "88901";

    let vinculo = vinculoPreCarregado;
    if (!vinculo) {
        if (isMasterAdmin) {
            vinculo = {
                protheus: "88901",
                nome: "Jonathan Melgaço",
                filial: "01 - Matriz",
                cargo: "Administrador / Suporte",
                isAdmin: true,
                email: "j_melgaco@makita.com.br"
            };
        } else {
            vinculo = await buscarVinculoProtheus(email);
        }
    }

    if (!vinculo || !vinculo.protheus) {
        try { await signOut(auth); } catch (e) {}
        try { sessionStorage.removeItem("makita_auth_session"); } catch (e) {}
        try { localStorage.removeItem("makita_auth_session"); } catch (e) {}

        AuthState.user = null;
        AuthState.profile = null;
        AuthState.isAuthorized = false;
        AuthState.errorMessage = `Acesso não autorizado: O e-mail "${email}" não foi localizado na base da Makita.`;
        notifyAuth();
        return;
    }

    const protheusCode = vinculo.protheus;
    const nomeOficial = vinculo.nome || firebaseUser.displayName || cleanUser.replace(/[._-]/g, " ");
    const filialOficial = vinculo.filial || "01 - Matriz";
    const cargoOficial = vinculo.cargo || "Promotor Técnico";
    const isAdminUser = isMasterAdmin || vinculo.isAdmin === true;

    AuthState.user = firebaseUser;
    AuthState.profile = {
        email: email,
        nome: nomeOficial,
        protheus: protheusCode,
        filial: filialOficial,
        cargo: cargoOficial,
        isAdmin: isAdminUser,
        photoURL: firebaseUser.photoURL || null
    };
    AuthState.isAuthorized = true;
    AuthState.errorMessage = null;
    notifyAuth();
}

/**
 * Login com Conta Google (@makita.com.br)
 */
export async function loginComGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await processarUsuarioLogado(result.user);
        return { success: true };
    } catch (error) {
        console.error("Erro no login Google:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Login de Simulação — 100% instantâneo e à prova de falhas
 */
export async function simularLogin(emailSimulado) {
    const rawInput = (emailSimulado || "").toLowerCase().trim();
    const cleanUser = rawInput.split("@")[0].trim();
    const vinculo = await buscarVinculoProtheus(rawInput);

    const emailCanonical = vinculo?.email || (rawInput.includes("@") ? (rawInput.endsWith("@makita") ? `${rawInput}.com.br` : rawInput) : `${cleanUser}@makita.com.br`);
    const nomeReal = vinculo ? vinculo.nome : cleanUser.replace(/[._-]/g, " ");

    const fakeUser = {
        uid: "sim_" + emailCanonical.replace(/[^a-zA-Z0-9]/g, "_"),
        email: emailCanonical,
        displayName: nomeReal
    };

    // Ativa a flag ANTES de processar — evita que onAuthStateChanged(null) desfaça o login
    _simSessionActive = true;

    try {
        sessionStorage.setItem("makita_auth_session", JSON.stringify(fakeUser));
        localStorage.setItem("makita_auth_session", JSON.stringify(fakeUser));
    } catch (e) {}

    await processarUsuarioLogado(fakeUser, vinculo);
    return { success: true };
}

/**
 * Logout
 */
export async function fazerLogout() {
    _simSessionActive = false;
    try { sessionStorage.removeItem("makita_auth_session"); } catch (e) {}
    try { localStorage.removeItem("makita_auth_session"); } catch (e) {}
    try { await signOut(auth); } catch (e) {}
    AuthState.user = null;
    AuthState.profile = null;
    AuthState.isAuthorized = false;
    AuthState.errorMessage = null;
    notifyAuth();
}

/**
 * Inicializa a sessão — inicia sempre deslogado para exibir a tela de login
 */
export async function inicializarAuth() {
    _simSessionActive = false;
    AuthState.user = null;
    AuthState.profile = null;
    AuthState.isAuthorized = false;
    AuthState.errorMessage = null;
    try { sessionStorage.removeItem("makita_auth_session"); } catch (e) {}
    try { localStorage.removeItem("makita_auth_session"); } catch (e) {}
    notifyAuth();
}

// Observador do Firebase Auth — ignora eventos null enquanto houver sessão simulada ativa
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Login Firebase real: desativa modo simulado
        _simSessionActive = false;
        try { sessionStorage.removeItem("makita_auth_session"); } catch (e) {}
        await processarUsuarioLogado(user);
    } else {
        // Firebase dispara null — só processa se NÃO houver sessão simulada
        if (_simSessionActive) return;
        try {
            const saved = sessionStorage.getItem("makita_auth_session");
            if (saved) return;
        } catch (e) {}
        if (!AuthState.user) {
            await processarUsuarioLogado(null);
        }
    }
});
