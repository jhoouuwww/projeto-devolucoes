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
    const term = rawTerm.includes("@") && !rawTerm.endsWith(".com.br") && !rawTerm.endsWith(".onmicrosoft.com")
        ? `${cleanUser}@makita.com.br`
        : rawTerm;

    // 1. Tenta buscar na Base Local (VINCULOS_INICIAIS) primeiro (Instantâneo / 0ms)
    for (const [k, v] of Object.entries(VINCULOS_INICIAIS)) {
        const emailUser = k.toLowerCase().trim();
        const username = emailUser.split("@")[0];
        const protheusCode = String(v.protheus || "").trim();
        const nomeUser = (v.nome || "").toLowerCase().trim();

        if (term === emailUser || cleanUser === username || term === username || term === protheusCode || term === nomeUser || (term.length >= 3 && nomeUser.includes(term)) || (cleanUser.length >= 3 && nomeUser.includes(cleanUser))) {
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
    if (ADMIN_EMAILS.includes(term) || ADMIN_EMAILS.includes(cleanUser) || cleanUser === "j_melgaco" || cleanUser === "88901" || cleanUser.includes("melgaco") || cleanUser.includes("jonathan")) {
        return {
            protheus: "88901",
            nome: "Jonathan Melgaço",
            filial: "01 - Matriz",
            cargo: "Administrador / Suporte",
            isAdmin: true,
            email: "j_melgaco@makita.com.br"
        };
    }

    // 3. Se não encontrou na base local, busca no Firestore (Coleção 'usuarios_protheus')
    try {
        const firestorePromise = (async () => {
            const docRef = doc(db, "usuarios_protheus", term);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    protheus: String(data.protheus || data.codigoProtheus || data.codProtheus || "").trim(),
                    nome: data.nome || data.nomeCompleto || term.split("@")[0].replace(".", " "),
                    filial: data.filial || "01 - Matriz",
                    cargo: data.cargo || "Colaborador",
                    isAdmin: ADMIN_EMAILS.includes(term) || !!data.isAdmin,
                    email: data.email || term
                };
            }

            const q1 = query(collection(db, "usuarios_protheus"), where("email", "==", term));
            const qSnap1 = await getDocs(q1);
            if (!qSnap1.empty) {
                const data = qSnap1.docs[0].data();
                return {
                    protheus: String(data.protheus || data.codigoProtheus || data.codProtheus || "").trim(),
                    nome: data.nome || data.nomeCompleto || term.split("@")[0].replace(".", " "),
                    filial: data.filial || "01 - Matriz",
                    cargo: data.cargo || "Colaborador",
                    isAdmin: ADMIN_EMAILS.includes(term) || !!data.isAdmin,
                    email: data.email || term
                };
            }

            const q2 = query(collection(db, "usuarios_protheus"), where("protheus", "==", term));
            const qSnap2 = await getDocs(q2);
            if (!qSnap2.empty) {
                const data = qSnap2.docs[0].data();
                return {
                    protheus: String(data.protheus || data.codigoProtheus || data.codProtheus || "").trim(),
                    nome: data.nome || data.nomeCompleto || term.split("@")[0].replace(".", " "),
                    filial: data.filial || "01 - Matriz",
                    cargo: data.cargo || "Colaborador",
                    isAdmin: ADMIN_EMAILS.includes(term) || !!data.isAdmin,
                    email: data.email || term
                };
            }
            return null;
        })();

        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 800));
        const resultadoFirestore = await Promise.race([firestorePromise, timeoutPromise]);
        if (resultadoFirestore && resultadoFirestore.protheus) {
            return resultadoFirestore;
        }
    } catch (err) {
        console.warn("Aviso ao consultar Firestore para vínculo Protheus:", err.message);
    }

    // 4. Fallback Dinâmico para qualquer colaborador Makita
    const fallbackEmail = term.includes("@") ? term : `${cleanUser}@makita.com.br`;
    const username = cleanUser.replace(/[._-]/g, " ");
    return {
        protheus: "99999",
        nome: username,
        filial: "01 - Matriz",
        cargo: "Promotor Técnico",
        isAdmin: ADMIN_EMAILS.includes(fallbackEmail) || fallbackEmail.includes("j_melgaco"),
        email: fallbackEmail
    };
}

/**
 * Validação e Processamento de Usuário Logado
 */
async function processarUsuarioLogado(firebaseUser) {
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
    } else if (email && email.endsWith("@makita")) {
        email = `${email}.com.br`;
    }

    // Regra 1: Validação de Domínio Corporativo ou Admins autorizados
    const cleanUser = email.split("@")[0].trim();
    const isDomainMakita = email.endsWith("@makita.com.br") || 
                           email.endsWith("@makitabr.onmicrosoft.com") || 
                           email.includes("makita") || 
                           VINCULOS_INICIAIS[email] !== undefined ||
                           ADMIN_EMAILS.includes(email) ||
                           ADMIN_EMAILS.includes(cleanUser);

    if (!isDomainMakita) {
        AuthState.user = firebaseUser;
        AuthState.profile = null;
        AuthState.isAuthorized = false;
        AuthState.errorMessage = `O e-mail "${email}" não pertence ao domínio corporativo (@makita.com.br). O acesso a este portal é restrito a colaboradores da empresa.`;
        notifyAuth();
        return;
    }

    // Regra 2: Busca de vínculo com Código Protheus no Firestore ou local
    const vinculo = await buscarVinculoProtheus(email);

    const protheusCode = vinculo?.protheus || "99999";
    const nomeOficial = (vinculo && vinculo.nome) ? vinculo.nome : (firebaseUser.displayName || cleanUser.replace(/[._-]/g, " "));
    const filialOficial = vinculo?.filial || "01 - Matriz";
    const cargoOficial = vinculo?.cargo || "Colaborador Makita";
    const isAdminUser = vinculo?.isAdmin === true || ADMIN_EMAILS.includes(email) || ADMIN_EMAILS.includes(cleanUser) || cleanUser === "j_melgaco";

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

    await processarUsuarioLogado(fakeUser);
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
