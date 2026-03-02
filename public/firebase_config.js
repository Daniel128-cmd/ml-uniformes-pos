// firebase_config.js
// Integración Firebase SDK v9 (Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Si se usan funciones Cloud
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// TODO: Reemplazar con los datos generados por Firebase Console "Añadir App Web"
const firebaseConfig = {
    apiKey: "AIzaSyDqNf4Xq79pUuW7XP3_Aq2ECYzcJ0tk6FI",
    authDomain: "mlpuntodeventa.firebaseapp.com",
    projectId: "mlpuntodeventa",
    storageBucket: "mlpuntodeventa.firebasestorage.app",
    messagingSenderId: "833620608253",
    appId: "1:833620608253:web:e13b9010007badbb23ea94",
    measurementId: "G-TEBX30CKX9"
};

// Inicializar Apps
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "us-central1"); // Asegurar la región correcta
