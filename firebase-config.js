// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ============================================================
// Reemplazá los valores de abajo con los datos de TU proyecto
// de Firebase (los vas a encontrar en:
// Configuración del proyecto > General > Tus apps > SDK config)
//
// Instrucciones completas en SETUP.md
// ============================================================

export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Número de WhatsApp del negocio, en formato internacional
// (código de país + código de área sin 0 + número, sin espacios ni símbolos)
// Ejemplo para Argentina: 549 351 750-9439 -> 5493517509439
export const WHATSAPP_NUMBER = "5493517509439";

// Nombre del negocio (aparece en el encabezado del catálogo)
export const BUSINESS_NAME = "Distribuidora Villa Libertador";
