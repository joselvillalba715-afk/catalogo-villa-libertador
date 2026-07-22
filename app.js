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
  renderSeccionCombos();
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
// COMBOS PROMOCIONALES
// ============================================================
let todosLosCombos = [];

onSnapshot(collection(db, "combos"), (snapshot) => {
  todosLosCombos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderSeccionCombos();
  if (elCartBackdrop && !elCartBackdrop.classList.contains("hidden")) {
    renderCarrito();
  }
});

function obtenerCombosAplicados() {
  const combosAplicados = [];
  for (const combo of todosLosCombos) {
    if (!combo.activo) continue;
    const productos = combo.productos || [];
    if (productos.length < 2) continue;
    const cumple = productos.every(({ productoId, cantidad }) => {
      const itemCarrito = carrito[productoId];
      return itemCarrito && itemCarrito.cantidad >= cantidad;
    });
    if (cumple) {
      const base = productos.reduce((acc, { productoId, cantidad }) => {
        const item = carrito[productoId];
        if (!item) return acc;
        return acc + item.precioUnitario * cantidad;
      }, 0);
      const montoDescuento = combo.tipo === "monto"
        ? Math.min(combo.descuento, base) // monto fijo, no puede superar la base
        : Math.round(base * combo.descuento / 100 * 100) / 100;
      combosAplicados.push({ ...combo, base, porcentaje: combo.descuento, montoDescuento });
    }
  }
  return combosAplicados;
}

function totalDescuentoCombos() {
  return obtenerCombosAplicados().reduce((acc, c) => acc + c.montoDescuento, 0);
}

function renderSeccionCombos() {
  const seccion = document.getElementById("combos-seccion");
  const lista = document.getElementById("combos-lista");
  if (!seccion || !lista) return;

  const combosActivos = todosLosCombos.filter(c => c.activo && (c.productos || []).length >= 2);

  if (combosActivos.length === 0) {
    seccion.classList.add("hidden");
    return;
  }

  seccion.classList.remove("hidden");
  lista.innerHTML = "";

  for (const combo of combosActivos) {
    const card = document.createElement("div");
    card.className = "combo-card";

    // Verificar progreso del combo en el carrito
    const productos = combo.productos || [];
    const itemsEnCarrito = productos.filter(({ productoId, cantidad }) => {
      const item = carrito[productoId];
      return item && item.cantidad >= cantidad;
    }).length;
    const completo = itemsEnCarrito === productos.length;

    if (completo) card.classList.add("combo-card--completo");

    // Header del combo
    const header = document.createElement("div");
    header.className = "combo-card__header";

    const badge = document.createElement("span");
    badge.className = "combo-card__badge";
    badge.textContent = "COMBO ESPECIAL";
    header.appendChild(badge);

    const nombre = document.createElement("h3");
    nombre.className = "combo-card__nombre";
    nombre.textContent = combo.nombre;
    header.appendChild(nombre);

    if (combo.descripcion) {
      const desc = document.createElement("p");
      desc.className = "combo-card__desc";
      desc.textContent = combo.descripcion;
      header.appendChild(desc);
    }

    card.appendChild(header);

    // Productos del combo
    const productosWrap = document.createElement("div");
    productosWrap.className = "combo-card__productos";

    productos.forEach(({ productoId, cantidad }, idx) => {
      const prod = todosLosProductos.find(p => p.id === productoId);
      if (!idx === 0) {
        const plus = document.createElement("span");
        plus.className = "combo-card__plus";
        plus.textContent = "+";
        productosWrap.appendChild(plus);
      }

      const item = document.createElement("div");
      item.className = "combo-card__item";

      const enCarrito = carrito[productoId];
      const cumpleEste = enCarrito && enCarrito.cantidad >= cantidad;
      if (cumpleEste) item.classList.add("combo-card__item--ok");

      // Imagen
      const imgWrap = document.createElement("div");
      imgWrap.className = "combo-card__item-img";
      if (prod?.imagenUrl) {
        const img = document.createElement("img");
        img.src = prod.imagenUrl;
        img.alt = prod?.nombre || "";
        img.loading = "lazy";
        imgWrap.appendChild(img);
      } else {
        imgWrap.textContent = "📦";
      }
      item.appendChild(imgWrap);

      const itemInfo = document.createElement("div");
      itemInfo.className = "combo-card__item-info";

      const itemNombre = document.createElement("span");
      itemNombre.className = "combo-card__item-nombre";
      itemNombre.textContent = prod ? prod.nombre : "Producto no disponible";
      itemInfo.appendChild(itemNombre);

      const itemCant = document.createElement("span");
      itemCant.className = "combo-card__item-cant";
      itemCant.textContent = `x${fmtCantidad(cantidad)}`;
      itemInfo.appendChild(itemCant);

      if (cumpleEste) {
        const tick = document.createElement("span");
        tick.className = "combo-card__item-tick";
        tick.textContent = "✓";
        itemInfo.appendChild(tick);
      }

      item.appendChild(itemInfo);
      productosWrap.appendChild(item);
    });

    card.appendChild(productosWrap);

    // Calcular total y descuento del combo
    const precioTotal = productos.reduce((acc, { productoId, cantidad }) => {
      const prod = todosLosProductos.find(p => p.id === productoId);
      if (!prod) return acc;
      const precio = prod.promo && prod.precioPromo != null ? prod.precioPromo : prod.precio || 0;
      return acc + precio * cantidad;
    }, 0);
    const montoDescuentoCombo = combo.tipo === "monto"
      ? Math.min(combo.descuento, precioTotal)
      : Math.round(precioTotal * combo.descuento / 100 * 100) / 100;
    const precioConDescuento = precioTotal - montoDescuentoCombo;

    // Bloque de precios
    const preciosWrap = document.createElement("div");
    preciosWrap.className = "combo-card__precios";

    const precioNormal = document.createElement("span");
    precioNormal.className = "combo-card__precio-normal";
    precioNormal.textContent = fmt.format(precioTotal);
    preciosWrap.appendChild(precioNormal);

    const precioFinal = document.createElement("span");
    precioFinal.className = "combo-card__precio-final";
    precioFinal.textContent = fmt.format(precioConDescuento);
    preciosWrap.appendChild(precioFinal);

    const ahorro = document.createElement("span");
    ahorro.className = "combo-card__ahorro";
    ahorro.textContent = `Ahorrás ${fmt.format(montoDescuentoCombo)} por combo`;
    preciosWrap.appendChild(ahorro);

    card.appendChild(preciosWrap);

    // Progreso
    const progreso = document.createElement("div");
    progreso.className = "combo-card__progreso";
    const barra = document.createElement("div");
    barra.className = "combo-card__barra";
    const fill = document.createElement("div");
    fill.className = "combo-card__barra-fill";
    fill.style.width = `${(itemsEnCarrito / productos.length) * 100}%`;
    barra.appendChild(fill);
    progreso.appendChild(barra);
    const progresoTexto = document.createElement("span");
    progresoTexto.className = "combo-card__progreso-texto";
    progresoTexto.textContent = completo
      ? `✓ Combo completo — descuento de ${fmt.format(montoDescuentoCombo)} aplicado`
      : `${itemsEnCarrito} de ${productos.length} productos en tu carrito`;
    progreso.appendChild(progresoTexto);
    card.appendChild(progreso);

    // Selector de cantidad de combos + botón agregar
    if (!completo) {
      const comboQtyWrap = document.createElement("div");
      comboQtyWrap.className = "combo-card__qty-wrap";

      const labelQty = document.createElement("span");
      labelQty.className = "combo-card__qty-label";
      labelQty.textContent = "¿Cuántos combos querés?";
      comboQtyWrap.appendChild(labelQty);

      const stepperCombo = crearStepper(1, null, 1, 1);
      stepperCombo.classList.add("combo-card__stepper");
      comboQtyWrap.appendChild(stepperCombo);

      card.appendChild(comboQtyWrap);

      const btnAgregar = document.createElement("button");
      btnAgregar.type = "button";
      btnAgregar.className = "btn btn-primary btn-block combo-card__btn";
      btnAgregar.textContent = "🛒 Agregar combo completo";
      btnAgregar.addEventListener("click", () => {
        const cantCombos = parseFloat(stepperCombo.querySelector(".qty-stepper__value").textContent) || 1;
        productos.forEach(({ productoId, cantidad }) => {
          const prod = todosLosProductos.find(p => p.id === productoId);
          if (!prod) return;
          const cantidadTotal = cantidad * cantCombos;
          const enCarrito = carrito[productoId];
          const cantidadAAgregar = enCarrito
            ? Math.max(0, cantidadTotal - enCarrito.cantidad)
            : cantidadTotal;
          if (cantidadAAgregar > 0) {
            const precioUnitario = precioSegunVolumen(prod, cantidadTotal);
            agregarAlCarrito({ ...prod, precio: precioUnitario, promo: false, precioPromo: null }, cantidadAAgregar);
            if (carrito[productoId]) carrito[productoId].precioUnitario = precioUnitario;
            guardarCarrito();
          }
        });
        actualizarTodasLasTarjetas();
        renderSeccionCombos();
        renderCarrito();
      });
      card.appendChild(btnAgregar);
    }

    lista.appendChild(card);
  }
}

// ============================================================
// CARRUSEL DE PRODUCTOS DESTACADOS
// ============================================================
let carruselTimer = null;
let carruselIndex = 0;

function renderCarrusel(productos) {
  const wrap = document.getElementById("destacados-wrap");
  const track = document.getElementById("destacados-track");
  if (!wrap || !track) return;

  const destacados = productos.filter((p) => p.destacado && p.enStock !== false);

  if (destacados.length === 0) {
    wrap.classList.add("hidden");
    if (carruselTimer) clearInterval(carruselTimer);
    return;
  }

  wrap.classList.remove("hidden");
  track.innerHTML = "";

  // Duplicar para scroll infinito suave
  const todos = [...destacados, ...destacados];
  todos.forEach((p) => {
    const precioMostrar = p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;
    const card = document.createElement("div");
    card.className = "destacado-card";
    card.addEventListener("click", () => {
      // Scrollear al producto en el catálogo
      const seccion = document.getElementById(`cat-${slugify(p.categoria || "otros")}`);
      if (seccion) seccion.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const img = document.createElement("div");
    img.className = "destacado-card__img";
    if (p.imagenUrl) {
      const imgEl = document.createElement("img");
      imgEl.src = p.imagenUrl;
      imgEl.alt = p.nombre;
      imgEl.loading = "lazy";
      img.appendChild(imgEl);
    } else {
      img.textContent = "📦";
      img.style.display = "flex";
      img.style.alignItems = "center";
      img.style.justifyContent = "center";
      img.style.fontSize = "1.5rem";
    }
    card.appendChild(img);

    const info = document.createElement("div");
    info.className = "destacado-card__info";

    const nombre = document.createElement("p");
    nombre.className = "destacado-card__nombre";
    nombre.textContent = p.nombre;
    info.appendChild(nombre);

    const precio = document.createElement("p");
    precio.className = "destacado-card__precio";
    precio.textContent = fmt.format(precioMostrar);
    info.appendChild(precio);

    if (p.promo && p.promoTexto) {
      const promo = document.createElement("p");
      promo.className = "destacado-card__promo";
      promo.textContent = p.promoTexto;
      info.appendChild(promo);
    }

    card.appendChild(info);
    track.appendChild(card);
  });

  // Auto-scroll suave
  if (carruselTimer) clearInterval(carruselTimer);
  let pos = 0;
  const cardWidth = 160 + 12; // ancho + gap
  const totalWidth = destacados.length * cardWidth;

  carruselTimer = setInterval(() => {
    pos += 1;
    if (pos >= totalWidth) pos = 0;
    track.style.transform = `translateX(-${pos}px)`;
  }, 20);
}

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
  if (cuponAplicado.tope != null && cuponAplicado.tope > 0) {
    descuento = Math.min(descuento, cuponAplicado.tope);
  }

  return descuento;
}

function totalConDescuento() {
  return Math.max(0, totalCarrito() - calcularDescuento() - totalDescuentoCombos());
}

function aplicarCupon(codigoIngresado) {
  const resultado = validarCupon(codigoIngresado);
  const elMensaje = document.getElementById("cupon-mensaje");
  if (!resultado.ok) { if (elMensaje) elMensaje.textContent = resultado.mensaje; return; }
  cuponAplicado = resultado.cupon;
  if (elMensaje) elMensaje.textContent = "";
  renderCarrito();
}

function quitarCupon() {
  cuponAplicado = null;
  const elMensaje = document.getElementById("cupon-mensaje");
  if (elMensaje) elMensaje.textContent = "";
  const elInput = document.getElementById("cupon-input");
  if (elInput) elInput.value = "";
}

function textoDescripcionCupon(cupon) {
  const valorTexto = cupon.tipo === "porcentaje" ? `${cupon.valor}%` : fmt.format(cupon.valor);
  const alcanceTexto = cupon.alcance === "categoria" ? ` en ${cupon.categoria}` : "";
  let texto = `Cupón ${cupon.codigo}: ${valorTexto} de descuento${alcanceTexto}`;
  if (cupon.tope != null && cupon.tope > 0) {
    texto += ` (máx. ${fmt.format(cupon.tope)})`;
  }
  return texto;
}

function renderBloqueCupon() {
  const elInfo = document.getElementById("cupon-aplicado-info");
  const elTexto = document.getElementById("cupon-aplicado-texto");
  const elRow = document.querySelector(".cart-coupon__row");
  if (!elInfo || !elTexto || !elRow) return;
  if (cuponAplicado) {
    elTexto.textContent = textoDescripcionCupon(cuponAplicado);
    elInfo.classList.remove("hidden");
    elRow.classList.add("hidden");
  } else {
    elInfo.classList.add("hidden");
    elRow.classList.remove("hidden");
  }
}

document.getElementById("btn-aplicar-cupon")?.addEventListener("click", () => {
  aplicarCupon(document.getElementById("cupon-input").value);
});

document.getElementById("cupon-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); aplicarCupon(e.target.value); }
});

document.getElementById("btn-quitar-cupon")?.addEventListener("click", () => {
  quitarCupon(); renderCarrito();
});

function mensajeWhatsAppCarrito(nombreCliente, formaPago, observaciones) {
  const items = Object.values(carrito);
  const lineas = items.map((it) => `• ${fmtCantidad(it.cantidad)}x ${it.nombre} (${fmt.format(it.precioUnitario)} c/u) = ${fmt.format(it.precioUnitario * it.cantidad)}`);
  const descuento = calcularDescuento();
  const combosAplicados = obtenerCombosAplicados();
  let bloqueTotales = `\n\nSubtotal: ${fmt.format(totalCarrito())}`;
  if (descuento > 0 && cuponAplicado) {
    bloqueTotales += `\nDescuento (${cuponAplicado.codigo}): -${fmt.format(descuento)}`;
  }
  for (const combo of combosAplicados) {
    bloqueTotales += `\n🎁 ${combo.nombre}: -${fmt.format(combo.montoDescuento)}`;
  }
  bloqueTotales += `\nTotal: ${fmt.format(totalConDescuento())}`;
  const bloqueObservaciones = observaciones ? `\n\nObservaciones: ${observaciones}` : "";
  return `${waBase}?text=${encodeURIComponent(`Hola! Soy ${nombreCliente} y quiero hacer este pedido:\n\n${lineas.join("\n")}${bloqueTotales}\nForma de pago: ${formaPago}${bloqueObservaciones}`)}`;
}

// ----- Vistas del drawer -----
function mostrarVistaItems() {
  elCartDrawerTitle.textContent = "Mi pedido";
  elCartViewItems.classList.remove("hidden");
  elCartViewDatos.classList.add("hidden");
}

function mostrarVistaDatos() {
  elDatosClienteError.textContent = "";
  elCartDrawerTitle.textContent = "Tus datos";
  elCartViewItems.classList.add("hidden");
  elCartViewDatos.classList.remove("hidden");
}

if (elBtnVolverItems) elBtnVolverItems.addEventListener("click", mostrarVistaItems);

if (elFormDatosCliente) {
  elFormDatosCliente.addEventListener("submit", async (e) => {
    e.preventDefault();
    elDatosClienteError.textContent = "";
    const nombreCliente = document.getElementById("cliente-nombre").value.trim();
    const whatsappCliente = document.getElementById("cliente-whatsapp").value.trim().replace(/[^0-9]/g, "");
    const formaPago = document.getElementById("cliente-pago").value;
    const observaciones = document.getElementById("cliente-observaciones").value.trim();
    if (!nombreCliente || !whatsappCliente || !formaPago) {
      elDatosClienteError.textContent = "Completá tu nombre, tu número de WhatsApp y la forma de pago.";
      return;
    }
    const items = Object.entries(carrito).map(([id, it]) => ({ productoId: id, nombre: it.nombre, cantidad: it.cantidad, precioUnitario: it.precioUnitario, subtotal: it.precioUnitario * it.cantidad }));
    const descuento = calcularDescuento();

    // Detectar plataforma
    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const esAndroid = /android/i.test(navigator.userAgent);
    const linkWA = mensajeWhatsAppCarrito(nombreCliente, formaPago, observaciones);

    // En iOS abrimos ventana ANTES del await para evitar bloqueo de popup en Safari
    let ventanaWA = null;
    if (esIOS) {
      ventanaWA = window.open("", "_blank");
      if (ventanaWA) ventanaWA.location.href = linkWA;
    }

    elBtnConfirmarPedido.disabled = true; elBtnConfirmarPedido.textContent = "Enviando…";
    try {
      await addDoc(collection(db, "pedidos"), {
        clienteNombre: nombreCliente, clienteWhatsapp: whatsappCliente, formaPago, items,
        subtotal: totalCarrito(),
        cuponCodigo: cuponAplicado ? cuponAplicado.codigo : null,
        descuento: calcularDescuento(),
        combosAplicados: obtenerCombosAplicados().map(c => ({ nombre: c.nombre, porcentaje: c.porcentaje, monto: c.montoDescuento })),
        descuentoCombos: totalDescuentoCombos(),
        total: totalConDescuento(),
        observaciones: observaciones || "",
        creadoEn: serverTimestamp(),
      });

      if (esAndroid) {
        // Android: usar esquema nativo whatsapp:// para abrir directo sin pasar por Play Store
        const numero = linkWA.match(/wa\.me\/(\d+)/)?.[1] || "";
        const mensaje = decodeURIComponent(linkWA.split("?text=")[1] || "");
        window.location.href = `whatsapp://send?phone=${numero}&text=${encodeURIComponent(mensaje)}`;
        // Si no abre en 1.5s (WhatsApp no instalado), ir a wa.me
        setTimeout(() => { window.location.href = linkWA; }, 1500);
      } else if (!esIOS) {
        // Desktop u otros: abrir normalmente
        window.open(linkWA, "_blank", "noopener");
      } else if (!ventanaWA || ventanaWA.closed) {
        // iOS fallback si el popup fue bloqueado
        window.location.href = linkWA;
      }

      vaciarCarrito(); elFormDatosCliente.reset(); elCartBackdrop.classList.add("hidden"); mostrarVistaItems();
    } catch (err) {
      console.error(err); elDatosClienteError.textContent = "No se pudo registrar el pedido. Probá de nuevo en unos segundos.";
    } finally { elBtnConfirmarPedido.disabled = false; elBtnConfirmarPedido.textContent = "Confirmar y enviar por WhatsApp"; }
  });
}

function renderCarrito() {
  const items = Object.entries(carrito);
  renderBloqueCupon();
  const couponBlock = document.getElementById("cart-coupon-block");

  if (items.length === 0) {
    elCartItems.innerHTML = `<p class="state-message">Todavía no agregaste productos. Elegí cantidades en el catálogo y tocá "Agregar".</p>`;
    elCartFooter.innerHTML = "";
    if (couponBlock) couponBlock.classList.add("hidden");
    return;
  }

  if (couponBlock) couponBlock.classList.remove("hidden");
  elCartItems.innerHTML = "";

  for (const [id, it] of items) {
    const row = document.createElement("div"); row.className = "cart-item";
    const info = document.createElement("div"); info.className = "cart-item__info";
    const name = document.createElement("p"); name.className = "cart-item__name"; name.textContent = it.nombre; info.appendChild(name);
    const price = document.createElement("p"); price.className = "cart-item__price"; price.textContent = `${fmt.format(it.precioUnitario)} c/u`; info.appendChild(price);

    // Obtener mínimo del producto para respetarlo en el carrito
    const productoCompleto = todosLosProductos.find((p) => p.id === id);
    const minimoProducto = (productoCompleto?.minimoCompra != null && productoCompleto.minimoCompra > 0)
      ? productoCompleto.minimoCompra
      : (it.fraccionable ? 0.5 : 1);
    const pasoProducto = it.fraccionable ? 0.5 : 1;

    info.appendChild(crearStepper(it.cantidad, (nuevaCantidad) => {
      // Respetar el mínimo — no permitir bajar de él
      const cantidadFinal = Math.max(minimoProducto, nuevaCantidad);
      // Recalcular precio por volumen si el producto tiene escalones
      if (productoCompleto && productoCompleto.preciosVolumen && productoCompleto.preciosVolumen.length > 0) {
        const nuevoPrecio = precioSegunVolumen(productoCompleto, cantidadFinal);
        if (carrito[id]) carrito[id].precioUnitario = nuevoPrecio;
        guardarCarrito();
      }
      cambiarCantidadCarrito(id, cantidadFinal);
    }, pasoProducto, minimoProducto));
    row.appendChild(info);
    const right = document.createElement("div"); right.className = "cart-item__right";
    const subtotal = document.createElement("span"); subtotal.className = "cart-item__subtotal"; subtotal.textContent = fmt.format(it.precioUnitario * it.cantidad); right.appendChild(subtotal);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "cart-item__remove"; remove.textContent = "Quitar"; remove.addEventListener("click", () => quitarDelCarrito(id)); right.appendChild(remove);
    row.appendChild(right);
    elCartItems.appendChild(row);
  }

  elCartFooter.innerHTML = "";
  const descuento = calcularDescuento();
  const combosAplicados = obtenerCombosAplicados();
  const hayDescuentos = (descuento > 0 && cuponAplicado) || combosAplicados.length > 0;

  if (hayDescuentos) {
    const subtotalRow = document.createElement("div");
    subtotalRow.className = "cart-discount-row";
    subtotalRow.style.color = "var(--ink-soft)";
    subtotalRow.innerHTML = `<span>Subtotal</span><span>${fmt.format(totalCarrito())}</span>`;
    elCartFooter.appendChild(subtotalRow);
  }

  if (descuento > 0 && cuponAplicado) {
    const discountRow = document.createElement("div");
    discountRow.className = "cart-discount-row";
    discountRow.innerHTML = `<span>Descuento (${cuponAplicado.codigo})</span><span>-${fmt.format(descuento)}</span>`;
    elCartFooter.appendChild(discountRow);
  }

  // Mostrar cada combo aplicado
  for (const combo of combosAplicados) {
    const comboRow = document.createElement("div");
    comboRow.className = "cart-discount-row cart-combo-row";
    comboRow.innerHTML = `<span>🎁 ${combo.nombre}</span><span>-${fmt.format(combo.montoDescuento)}</span>`;
    elCartFooter.appendChild(comboRow);
  }

  const totalRow = document.createElement("div"); totalRow.className = "cart-total-row";
  totalRow.innerHTML = `<span>Total</span><span>${fmt.format(totalConDescuento())}</span>`;
  elCartFooter.appendChild(totalRow);

  // Aviso y bloqueo por mínimo general
  if (minimoGeneral > 0 && totalConDescuento() < minimoGeneral) {
    const faltante = minimoGeneral - totalConDescuento();
    const avisoMinimo = document.createElement("p");
    avisoMinimo.className = "cart-minimo-aviso";
    avisoMinimo.textContent = `Mínimo de compra: ${fmt.format(minimoGeneral)}. Te faltan ${fmt.format(faltante)}.`;
    elCartFooter.appendChild(avisoMinimo);
  }

  const btnEnviar = document.createElement("button"); btnEnviar.type = "button"; btnEnviar.className = "btn btn-primary btn-block"; btnEnviar.textContent = "Continuar pedido";
  if (minimoGeneral > 0 && totalConDescuento() < minimoGeneral) {
    btnEnviar.disabled = true;
    btnEnviar.style.opacity = "0.5";
    btnEnviar.style.cursor = "not-allowed";
  } else {
    btnEnviar.addEventListener("click", mostrarVistaDatos);
  }
  elCartFooter.appendChild(btnEnviar);
  const btnVaciar = document.createElement("button"); btnVaciar.type = "button"; btnVaciar.className = "btn btn-secondary btn-block"; btnVaciar.textContent = "Vaciar pedido"; btnVaciar.addEventListener("click", vaciarCarrito); elCartFooter.appendChild(btnVaciar);
}

// Refresca los precios del carrito contra los precios actuales del catálogo
function refrescarPreciosCarrito() {
  let huboCambio = false;
  for (const [id, item] of Object.entries(carrito)) {
    const productoActual = todosLosProductos.find((p) => p.id === id);
    if (!productoActual) continue;

    // Precio actual según volumen o precio base
    const precioActual = (productoActual.preciosVolumen && productoActual.preciosVolumen.length > 0)
      ? precioSegunVolumen(productoActual, item.cantidad)
      : (productoActual.promo && productoActual.precioPromo != null
          ? productoActual.precioPromo
          : productoActual.precio || 0);

    if (precioActual !== item.precioUnitario) {
      carrito[id].precioUnitario = precioActual;
      huboCambio = true;
    }
  }
  if (huboCambio) {
    guardarCarrito();
  }
}

if (elCartFloat) { elCartFloat.addEventListener("click", () => { refrescarPreciosCarrito(); renderCarrito(); mostrarVistaItems(); elCartBackdrop.classList.remove("hidden"); }); }
if (elCartClose) { elCartClose.addEventListener("click", () => { elCartBackdrop.classList.add("hidden"); }); }
if (elCartBackdrop) { elCartBackdrop.addEventListener("click", (e) => { if (e.target === elCartBackdrop) elCartBackdrop.classList.add("hidden"); }); }

actualizarBadge();



// ============================================================
// STEPPER
// ============================================================
function crearStepper(valorInicial, onChange, paso = 1, minimoVal = null) {
  const wrap = document.createElement("div"); wrap.className = "qty-stepper";
  const minimo = minimoVal !== null ? minimoVal : (paso < 1 ? paso : 1);
  let valor = valorInicial;
  const btnMenos = document.createElement("button"); btnMenos.type = "button"; btnMenos.textContent = "−"; btnMenos.setAttribute("aria-label", "Restar");
  const valorEl = document.createElement("span"); valorEl.className = "qty-stepper__value"; valorEl.textContent = fmtCantidad(valor);
  const btnMas = document.createElement("button"); btnMas.type = "button"; btnMas.textContent = "+"; btnMas.setAttribute("aria-label", "Sumar");
  btnMenos.addEventListener("click", () => { valor = Math.max(minimo, Math.round((valor - paso) * 10) / 10); valorEl.textContent = fmtCantidad(valor); if (onChange) onChange(valor); });
  btnMas.addEventListener("click", () => { valor = Math.round((valor + paso) * 10) / 10; valorEl.textContent = fmtCantidad(valor); if (onChange) onChange(valor); });
  wrap.appendChild(btnMenos); wrap.appendChild(valorEl); wrap.appendChild(btnMas);
  return wrap;
}

// ============================================================
// CATÁLOGO
// ============================================================
function slugify(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizarTexto(texto) {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

let todosLosProductos = [];

function renderNavCategorias(productos) {
  if (!elCatNav) return;
  const categorias = [...new Set(productos.map((p) => p.categoria || "Otros"))];
  const valorPrevio = elCatNav.value;
  elCatNav.innerHTML = `<option value="">Todas las categorías</option>`;
  for (const cat of categorias) { const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat; elCatNav.appendChild(opt); }
  if (valorPrevio) elCatNav.value = valorPrevio;
}

function aplicarFiltros() {
  const textoBusqueda = normalizarTexto(elBuscador ? elBuscador.value.trim() : "");
  const categoriaSeleccionada = elCatNav ? elCatNav.value : "";
  let filtrados = todosLosProductos;
  if (categoriaSeleccionada) filtrados = filtrados.filter((p) => (p.categoria || "Otros") === categoriaSeleccionada);
  if (textoBusqueda) filtrados = filtrados.filter((p) => normalizarTexto(p.nombre).includes(textoBusqueda));
  renderCatalogo(filtrados);
}

if (elBuscador) elBuscador.addEventListener("input", aplicarFiltros);
if (elCatNav) elCatNav.addEventListener("change", aplicarFiltros);

function renderCatalogo(productos) {
  if (!elCatalogo) return;
  if (!productos || productos.length === 0) {
    if (todosLosProductos.length === 0) { elCatalogo.innerHTML = `<p class="state-message">Por el momento no hay productos cargados.</p>`; if (elCatNav) elCatNav.innerHTML = `<option value="">Todas las categorías</option>`; }
    else { elCatalogo.innerHTML = `<div class="no-results"><p class="no-results__title">No encontramos productos</p><p>Probá con otra palabra o revisá la categoría elegida.</p></div>`; }
    return;
  }
  const categorias = new Map();
  for (const p of productos) { const cat = p.categoria || "Otros"; if (!categorias.has(cat)) categorias.set(cat, []); categorias.get(cat).push(p); }
  elCatalogo.innerHTML = "";
  tarjetasRegistradas.clear();
  for (const [cat, items] of categorias.entries()) {
    const section = document.createElement("section"); section.className = "category-section"; section.id = `cat-${slugify(cat)}`;
    const title = document.createElement("h2"); title.className = "category-section__title"; title.textContent = cat; section.appendChild(title);
    const grid = document.createElement("div"); grid.className = "product-grid";
    for (const p of items) grid.appendChild(renderCard(p));
    section.appendChild(grid); elCatalogo.appendChild(section);
  }
}

// Devuelve el precio aplicable según la cantidad y los escalones
function precioSegunVolumen(p, cantidad) {
  if (!p.preciosVolumen || p.preciosVolumen.length === 0) {
    return p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;
  }
  // Ordenar escalones de mayor a menor para encontrar el primero que aplica
  const escalones = [...p.preciosVolumen].sort((a, b) => b.cantidad - a.cantidad);
  for (const escalon of escalones) {
    if (cantidad >= escalon.cantidad) return escalon.precio;
  }
  // Si no alcanza ningún escalón, usar precio base
  return p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;
}

function renderCard(p) {
  const precioBase = p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;
  const card = document.createElement("article"); card.className = "product-card";
  if (p.enStock === false) card.classList.add("product-card--soldout");
  const imgWrap = document.createElement("div"); imgWrap.className = "product-card__img-wrap";
  if (p.imagenUrl) { const img = document.createElement("img"); img.src = p.imagenUrl; img.alt = p.nombre; img.loading = "lazy"; imgWrap.appendChild(img); }
  else { const ph = document.createElement("div"); ph.className = "product-card__img-placeholder"; const phText = document.createElement("span"); phText.textContent = p.nombre; ph.appendChild(phText); imgWrap.appendChild(ph); }
  if (p.promo && p.enStock !== false) { const stamp = document.createElement("span"); stamp.className = "promo-stamp"; stamp.textContent = "Oferta"; imgWrap.appendChild(stamp); }


  card.appendChild(imgWrap);
  const body = document.createElement("div"); body.className = "product-card__body";
  const metaWrap = document.createElement("div"); metaWrap.className = "product-card__meta";
  const name = document.createElement("h3"); name.className = "product-card__name"; name.textContent = p.nombre; metaWrap.appendChild(name);
  const priceRow = document.createElement("div"); priceRow.className = "product-card__price-row";
  if (p.promo && p.precioPromo != null && p.enStock !== false) { const oldPrice = document.createElement("span"); oldPrice.className = "product-card__price--old"; oldPrice.textContent = fmt.format(p.precio); priceRow.appendChild(oldPrice); }
  // Si tiene escalones de volumen, mostrar precio base tachado cuando el escalón da un precio menor
  const precioMinimoVolumen = p.preciosVolumen && p.preciosVolumen.length > 0
    ? Math.min(...p.preciosVolumen.map(e => e.precio))
    : null;
  if (precioMinimoVolumen != null && precioMinimoVolumen < precioBase && !p.promo) {
    const oldPriceVol = document.createElement("span");
    oldPriceVol.className = "product-card__price--old";
    oldPriceVol.textContent = fmt.format(precioBase);
    priceRow.appendChild(oldPriceVol);
  }
  const priceEl = document.createElement("span"); priceEl.className = "product-card__price"; priceEl.textContent = fmt.format(precioBase); priceRow.appendChild(priceEl);
  metaWrap.appendChild(priceRow); body.appendChild(metaWrap);
  if (p.promo && p.promoTexto && p.enStock !== false) { const promoText = document.createElement("p"); promoText.className = "product-card__promo-text"; promoText.textContent = p.promoTexto; metaWrap.appendChild(promoText); }
  if (p.fraccionable && p.enStock !== false) { const aviso = document.createElement("p"); aviso.className = "product-card__fraccionable-text"; aviso.textContent = "Se puede pedir por mitad (ej: 2 y media)"; metaWrap.appendChild(aviso); }

  // Tabla de precios por volumen
  if (p.preciosVolumen && p.preciosVolumen.length > 0 && p.enStock !== false) {
    const tabla = document.createElement("div");
    tabla.className = "volumen-tabla";
    const escalones = [...p.preciosVolumen].sort((a, b) => a.cantidad - b.cantidad);
    escalones.forEach((esc, idx) => {
      const siguiente = escalones[idx + 1];
      const fila = document.createElement("div");
      fila.className = "volumen-tabla__fila";
      fila.dataset.cantidad = esc.cantidad;
      const rango = siguiente
        ? `${esc.cantidad}–${siguiente.cantidad - 1} unid.`
        : `${esc.cantidad}+ unid.`;
      fila.innerHTML = `<span>${rango}</span><span>${fmt.format(esc.precio)} c/u</span>`;
      tabla.appendChild(fila);
    });
    metaWrap.appendChild(tabla);
  }

  if (p.enStock === false) {
    const badge = document.createElement("span"); badge.className = "product-card__stock-badge"; badge.textContent = "Sin stock"; body.appendChild(badge);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn-order btn-order--disabled"; btn.textContent = "No disponible"; btn.disabled = true; body.appendChild(btn);
  } else {
    const controls = document.createElement("div"); controls.className = "product-card__controls";

    if (p.minimoCompra != null && p.minimoCompra > 0) {
      const avisoMin = document.createElement("p");
      avisoMin.className = "product-card__minimo-texto";
      avisoMin.textContent = `Mín. ${fmtCantidad(p.minimoCompra)} unid.`;
      controls.appendChild(avisoMin);
    }

    // Referencia al elemento de precio para actualizarlo dinámicamente
    actualizarControlesCard(controls, p, priceEl);
    body.appendChild(controls);
  }
  card.appendChild(body);
  return card;
}

// Actualiza los controles de una tarjeta según si el producto ya está o no en el carrito
function actualizarControlesCard(controls, p, priceEl) {
  controls.innerHTML = "";
  tarjetasRegistradas.set(p.id, () => actualizarControlesCard(controls, p, priceEl));

  const enCarrito = carrito[p.id];

  function resaltarFilaVolumen(cantidad) {
    if (!p.preciosVolumen || p.preciosVolumen.length === 0) return;
    const card = controls.closest(".product-card");
    if (!card) return;
    const filas = card.querySelectorAll(".volumen-tabla__fila");
    let filaActiva = null;
    const escalones = [...p.preciosVolumen].sort((a, b) => b.cantidad - a.cantidad);
    for (const esc of escalones) {
      if (cantidad >= esc.cantidad) { filaActiva = esc.cantidad; break; }
    }
    filas.forEach((fila) => {
      fila.classList.toggle("volumen-tabla__fila--activa", parseInt(fila.dataset.cantidad) === filaActiva);
    });
    const precioActual = precioSegunVolumen(p, cantidad);
    if (priceEl) priceEl.textContent = fmt.format(precioActual);
    // Mostrar/ocultar precio tachado según si el escalón da descuento sobre el precio base
    const precioBase = p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;
    const oldPriceEl = priceEl?.parentElement?.querySelector(".product-card__price--old:last-of-type");
    if (oldPriceEl && precioActual < precioBase) {
      oldPriceEl.style.display = "";
    } else if (oldPriceEl) {
      oldPriceEl.style.display = "none";
    }
  }

  if (enCarrito) {
    const label = document.createElement("span");
    label.className = "btn-en-carrito-label";
    label.textContent = "✓ En carrito";
    controls.appendChild(label);

    const stepperMod = crearStepper(enCarrito.cantidad, null, p.fraccionable ? 0.5 : 1);
    controls.appendChild(stepperMod);
    resaltarFilaVolumen(enCarrito.cantidad);

    const btnModificar = document.createElement("button");
    btnModificar.type = "button";
    btnModificar.className = "btn-add btn-add--modificar";
    btnModificar.textContent = "Modificar";
    btnModificar.addEventListener("click", () => {
      const nuevaCantidad = parseFloat(stepperMod.querySelector(".qty-stepper__value").textContent.replace(",", "."));
      if (nuevaCantidad <= 0) {
        quitarDelCarrito(p.id);
      } else {
        if (carrito[p.id]) carrito[p.id].precioUnitario = precioSegunVolumen(p, nuevaCantidad);
        cambiarCantidadCarrito(p.id, nuevaCantidad);
      }
      actualizarControlesCard(controls, p, priceEl);
      btnModificar.textContent = "✓ Listo";
      setTimeout(() => actualizarControlesCard(controls, p, priceEl), 800);
    });
    controls.appendChild(btnModificar);

    const btnQuitar = document.createElement("button");
    btnQuitar.type = "button";
    btnQuitar.className = "btn-add btn-add--quitar";
    btnQuitar.textContent = "Quitar";
    btnQuitar.addEventListener("click", () => {
      quitarDelCarrito(p.id);
      actualizarControlesCard(controls, p, priceEl);
    });
    controls.appendChild(btnQuitar);
  } else {
    const minimo = (p.minimoCompra != null && p.minimoCompra > 0) ? p.minimoCompra : (p.fraccionable ? 0.5 : 1);
    const stepper = crearStepper(minimo, null, p.fraccionable ? 0.5 : 1);
    controls.appendChild(stepper);
    resaltarFilaVolumen(minimo);

    const btnAgregar = document.createElement("button");
    btnAgregar.type = "button";
    btnAgregar.className = "btn-add";
    btnAgregar.textContent = "Agregar";

    function verificarMinimo() {
      const cantidadActual = parseFloat(stepper.querySelector(".qty-stepper__value").textContent.replace(",", "."));
      resaltarFilaVolumen(cantidadActual);
      if (p.minimoCompra != null && p.minimoCompra > 0 && cantidadActual < p.minimoCompra) {
        btnAgregar.disabled = true;
        btnAgregar.style.opacity = "0.5";
        btnAgregar.title = `Mínimo: ${fmtCantidad(p.minimoCompra)} unidades`;
      } else {
        btnAgregar.disabled = false;
        btnAgregar.style.opacity = "";
        btnAgregar.title = "";
      }
    }

    stepper.querySelector(".qty-stepper button:first-child").addEventListener("click", verificarMinimo);
    stepper.querySelector(".qty-stepper button:last-child").addEventListener("click", verificarMinimo);
    verificarMinimo();

    btnAgregar.addEventListener("click", () => {
      const cantidad = parseFloat(stepper.querySelector(".qty-stepper__value").textContent.replace(",", "."));
      const precioUnitario = precioSegunVolumen(p, cantidad);
      // Pasar precio ya calculado para evitar que agregarAlCarrito use el precio base
      const pConPrecioVolumen = { ...p, precio: precioUnitario, promo: false, precioPromo: null };
      agregarAlCarrito(pConPrecioVolumen, cantidad);
      actualizarControlesCard(controls, p, priceEl);
    });
    controls.appendChild(btnAgregar);
  }
}

const productosQuery = query(collection(db, "productos"), orderBy("categoria"), orderBy("orden"));
onSnapshot(productosQuery, (snapshot) => {
  todosLosProductos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (elEstado) elEstado.classList.add("hidden");
  renderNavCategorias(todosLosProductos);
  renderCarrusel(todosLosProductos);
  renderSeccionCombos();
  aplicarFiltros();
}, (error) => {
  console.error(error);
  if (elEstado) { elEstado.textContent = "No se pudo cargar el catálogo. Revisá la configuración de Firebase."; elEstado.classList.remove("hidden"); }
});



// ============================================================
// POPUP PROMOCIONAL
// ============================================================
let popupTimer = null;

onSnapshot(doc(db, "configuracion", "popup"), (snap) => {
  if (!snap.exists()) return;
  const datos = snap.data();
  if (!datos.activo || !datos.imagenUrl) return;

  const backdrop = document.getElementById("promo-popup-backdrop");
  const img = document.getElementById("promo-popup-img");
  const barra = document.getElementById("promo-popup-barra");
  const btnCerrar = document.getElementById("promo-popup-cerrar");
  if (!backdrop || !img) return;

  img.src = datos.imagenUrl;
  backdrop.classList.remove("hidden");

  const segundos = datos.segundos || 8;

  // Barra de progreso animada
  barra.style.transition = "none";
  barra.style.width = "100%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      barra.style.transition = `width ${segundos}s linear`;
      barra.style.width = "0%";
    });
  });

  // Cierre automático
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => backdrop.classList.add("hidden"), segundos * 1000);

  // Cierre manual
  btnCerrar.onclick = () => {
    clearTimeout(popupTimer);
    backdrop.classList.add("hidden");
  };

  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      clearTimeout(popupTimer);
      backdrop.classList.add("hidden");
    }
  };
});
