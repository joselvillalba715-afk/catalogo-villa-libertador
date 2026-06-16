// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ============================================================
// Reemplazá los valores de abajo con los datos de TU proyecto
// de Firebase (los vas a encontrar en:
// Configuración del proyecto > General > Tus apps > SDK config)
//
// Instrucciones completas en SETUP.md
// ============================================================

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDERR3A47bfjvLrn5LBSlNxm498AjBYVAo",
  authDomain: "catalogo-villa-libertador.firebaseapp.com",
  projectId: "catalogo-villa-libertador",
  storageBucket: "catalogo-villa-libertador.firebasestorage.app",
  messagingSenderId: "152786364085",
  appId: "1:152786364085:web:75c1c37f1d64a3faa9c0fc",
  measurementId: "G-3FNC97L40V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Número de WhatsApp del negocio, en formato internacional
// (código de país + código de área sin 0 + número, sin espacios ni símbolos)
// Ejemplo para Argentina: 549 351 750-9439 -> 5493517509439
export const WHATSAPP_NUMBER = "5493517509439";

// Nombre del negocio (aparece en el encabezado del catálogo)
export const BUSINESS_NAME = "Distribuidora Villa Libertador";
