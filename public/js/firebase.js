/**
 * Inicialização e Exportação de Módulos do Firebase (SDK v10.8.1)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore,
    collection, 
    doc, 
    setDoc,
    addDoc, 
    getDoc,
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    writeBatch,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { FIREBASE_CONFIG, FIREBASE_CONFIG_ESTOQUE } from "./config.js";

// Inicializa a aplicação Firebase Devoluções (Principal)
export const app = initializeApp(FIREBASE_CONFIG);

// Inicializa autenticação
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    hd: "makita.com.br" // Sugere o domínio corporativo
});

// Inicializa Firestore do Devoluções
export const db = getFirestore(app);

// Inicializa Firestore do Projeto Estoque (Multi-App para Consulta de Catálogo)
let appEstoque = null;
let dbEstoque = null;
try {
    if (FIREBASE_CONFIG_ESTOQUE && FIREBASE_CONFIG_ESTOQUE.apiKey) {
        appEstoque = initializeApp(FIREBASE_CONFIG_ESTOQUE, "estoqueApp");
        dbEstoque = getFirestore(appEstoque);
    }
} catch (e) {
    console.warn("[Firebase] Aviso ao inicializar appEstoque:", e.message);
}
export { appEstoque, dbEstoque };

// Re-exporta helpers essenciais
export {
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut,
    onAuthStateChanged,
    collection, 
    doc, 
    setDoc,
    addDoc, 
    getDoc,
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    writeBatch,
    onSnapshot
};
