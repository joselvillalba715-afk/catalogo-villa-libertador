import { firebaseConfig, WHATSAPP_NUMBER, BUSINESS_NAME } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const elEstado = document.getElementById("estado");
const elCatalogo = document.getElementById("catalogo");
const elCatNav = document.getElementById("cat-nav") || document.querySelector(".cat-selector__dropdown");
const elUltimaActualizacion = document.getElementById("ultima-actualizacion");
const elBuscador = document.getElementById("buscador");

const elCartFloat = document.getElementById("cart-float");
const elCartBadge = document.getElementById("cart-badge");
const elCartBackdrop = document.getElementById("cart-backdrop");
const elCartClose = document.getElementById("cart-close");
const elCartItems = document.getElementById("cart-items");
const elCartFooter = document.getElementById("cart-footer");

const elCartViewItems = document.getElementById("cart-view-items");
const elCartViewDatos = document.getElementById("cart-view-datos");
const elCartDrawerTitle = document.getElementById("cart-drawer-title");
const elFormDatosCliente = document.getElementById("form-datos-cliente");
const elDatosClienteError = document.getElementById("datos-cliente-error");
const elBtnVolverItems = document.getElementById("btn-volver-items");
const elBtnConfirmarPedido = document.getElementById("btn-confirmar-pedido");

const waBase = `https://wa.me/${WHATSAPP_NUMBER}`;

function waLinkGeneral() {
  return `${waBase}?text=${encodeURIComponent(`Hola! Quiero hacer una consulta sobre el catálogo de ${BUSINESS_NAME}.`)}`;
}

if (document.getElementById("wa-footer-link")) document.getElementById("wa-footer-link").href = waLinkGeneral();
if (elUltimaActualizacion) elUltimaActualizacion.textContent = "Stock y precios actualizados en el momento";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

function fmtCantidad(num) {
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(".", ",");
}

// ============================================================
// CARRITO
// ============================================================
const CART_KEY = "vl_carrito";

function cargarCarrito() {
  try { const data = JSON.parse(localStorage.getItem(CART_KEY)); return data && typeof data === "object" ? data : {}; }
  catch { return {}; }
}

function guardarCarrito() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(carrito)); } catch {}
}

let carrito = cargarCarrito();

// Registro de funciones de actualización de controles por producto
const tarjetasRegistradas = new Map(); // productoId → función actualizarControlesCard

function actualizarTodasLasTarjetas() {
  for (const [id, fn] of tarjetasRegistradas.entries()) {
    fn();
  }
}

function totalItems() {
  return Object.values(carrito).reduce((acc, it) => acc + it.cantidad, 0);
}

function actualizarBadge() {
  if (!elCartBadge) return;
  const total = totalItems();
  if (total > 0) { elCartBadge.textContent = fmtCantidad(total); elCartBadge.classList.remove("hidden"); }
  else { elCartBadge.classList.add("hidden"); }
}

function agregarAlCarrito(producto, cantidad) {
  const precioUnitario = producto.promo && producto.precioPromo != null ? producto.precioPromo : producto.precio || 0;
  if (carrito[producto.id]) {
    carrito[producto.id].cantidad += cantidad;
    carrito[producto.id].precioUnitario = precioUnitario;
    carrito[producto.id].nombre = producto.nombre;
    carrito[producto.id].fraccionable = !!producto.fraccionable;
    carrito[producto.id].categoria = producto.categoria || "Otros";
  } else {
    carrito[producto.id] = { nombre: producto.nombre, precioUnitario, cantidad, fraccionable: !!producto.fraccionable, categoria: producto.categoria || "Otros" };
  }
  guardarCarrito();
  actualizarBadge();
  actualizarTodasLasTarjetas();
}

function cambiarCantidadCarrito(id, nuevaCantidad) {
  if (!carrito[id]) return;
  if (nuevaCantidad <= 0) delete carrito[id];
  else carrito[id].cantidad = nuevaCantidad;
  guardarCarrito(); actualizarBadge(); renderCarrito(); actualizarTodasLasTarjetas();
}

function quitarDelCarrito(id) {
  delete carrito[id]; guardarCarrito(); actualizarBadge(); renderCarrito(); actualizarTodasLasTarjetas();
}

function vaciarCarrito() {
  carrito = {}; guardarCarrito(); actualizarBadge(); quitarCupon(); renderCarrito(); actualizarTodasLasTarjetas();
}

function totalCarrito() {
  return Object.values(carrito).reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
}

// ============================================================
// CONFIGURACIÓN GENERAL (mínimo de compra)
// ============================================================
let minimoGeneral = 0;

onSnapshot(doc(db, "configuracion", "catalogo"), (snap) => {
  if (snap.exists()) {
    minimoGeneral = snap.data().minimoGeneral || 0;
  } else {
    minimoGeneral = 0;
  }
  // Re-renderizar el carrito si está abierto para actualizar el aviso
  if (elCartBackdrop && !elCartBackdrop.classList.contains("hidden")) {
    renderCarrito();
  }
});

// ============================================================
// CUPONES
// ============================================================
let todosLosCupones = [];
let cuponAplicado = null;

onSnapshot(collection(db, "cupones"), (snapshot) => {
  todosLosCupones = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (cuponAplicado && !validarCupon(cuponAplicado.codigo).ok) quitarCupon();
});

function hoyComoString() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

function validarCupon(codigoIngresado) {
  const codigo = (codigoIngresado || "").trim().toUpperCase();
  if (!codigo) return { ok: false, mensaje: "Escribí un código de descuento." };
  const cupon = todosLosCupones.find((c) => (c.codigo || "").toUpperCase() === codigo);
  if (!cupon) return { ok: false, mensaje: "El código ingresado no existe." };
  if (!cupon.activo) return { ok: false, mensaje: "Este cupón no está activo." };
  const hoy = hoyComoString();
  if (cupon.desde && hoy < cupon.desde) return { ok: false, mensaje: "Este cupón todavía no está vigente." };
  if (cupon.hasta && hoy > cupon.hasta) return { ok: false, mensaje: "Este cupón venció." };
  if (cupon.alcance === "categoria") {
    const hayProducto = Object.values(carrito).some((it) => (it.categoria || "Otros") === cupon.categoria);
    if (!hayProducto) return { ok: false, mensaje: `Este cupón aplica solo a productos de "${cupon.categoria}". No tenés ninguno en tu pedido.` };
  }

  // Validar monto mínimo
  if (cupon.minimo != null && cupon.minimo > 0) {
    const base = cupon.alcance === "categoria"
      ? Object.values(carrito).filter((it) => (it.categoria || "Otros") === cupon.categoria).reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0)
      : totalCarrito();
    if (base < cupon.minimo) {
      const fmtMin = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(cupon.minimo);
      const alcanceTexto = cupon.alcance === "categoria" ? ` en ${cupon.categoria}` : "";
      return { ok: false, mensaje: `Este cupón requiere un pedido mínimo de ${fmtMin}${alcanceTexto}.` };
    }
  }

  return { ok: true, cupon };
}

function calcularBaseDescuento(cupon) {
  if (cupon.alcance === "categoria") {
    return Object.values(carrito).filter((it) => (it.categoria || "Otros") === cupon.categoria).reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
  }
  return totalCarrito();
}

function calcularDescuento() {
  if (!cuponAplicado) return 0;
  const revalidacion = validarCupon(cuponAplicado.codigo);
  if (!revalidacion.ok) return 0;
  const base = calcularBaseDescuento(cuponAplicado);
  if (base <= 0) return 0;

  let descuento;
  if (cuponAplicado.tipo === "porcentaje") {
    descuento = Math.round(((base * cuponAplicado.valor) / 100) * 100) / 100;
  } else {
    descuento = Math.min(cuponAplicado.valor, base);
  }

  // Aplicar tope máximo si existe
  if (cuponAplicado.tope != null && cuponAplicado.tope
