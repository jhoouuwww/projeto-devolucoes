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
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./config.js";

// Inicializa a aplicação Firebase
export const app = initializeApp(FIREBASE_CONFIG);

// Inicializa autenticação
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    hd: "makita.com.br" // Sugere o domínio corporativo
});

// Inicializa Firestore com conexão padrão otimizada
export const db = getFirestore(app);

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
    arrayUnion
};
