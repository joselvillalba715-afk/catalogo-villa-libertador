import { firebaseConfig, WHATSAPP_NUMBER, BUSINESS_NAME } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, orderBy, where, onSnapshot,
  addDoc, deleteDoc, doc, getDoc, setDoc, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
function fmtCantidad(num) { return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(".", ","); }
function slugify(t) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function normalizarTexto(t) { return (t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

// ── Auth ──
let preventistaData = null;

// ── Cliente seleccionado ──
let clienteSeleccionado = null; // { id, nombre, telefono, direccion, numero }
let todosLosClientes = [];

document.getElementById("prev-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("prev-login-error");
  err.textContent = "";
  const email = document.getElementById("prev-email").value.trim();
  const pass = document.getElementById("prev-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    err.textContent = "Email o contraseña incorrectos.";
  }
});

document.getElementById("prev-btn-logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById("prev-login-card").classList.remove("hidden");
    document.getElementById("prev-app").classList.add("hidden");
    preventistaData = null;
    return;
  }
  // Verificar rol en Firestore
  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists() || snap.data().rol !== "preventista") {
      await signOut(auth);
      document.getElementById("prev-login-error").textContent = "No tenés acceso como preventista.";
      return;
    }
    preventistaData = { uid: user.uid, email: user.email, ...snap.data() };
    document.getElementById("prev-nombre-display").textContent = preventistaData.nombre || user.email;
    document.getElementById("prev-login-card").classList.add("hidden");
    document.getElementById("prev-app").classList.remove("hidden");
    iniciarApp();
  } catch (err) {
    console.error(err);
    document.getElementById("prev-login-error").textContent = "Error al verificar acceso.";
    await signOut(auth);
  }
});

// ── Carrito ──
let carrito = {};

function totalItems() { return Object.values(carrito).reduce((acc, it) => acc + it.cantidad, 0); }

function actualizarBadge() {
  const badge = document.getElementById("prev-cart-badge");
  const total = totalItems();
  if (total > 0) { badge.textContent = fmtCantidad(total); badge.classList.remove("hidden"); }
  else { badge.classList.add("hidden"); }
}

function agregarAlCarrito(producto, cantidad) {
  const precio = producto.promo && producto.precioPromo != null ? producto.precioPromo : producto.precio || 0;
  if (carrito[producto.id]) {
    carrito[producto.id].cantidad += cantidad;
    carrito[producto.id].precioUnitario = precio;
  } else {
    carrito[producto.id] = { nombre: producto.nombre, precioUnitario: precio, cantidad, fraccionable: !!producto.fraccionable, categoria: producto.categoria || "Otros" };
  }
  actualizarBadge();
}

function cambiarCantidadCarrito(id, nuevaCantidad) {
  if (!carrito[id]) return;
  if (nuevaCantidad <= 0) delete carrito[id];
  else carrito[id].cantidad = nuevaCantidad;
  actualizarBadge();
  renderCarrito();
}

function quitarDelCarrito(id) {
  delete carrito[id]; actualizarBadge(); renderCarrito();
}

function vaciarCarrito() {
  carrito = {}; actualizarBadge(); renderCarrito();
}

function totalCarrito() { return Object.values(carrito).reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0); }

// ── Stepper ──
function crearStepper(valorInicial, onChange, paso = 1, minimoVal = null) {
  const wrap = document.createElement("div"); wrap.className = "qty-stepper";
  const minimo = minimoVal !== null ? minimoVal : (paso < 1 ? paso : 1);
  let valor = valorInicial;
  const btnMenos = document.createElement("button"); btnMenos.type = "button"; btnMenos.textContent = "−";
  const valorEl = document.createElement("span"); valorEl.className = "qty-stepper__value"; valorEl.textContent = fmtCantidad(valor);
  const btnMas = document.createElement("button"); btnMas.type = "button"; btnMas.textContent = "+";
  btnMenos.addEventListener("click", () => { valor = Math.max(minimo, Math.round((valor - paso) * 10) / 10); valorEl.textContent = fmtCantidad(valor); if (onChange) onChange(valor); });
  btnMas.addEventListener("click", () => { valor = Math.round((valor + paso) * 10) / 10; valorEl.textContent = fmtCantidad(valor); if (onChange) onChange(valor); });
  wrap.appendChild(btnMenos); wrap.appendChild(valorEl); wrap.appendChild(btnMas);
  return wrap;
}

// ── Render carrito ──
function renderCarrito() {
  const elItems = document.getElementById("prev-cart-items");
  const elFooter = document.getElementById("prev-cart-footer");
  const items = Object.entries(carrito);

  if (items.length === 0) {
    elItems.innerHTML = `<p class="state-message">Todavía no agregaste productos.</p>`;
    elFooter.innerHTML = "";
    return;
  }

  elItems.innerHTML = "";
  for (const [id, it] of items) {
    const row = document.createElement("div"); row.className = "cart-item";
    const info = document.createElement("div"); info.className = "cart-item__info";
    const name = document.createElement("p"); name.className = "cart-item__name"; name.textContent = it.nombre; info.appendChild(name);
    const price = document.createElement("p"); price.className = "cart-item__price"; price.textContent = `${fmt.format(it.precioUnitario)} c/u`; info.appendChild(price);
    const minimo = it.fraccionable ? 0.5 : 1;
    info.appendChild(crearStepper(it.cantidad, (nuevaCantidad) => cambiarCantidadCarrito(id, Math.max(minimo, nuevaCantidad)), it.fraccionable ? 0.5 : 1, minimo));
    row.appendChild(info);
    const right = document.createElement("div"); right.className = "cart-item__right";
    const subtotal = document.createElement("span"); subtotal.className = "cart-item__subtotal"; subtotal.textContent = fmt.format(it.precioUnitario * it.cantidad); right.appendChild(subtotal);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "cart-item__remove"; remove.textContent = "Quitar";
    remove.addEventListener("click", () => quitarDelCarrito(id)); right.appendChild(remove);
    row.appendChild(right); elItems.appendChild(row);
  }

  elFooter.innerHTML = "";
  const totalRow = document.createElement("div"); totalRow.className = "cart-total-row";
  totalRow.innerHTML = `<span>Total</span><span>${fmt.format(totalCarrito())}</span>`;
  elFooter.appendChild(totalRow);

  const btnContinuar = document.createElement("button"); btnContinuar.type = "button";
  btnContinuar.className = "btn btn-primary btn-block"; btnContinuar.textContent = "Continuar";
  btnContinuar.style.background = "#1a3a6b";
  btnContinuar.addEventListener("click", mostrarVistaDatos);
  elFooter.appendChild(btnContinuar);

  const btnVaciar = document.createElement("button"); btnVaciar.type = "button";
  btnVaciar.className = "btn btn-secondary btn-block"; btnVaciar.textContent = "Vaciar pedido";
  btnVaciar.addEventListener("click", vaciarCarrito);
  elFooter.appendChild(btnVaciar);
}

// ── Vistas del drawer ──
function mostrarVistaItems() {
  document.getElementById("prev-cart-title").textContent = "Pedido del cliente";
  document.getElementById("prev-cart-view-items").classList.remove("hidden");
  document.getElementById("prev-cart-view-datos").classList.add("hidden");
}

function mostrarVistaDatos() {
  document.getElementById("prev-datos-error").textContent = "";
  document.getElementById("prev-cart-title").textContent = "Datos del cliente";
  document.getElementById("prev-cart-view-items").classList.add("hidden");
  document.getElementById("prev-cart-view-datos").classList.remove("hidden");

  // Preseleccionar el día siguiente como fecha de entrega
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const yyyy = manana.getFullYear();
  const mm = String(manana.getMonth() + 1).padStart(2, "0");
  const dd = String(manana.getDate()).padStart(2, "0");
  const inputFecha = document.getElementById("prev-fecha-entrega");
  if (inputFecha && !inputFecha.value) {
    inputFecha.value = `${yyyy}-${mm}-${dd}`;
  }

  // Fecha mínima = hoy
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`;
  if (inputFecha) inputFecha.min = hoyStr;
}

document.getElementById("prev-btn-volver").addEventListener("click", mostrarVistaItems);
document.getElementById("prev-cart-close").addEventListener("click", () => {
  document.getElementById("prev-cart-backdrop").classList.add("hidden");
});
document.getElementById("prev-cart-backdrop").addEventListener("click", (e) => {
  if (e.target === document.getElementById("prev-cart-backdrop"))
    document.getElementById("prev-cart-backdrop").classList.add("hidden");
});
document.getElementById("prev-cart-float").addEventListener("click", () => {
  renderCarrito(); mostrarVistaItems();
  document.getElementById("prev-cart-backdrop").classList.remove("hidden");
});

// ── Confirmar pedido ──
document.getElementById("prev-form-datos").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("prev-datos-error");
  errEl.textContent = "";
  if (!clienteSeleccionado) {
    errEl.textContent = "Seleccioná un cliente antes de confirmar."; return;
  }
  const clienteNombre = clienteSeleccionado.nombre;
  const clienteWhatsapp = clienteSeleccionado.telefono.replace(/[^0-9]/g, "");
  const formaPago = document.getElementById("prev-cliente-pago").value;
  const fechaEntrega = document.getElementById("prev-fecha-entrega").value;
  const observaciones = document.getElementById("prev-cliente-obs").value.trim();
  if (!formaPago) {
    errEl.textContent = "Seleccioná la forma de pago."; return;
  }
  if (!fechaEntrega) {
    errEl.textContent = "Seleccioná la fecha de entrega."; return;
  }
  const btnConfirmar = document.getElementById("prev-btn-confirmar");
  btnConfirmar.disabled = true; btnConfirmar.textContent = "Guardando…";
  try {
    const items = Object.entries(carrito).map(([id, it]) => ({
      productoId: id, nombre: it.nombre, cantidad: it.cantidad,
      precioUnitario: it.precioUnitario, subtotal: it.precioUnitario * it.cantidad,
    }));
    await addDoc(collection(db, "pedidos"), {
      clienteNombre, clienteWhatsapp, formaPago, items,
      subtotal: totalCarrito(), total: totalCarrito(),
      observaciones: observaciones || "",
      fechaEntrega: fechaEntrega || "",
      preventista: preventistaData.uid,
      preventistaNombre: preventistaData.nombre || preventistaData.email,
      creadoEn: serverTimestamp(),
      cuponCodigo: null, descuento: 0, combosAplicados: [], descuentoCombos: 0,
    });
    // Formatear fecha de entrega para el mensaje
    const fechaEntregaFormateada = fechaEntrega
      ? new Date(fechaEntrega + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })
      : "";
    // Abrir WhatsApp con el pedido
    const lineas = Object.values(carrito).map(it =>
      `• ${fmtCantidad(it.cantidad)}x ${it.nombre} (${fmt.format(it.precioUnitario)} c/u) = ${fmt.format(it.precioUnitario * it.cantidad)}`
    );
    const texto = `Hola! Soy ${clienteNombre} y este es mi pedido:\n\n${lineas.join("\n")}\n\nTotal: ${fmt.format(totalCarrito())}\nForma de pago: ${formaPago}${fechaEntregaFormateada ? `\nFecha de entrega: ${fechaEntregaFormateada}` : ""}${observaciones ? `\nObservaciones: ${observaciones}` : ""}`;
    const link = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
    const esAndroid = /android/i.test(navigator.userAgent);
    if (esAndroid) {
      window.location.href = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(texto)}`;
      setTimeout(() => { window.location.href = link; }, 1500);
    } else {
      window.open(link, "_blank", "noopener");
    }
    vaciarCarrito();
    document.getElementById("prev-form-datos").reset();
    document.getElementById("prev-fecha-entrega").value = ""; // resetear para que próximo pedido preseleccione de nuevo
    document.getElementById("prev-cart-backdrop").classList.add("hidden");
    mostrarVistaItems();
  } catch (err) {
    console.error(err);
    errEl.textContent = "No se pudo guardar el pedido. Intentá de nuevo.";
  } finally {
    btnConfirmar.disabled = false; btnConfirmar.textContent = "Confirmar pedido";
  }
});

// ── Catálogo ──
let todosLosProductos = [];
const tarjetasRegistradas = new Map();

function actualizarTodasLasTarjetas() {
  for (const fn of tarjetasRegistradas.values()) fn();
}

function renderNavCategorias(productos) {
  const nav = document.getElementById("prev-cat-nav");
  if (!nav) return;
  const categorias = [...new Set(productos.map(p => p.categoria || "Otros"))];
  const prev = nav.value;
  nav.innerHTML = `<option value="">Todas las categorías</option>`;
  categorias.forEach(cat => { const o = document.createElement("option"); o.value = cat; o.textContent = cat; nav.appendChild(o); });
  if (prev) nav.value = prev;
}

function aplicarFiltros() {
  const texto = normalizarTexto(document.getElementById("prev-buscador")?.value.trim() || "");
  const cat = document.getElementById("prev-cat-nav")?.value || "";
  let filtrados = todosLosProductos;
  if (cat) filtrados = filtrados.filter(p => (p.categoria || "Otros") === cat);
  if (texto) filtrados = filtrados.filter(p => normalizarTexto(p.nombre).includes(texto));
  renderCatalogo(filtrados);
}

document.getElementById("prev-buscador")?.addEventListener("input", aplicarFiltros);
document.getElementById("prev-cat-nav")?.addEventListener("change", aplicarFiltros);

function renderCatalogo(productos) {
  const el = document.getElementById("prev-catalogo");
  if (!productos || productos.length === 0) {
    el.innerHTML = todosLosProductos.length === 0
      ? `<p class="state-message">Cargando catálogo…</p>`
      : `<div class="no-results"><p class="no-results__title">Sin resultados</p></div>`;
    return;
  }
  const categorias = new Map();
  for (const p of productos) {
    const cat = p.categoria || "Otros";
    if (!categorias.has(cat)) categorias.set(cat, []);
    categorias.get(cat).push(p);
  }
  for (const [, items] of categorias.entries()) {
    items.sort((a, b) => (a.enStock !== false ? 0 : 1) - (b.enStock !== false ? 0 : 1));
  }
  el.innerHTML = "";
  tarjetasRegistradas.clear();
  for (const [cat, items] of categorias.entries()) {
    const section = document.createElement("section"); section.className = "category-section"; section.id = `cat-${slugify(cat)}`;
    const title = document.createElement("h2"); title.className = "category-section__title"; title.textContent = cat; section.appendChild(title);
    const grid = document.createElement("div"); grid.className = "product-grid";
    for (const p of items) grid.appendChild(renderCard(p));
    section.appendChild(grid); el.appendChild(section);
  }
}

function renderCard(p) {
  const precio = p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;
  const card = document.createElement("article"); card.className = "product-card";
  if (p.enStock === false) card.classList.add("product-card--soldout");

  const imgWrap = document.createElement("div"); imgWrap.className = "product-card__img-wrap";
  if (p.imagenUrl) { const img = document.createElement("img"); img.src = p.imagenUrl; img.alt = p.nombre; img.loading = "lazy"; imgWrap.appendChild(img); }
  else { const ph = document.createElement("div"); ph.className = "product-card__img-placeholder"; const s = document.createElement("span"); s.textContent = p.nombre; ph.appendChild(s); imgWrap.appendChild(ph); }
  if (p.promo && p.enStock !== false) { const stamp = document.createElement("span"); stamp.className = "promo-stamp"; stamp.textContent = "Oferta"; imgWrap.appendChild(stamp); }
  card.appendChild(imgWrap);

  const body = document.createElement("div"); body.className = "product-card__body";
  const meta = document.createElement("div"); meta.className = "product-card__meta";
  const name = document.createElement("h3"); name.className = "product-card__name"; name.textContent = p.nombre; meta.appendChild(name);
  const priceRow = document.createElement("div"); priceRow.className = "product-card__price-row";
  if (p.promo && p.precioPromo != null && p.enStock !== false) { const old = document.createElement("span"); old.className = "product-card__price--old"; old.textContent = fmt.format(p.precio); priceRow.appendChild(old); }
  const priceEl = document.createElement("span"); priceEl.className = "product-card__price"; priceEl.textContent = fmt.format(precio); priceRow.appendChild(priceEl);
  meta.appendChild(priceRow); body.appendChild(meta);
  if (p.fraccionable && p.enStock !== false) { const av = document.createElement("p"); av.className = "product-card__fraccionable-text"; av.textContent = "Se puede pedir por mitad"; meta.appendChild(av); }

  if (p.enStock === false) {
    const badge = document.createElement("span"); badge.className = "product-card__stock-badge"; badge.textContent = "Sin stock"; body.appendChild(badge);
  } else {
    const controls = document.createElement("div"); controls.className = "product-card__controls";
    actualizarControlesCard(controls, p);
    body.appendChild(controls);
  }
  card.appendChild(body);
  return card;
}

function actualizarControlesCard(controls, p) {
  controls.innerHTML = "";
  tarjetasRegistradas.set(p.id, () => actualizarControlesCard(controls, p));
  const enCarrito = carrito[p.id];
  const paso = p.fraccionable ? 0.5 : 1;
  const minimo = p.minimoCompra > 0 ? p.minimoCompra : paso;

  if (enCarrito) {
    const label = document.createElement("span"); label.className = "btn-en-carrito-label"; label.textContent = "✓ En carrito"; controls.appendChild(label);
    const stepper = crearStepper(enCarrito.cantidad, null, paso, minimo); controls.appendChild(stepper);
    const btnMod = document.createElement("button"); btnMod.type = "button"; btnMod.className = "btn-add btn-add--modificar"; btnMod.textContent = "Modificar";
    btnMod.addEventListener("click", () => {
      const cant = parseFloat(stepper.querySelector(".qty-stepper__value").textContent.replace(",", "."));
      cambiarCantidadCarrito(p.id, cant);
      actualizarControlesCard(controls, p);
      btnMod.textContent = "✓ Listo";
      setTimeout(() => actualizarControlesCard(controls, p), 800);
    });
    controls.appendChild(btnMod);
    const btnQ = document.createElement("button"); btnQ.type = "button"; btnQ.className = "btn-add btn-add--quitar"; btnQ.textContent = "Quitar";
    btnQ.addEventListener("click", () => { quitarDelCarrito(p.id); actualizarControlesCard(controls, p); });
    controls.appendChild(btnQ);
  } else {
    const stepper = crearStepper(minimo, null, paso, minimo); controls.appendChild(stepper);
    const btnAgregar = document.createElement("button"); btnAgregar.type = "button"; btnAgregar.className = "btn-add"; btnAgregar.textContent = "Agregar";
    const verificar = () => {
      const cant = parseFloat(stepper.querySelector(".qty-stepper__value").textContent.replace(",", "."));
      btnAgregar.disabled = p.minimoCompra > 0 && cant < p.minimoCompra;
      btnAgregar.style.opacity = btnAgregar.disabled ? "0.5" : "";
    };
    stepper.querySelector("button:first-child").addEventListener("click", verificar);
    stepper.querySelector("button:last-child").addEventListener("click", verificar);
    verificar();
    btnAgregar.addEventListener("click", () => {
      const cant = parseFloat(stepper.querySelector(".qty-stepper__value").textContent.replace(",", "."));
      agregarAlCarrito(p, cant);
      actualizarControlesCard(controls, p);
    });
    controls.appendChild(btnAgregar);
  }
}

// ── Resumen de pedidos ──
let misPedidos = [];

function renderResumen() {
  const desde = document.getElementById("prev-filtro-desde").value;
  const hasta = document.getElementById("prev-filtro-hasta").value;

  let filtrados = misPedidos;
  if (desde) filtrados = filtrados.filter(p => {
    const f = p.creadoEn?.toDate ? p.creadoEn.toDate() : null;
    return f && f >= new Date(desde + "T00:00:00");
  });
  if (hasta) filtrados = filtrados.filter(p => {
    const f = p.creadoEn?.toDate ? p.creadoEn.toDate() : null;
    return f && f <= new Date(hasta + "T23:59:59");
  });

  // Stats
  const totalVendido = filtrados.reduce((acc, p) => acc + (p.total || 0), 0);
  const productosVendidos = {};
  filtrados.forEach(p => (p.items || []).forEach(it => {
    productosVendidos[it.nombre] = (productosVendidos[it.nombre] || 0) + it.cantidad;
  }));
  const topProducto = Object.entries(productosVendidos).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("prev-stats").innerHTML = `
    <div class="prev-stat"><div class="prev-stat__valor">${filtrados.length}</div><div class="prev-stat__label">Pedidos tomados</div></div>
    <div class="prev-stat"><div class="prev-stat__valor">${fmt.format(totalVendido)}</div><div class="prev-stat__label">Total vendido</div></div>
    <div class="prev-stat"><div class="prev-stat__valor">${topProducto ? topProducto[0].split(" ").slice(0, 2).join(" ") : "—"}</div><div class="prev-stat__label">Producto más pedido</div></div>
  `;

  // Lista de pedidos
  const lista = document.getElementById("prev-pedidos-lista");
  lista.innerHTML = "";
  if (filtrados.length === 0) { lista.innerHTML = `<p class="helper-text">No hay pedidos en este período.</p>`; return; }

  for (const pedido of filtrados) {
    const card = document.createElement("div"); card.className = "order-card";
    if (pedido.procesado) card.classList.add("order-card--procesado");
    const header = document.createElement("button"); header.type = "button"; header.className = "order-card__header";
    const info = document.createElement("div"); info.className = "order-card__header-info";
    const fecha = pedido.creadoEn?.toDate ? pedido.creadoEn.toDate() : null;
    const fechaStr = fecha ? `${fecha.toLocaleDateString("es-AR")} · ${fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "—";
    info.innerHTML = `<span class="order-card__datetime">${fechaStr}</span><span class="order-card__client">${pedido.clienteNombre || "Sin nombre"} · ${pedido.clienteWhatsapp || ""}</span>`;
    header.appendChild(info);
    const total = document.createElement("span"); total.className = "order-card__total"; total.textContent = fmt.format(pedido.total || 0); header.appendChild(total);
    const chevron = document.createElement("span"); chevron.className = "order-card__chevron"; chevron.textContent = "▾"; header.appendChild(chevron);

    const detail = document.createElement("div"); detail.className = "order-card__detail hidden";
    const tabla = document.createElement("table"); tabla.className = "order-detail-table";
    tabla.innerHTML = `<thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    (pedido.items || []).forEach(it => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.nombre}</td><td>${it.cantidad}</td><td>${fmt.format(it.precioUnitario)}</td><td>${fmt.format(it.subtotal)}</td>`;
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody); detail.appendChild(tabla);

    // Acciones
    const acciones = document.createElement("div"); acciones.style.cssText = "display:flex; gap:8px; margin-top:10px;";
    const btnWA = document.createElement("a"); btnWA.className = "btn btn-secondary"; btnWA.textContent = "WhatsApp";
    btnWA.href = `https://wa.me/${pedido.clienteWhatsapp}`; btnWA.target = "_blank"; btnWA.rel = "noopener";
    acciones.appendChild(btnWA);

    // Solo puede eliminar sus propios pedidos no procesados
    if (!pedido.procesado) {
      const btnEliminar = document.createElement("button"); btnEliminar.type = "button"; btnEliminar.className = "btn btn-danger"; btnEliminar.textContent = "Eliminar";
      btnEliminar.addEventListener("click", async () => {
        if (!confirm(`¿Eliminar el pedido de "${pedido.clienteNombre}"?`)) return;
        try { await deleteDoc(doc(db, "pedidos", pedido.id)); }
        catch (err) { console.error(err); alert("No se pudo eliminar."); }
      });
      acciones.appendChild(btnEliminar);
    }
    detail.appendChild(acciones);

    header.addEventListener("click", () => {
      detail.classList.toggle("hidden");
      chevron.textContent = detail.classList.contains("hidden") ? "▾" : "▴";
    });
    card.appendChild(header); card.appendChild(detail); lista.appendChild(card);
  }
}

document.getElementById("prev-btn-resumen").addEventListener("click", () => {
  renderResumen();
  document.getElementById("prev-resumen").classList.remove("hidden");
});
document.getElementById("prev-btn-cerrar-resumen").addEventListener("click", () => {
  document.getElementById("prev-resumen").classList.add("hidden");
});
document.getElementById("prev-filtro-desde").addEventListener("change", renderResumen);
document.getElementById("prev-filtro-hasta").addEventListener("change", renderResumen);
document.getElementById("prev-btn-limpiar-filtros").addEventListener("click", () => {
  document.getElementById("prev-filtro-desde").value = "";
  document.getElementById("prev-filtro-hasta").value = "";
  renderResumen();
});

// ── Iniciar app ──
function iniciarApp() {
  // Suscripción a productos
  const productosQuery = query(collection(db, "productos"), orderBy("categoria"), orderBy("orden"));
  onSnapshot(productosQuery, (snapshot) => {
    todosLosProductos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById("prev-estado")?.classList.add("hidden");
    renderNavCategorias(todosLosProductos);
    aplicarFiltros();
  });

  // Suscripción a mis pedidos
  const pedidosQuery = query(
    collection(db, "pedidos"),
    where("preventista", "==", preventistaData.uid),
    orderBy("creadoEn", "desc")
  );
  onSnapshot(pedidosQuery, (snapshot) => {
    misPedidos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  });

  // Cargar clientes_reparto
  onSnapshot(
    query(collection(db, "clientes_reparto"), orderBy("nombre")),
    (snapshot) => {
      todosLosClientes = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.activo !== false);
    }
  );

  // Iniciar agenda
  iniciarAgenda();
}

// ============================================================
// BÚSQUEDA Y ALTA DE CLIENTES
// ============================================================

function normalizarBusqueda(texto) {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mostrarClienteSeleccionado(cliente) {
  clienteSeleccionado = cliente;
  document.getElementById("prev-buscar-cliente").style.display = "none";
  document.getElementById("prev-clientes-sugerencias").style.display = "none";
  document.getElementById("prev-btn-alta-wrap").style.display = "none";
  document.getElementById("prev-form-alta-cliente").style.display = "none";
  document.getElementById("prev-cs-nombre").textContent = cliente.nombre;
  document.getElementById("prev-cs-direccion").textContent = cliente.direccion || "Sin dirección";
  document.getElementById("prev-cs-telefono").textContent = cliente.telefono ? `📞 ${cliente.telefono}` : "Sin teléfono";
  document.getElementById("prev-cliente-seleccionado").style.display = "block";
}

function resetearBuscadorCliente() {
  clienteSeleccionado = null;
  const input = document.getElementById("prev-buscar-cliente");
  input.value = "";
  input.style.display = "";
  document.getElementById("prev-cliente-seleccionado").style.display = "none";
  document.getElementById("prev-btn-alta-wrap").style.display = "none";
  document.getElementById("prev-form-alta-cliente").style.display = "none";
  document.getElementById("prev-clientes-sugerencias").style.display = "none";
  input.focus();
}

document.getElementById("prev-btn-cambiar-cliente")?.addEventListener("click", resetearBuscadorCliente);

document.getElementById("prev-buscar-cliente")?.addEventListener("input", (e) => {
  const texto = normalizarBusqueda(e.target.value.trim());
  const sugerencias = document.getElementById("prev-clientes-sugerencias");
  const altaWrap = document.getElementById("prev-btn-alta-wrap");

  if (texto.length < 2) {
    sugerencias.style.display = "none";
    altaWrap.style.display = "none";
    return;
  }

  const filtrados = todosLosClientes.filter(c =>
    normalizarBusqueda(c.nombre).includes(texto) ||
    normalizarBusqueda(c.numero || "").includes(texto)
  ).slice(0, 8);

  sugerencias.innerHTML = "";

  if (filtrados.length === 0) {
    sugerencias.style.display = "none";
    altaWrap.style.display = "block";
    return;
  }

  altaWrap.style.display = "none";
  sugerencias.style.display = "block";

  filtrados.forEach(cliente => {
    const item = document.createElement("div");
    item.style.cssText = "padding:10px 14px; cursor:pointer; border-bottom:1px solid var(--border); font-size:0.85rem;";
    item.innerHTML = `<strong>${cliente.nombre}</strong><br><span style="color:var(--muted); font-size:0.75rem;">${cliente.direccion || ""} · Tel: ${cliente.telefono || "—"}</span>`;
    item.addEventListener("mousedown", (ev) => { ev.preventDefault(); mostrarClienteSeleccionado(cliente); });
    item.addEventListener("touchstart", (ev) => { ev.preventDefault(); mostrarClienteSeleccionado(cliente); });
    sugerencias.appendChild(item);
  });
});

document.getElementById("prev-buscar-cliente")?.addEventListener("blur", () => {
  setTimeout(() => { document.getElementById("prev-clientes-sugerencias").style.display = "none"; }, 200);
});

document.getElementById("prev-btn-dar-alta")?.addEventListener("click", () => {
  const texto = document.getElementById("prev-buscar-cliente").value.trim();
  document.getElementById("prev-alta-nombre").value = texto;
  document.getElementById("prev-btn-alta-wrap").style.display = "none";
  document.getElementById("prev-form-alta-cliente").style.display = "block";
  document.getElementById("prev-alta-nombre").focus();
});

document.getElementById("prev-btn-cancelar-alta")?.addEventListener("click", () => {
  document.getElementById("prev-form-alta-cliente").style.display = "none";
  document.getElementById("prev-btn-alta-wrap").style.display = "block";
  document.getElementById("prev-alta-error").textContent = "";
});

document.getElementById("prev-btn-guardar-alta")?.addEventListener("click", async () => {
  const errEl = document.getElementById("prev-alta-error");
  errEl.textContent = "";
  const nombre = document.getElementById("prev-alta-nombre").value.trim().toUpperCase();
  const numero = document.getElementById("prev-alta-numero").value.trim();
  const telefono = document.getElementById("prev-alta-telefono").value.trim().replace(/[^0-9]/g, "");
  const direccion = document.getElementById("prev-alta-direccion").value.trim().toUpperCase();

  if (!nombre) { errEl.textContent = "El nombre es obligatorio."; return; }

  const btn = document.getElementById("prev-btn-guardar-alta");
  btn.disabled = true; btn.textContent = "Guardando…";

  try {
    const docRef = await addDoc(collection(db, "clientes_reparto"), {
      nombre, numero: numero || "", telefono: telefono || "", direccion: direccion || "",
      activo: true, envaseSaldo: {},
      creadoPor: preventistaData?.nombre || preventistaData?.email || "preventista",
      creadoEn: serverTimestamp(),
    });
    const nuevoCliente = { id: docRef.id, nombre, numero, telefono, direccion };
    todosLosClientes.push(nuevoCliente);
    ["prev-alta-nombre", "prev-alta-numero", "prev-alta-telefono", "prev-alta-direccion"].forEach(id => {
      document.getElementById(id).value = "";
    });
    document.getElementById("prev-form-alta-cliente").style.display = "none";
    mostrarClienteSeleccionado(nuevoCliente);
  } catch (err) {
    console.error(err);
    errEl.textContent = "No se pudo guardar el cliente. Intentá de nuevo.";
  } finally {
    btn.disabled = false; btn.textContent = "Guardar cliente";
  }
});

actualizarBadge();

// ============================================================
// AGENDA DEL PREVENTISTA
// ============================================================

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
let agendaData = {}; // { clienteId: { diaSemana: N, excepciones: [{fecha, nota}] } }
let agendaDocId = null;
let suscripcionAgenda = null;

function iniciarAgenda() {
  if (!preventistaData) return;
  // Escuchar la agenda del preventista en tiempo real
  const agendaQuery = query(
    collection(db, "agenda_preventista"),
    where("preventistaId", "==", preventistaData.uid)
  );
  suscripcionAgenda = onSnapshot(agendaQuery, (snapshot) => {
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      agendaDocId = docSnap.id;
      agendaData = docSnap.data().clientes || {};
    } else {
      agendaDocId = null;
      agendaData = {};
    }
    renderAgendaHoy();
    renderAgendaSemana();
    renderAgendaAsignar();
  });
}

async function guardarAgenda() {
  const datos = {
    preventistaId: preventistaData.uid,
    preventistaNombre: preventistaData.nombre || preventistaData.email,
    clientes: agendaData,
    actualizadoEn: serverTimestamp(),
  };
  if (agendaDocId) {
    await setDoc(doc(db, "agenda_preventista", agendaDocId), datos, { merge: true });
  } else {
    const ref = await addDoc(collection(db, "agenda_preventista"), datos);
    agendaDocId = ref.id;
  }
}

// ── Hoy ──
function renderAgendaHoy() {
  const hoy = new Date();
  const diaSemanaHoy = hoy.getDay(); // 0=domingo
  const fechaHoy = hoy.toISOString().slice(0, 10);

  const el = document.getElementById("agenda-hoy-lista");
  const fechaEl = document.getElementById("agenda-hoy-fecha");
  if (!el) return;

  fechaEl.textContent = `${DIAS_SEMANA[diaSemanaHoy]}, ${hoy.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}`;

  // Clientes de hoy = dia base coincide O tienen excepción para hoy
  const clientesHoy = todosLosClientes.filter(c => {
    const cfg = agendaData[c.id];
    if (!cfg) return false;
    if (cfg.diaSemana === diaSemanaHoy) return true;
    if (cfg.excepciones?.some(e => e.fecha === fechaHoy)) return true;
    return false;
  });

  if (clientesHoy.length === 0) {
    el.innerHTML = `<p class="helper-text" style="text-align:center; padding:20px;">No tenés clientes asignados para hoy.</p>`;
    return;
  }

  el.innerHTML = "";
  clientesHoy.forEach(c => {
    const cfg = agendaData[c.id] || {};
    const excepHoy = cfg.excepciones?.find(e => e.fecha === fechaHoy);
    const visitado = cfg.visitadoHoy === fechaHoy;

    const card = document.createElement("div");
    card.className = `agenda-hoy-card${visitado ? " agenda-hoy-card--visitado" : ""}`;

    const info = document.createElement("div");
    info.style.flex = "1";
    info.innerHTML = `
      <p class="agenda-cliente-nombre">${c.nombre}</p>
      <p class="agenda-cliente-sub">${c.direccion || ""} ${c.telefono ? "· " + c.telefono : ""}</p>
      ${excepHoy ? `<p style="font-size:0.72rem; color:#1a3a6b; margin:2px 0 0;">📌 Visita especial${excepHoy.nota ? ": " + excepHoy.nota : ""}</p>` : ""}
    `;
    card.appendChild(info);

    const acciones = document.createElement("div");
    acciones.style.cssText = "display:flex; gap:6px; align-items:center; flex-wrap:wrap;";

    const btnVisitado = document.createElement("button");
    btnVisitado.type = "button";
    btnVisitado.className = "btn";
    btnVisitado.style.cssText = visitado
      ? "background:#2d7a4f; color:#fff; padding:6px 12px; font-size:0.78rem;"
      : "background:#1a3a6b; color:#fff; padding:6px 12px; font-size:0.78rem;";
    btnVisitado.textContent = visitado ? "✓ Visitado" : "Marcar visitado";
    btnVisitado.addEventListener("click", async () => {
      if (!agendaData[c.id]) agendaData[c.id] = {};
      agendaData[c.id].visitadoHoy = visitado ? null : fechaHoy;
      await guardarAgenda();
    });
    acciones.appendChild(btnVisitado);

    if (c.telefono) {
      const btnWA = document.createElement("a");
      btnWA.href = `https://wa.me/${c.telefono.replace(/[^0-9]/g, "")}`;
      btnWA.target = "_blank"; btnWA.rel = "noopener";
      btnWA.className = "btn btn-secondary";
      btnWA.style.cssText = "padding:6px 10px; font-size:0.78rem;";
      btnWA.textContent = "📱";
      acciones.appendChild(btnWA);
    }

    card.appendChild(acciones);
    el.appendChild(card);
  });
}

// ── Esta semana ──
function renderAgendaSemana() {
  const el = document.getElementById("agenda-semana-contenido");
  if (!el) return;
  el.innerHTML = "";

  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // Lunes de esta semana

  for (let i = 0; i < 6; i++) { // Lunes a Sábado
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    const diaSemana = dia.getDay();
    const fechaDia = dia.toISOString().slice(0, 10);
    const esHoy = fechaDia === hoy.toISOString().slice(0, 10);

    const clientesDia = todosLosClientes.filter(c => {
      const cfg = agendaData[c.id];
      if (!cfg) return false;
      if (cfg.diaSemana === diaSemana) return true;
      if (cfg.excepciones?.some(e => e.fecha === fechaDia)) return true;
      return false;
    });

    if (clientesDia.length === 0 && !esHoy) continue;

    const seccion = document.createElement("div");
    seccion.style.marginBottom = "16px";

    const titulo = document.createElement("p");
    titulo.className = "agenda-dia-label";
    titulo.style.cssText = esHoy ? "color:#1a3a6b; background:#e8f0fe; padding:4px 8px; border-radius:6px; display:inline-block;" : "";
    titulo.textContent = `${DIAS_SEMANA[diaSemana]} ${dia.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}${esHoy ? " — HOY" : ""}`;
    seccion.appendChild(titulo);

    if (clientesDia.length === 0) {
      const p = document.createElement("p");
      p.className = "helper-text";
      p.textContent = "Sin clientes asignados.";
      seccion.appendChild(p);
    } else {
      clientesDia.forEach(c => {
        const row = document.createElement("div");
        row.className = "agenda-cliente-row";
        row.style.marginBottom = "6px";
        row.innerHTML = `
          <div class="agenda-cliente-info">
            <p class="agenda-cliente-nombre">${c.nombre}</p>
            <p class="agenda-cliente-sub">${c.direccion || ""}${c.telefono ? " · " + c.telefono : ""}</p>
          </div>
        `;
        seccion.appendChild(row);
      });
    }
    el.appendChild(seccion);
  }
}

// ── Asignar días ──
let filtroAsignar = "";

function renderAgendaAsignar() {
  const el = document.getElementById("agenda-clientes-lista");
  if (!el) return;

  const filtrados = filtroAsignar.length >= 2
    ? todosLosClientes.filter(c => normalizarBusqueda(c.nombre).includes(normalizarBusqueda(filtroAsignar)))
    : todosLosClientes;

  el.innerHTML = "";
  filtrados.slice(0, 50).forEach(c => {
    const cfg = agendaData[c.id] || {};
    const row = document.createElement("div");
    row.className = "agenda-cliente-row";

    const info = document.createElement("div");
    info.className = "agenda-cliente-info";
    info.innerHTML = `<p class="agenda-cliente-nombre">${c.nombre}</p><p class="agenda-cliente-sub">${c.direccion || ""}</p>`;
    row.appendChild(info);

    const controles = document.createElement("div");
    controles.style.cssText = "display:flex; gap:6px; align-items:center; flex-wrap:wrap;";

    // Selector de día base
    const select = document.createElement("select");
    select.className = "agenda-dia-select";
    select.innerHTML = `<option value="">Sin día</option>` +
      [1,2,3,4,5,6].map(d => `<option value="${d}" ${cfg.diaSemana === d ? "selected" : ""}>${DIAS_SEMANA[d]}</option>`).join("");
    select.addEventListener("change", async () => {
      if (!agendaData[c.id]) agendaData[c.id] = {};
      agendaData[c.id].diaSemana = select.value ? parseInt(select.value) : null;
      await guardarAgenda();
    });
    controles.appendChild(select);

    // Botón visita excepcional
    const btnExcep = document.createElement("button");
    btnExcep.type = "button";
    btnExcep.className = "agenda-excep-btn";
    btnExcep.textContent = "📌 Excepción";
    btnExcep.addEventListener("click", () => abrirExcepcion(c));
    controles.appendChild(btnExcep);

    row.appendChild(controles);
    el.appendChild(row);
  });
}

document.getElementById("agenda-buscar-cliente")?.addEventListener("input", (e) => {
  filtroAsignar = e.target.value.trim();
  renderAgendaAsignar();
});

// ── Excepción puntual ──
function abrirExcepcion(cliente) {
  const fecha = prompt(`Fecha de visita excepcional para ${cliente.nombre} (AAAA-MM-DD):`);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
  const nota = prompt("Nota opcional (dejá vacío si no hay):");
  if (!agendaData[cliente.id]) agendaData[cliente.id] = {};
  if (!agendaData[cliente.id].excepciones) agendaData[cliente.id].excepciones = [];
  // Evitar duplicados
  agendaData[cliente.id].excepciones = agendaData[cliente.id].excepciones.filter(e => e.fecha !== fecha);
  agendaData[cliente.id].excepciones.push({ fecha, nota: nota || "" });
  guardarAgenda().then(() => {
    renderAgendaHoy();
    renderAgendaSemana();
  });
}

// ── Inactivos ──
document.getElementById("btn-buscar-inactivos")?.addEventListener("click", () => renderInactivos());

async function renderInactivos() {
  const el = document.getElementById("agenda-inactivos-lista");
  const diasInput = parseInt(document.getElementById("agenda-dias-inactivo").value) || 30;
  if (!el) return;
  el.innerHTML = `<p class="helper-text">Buscando...</p>`;

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasInput);

  // Obtener últimos pedidos por cliente
  const ultimosCompra = {}; // clienteNombre → fecha
  misPedidos.forEach(p => {
    const fecha = p.creadoEn?.toDate ? p.creadoEn.toDate() : null;
    if (!fecha) return;
    const nombre = (p.clienteNombre || "").toUpperCase();
    if (!ultimosCompra[nombre] || fecha > ultimosCompra[nombre]) {
      ultimosCompra[nombre] = fecha;
    }
  });

  // Buscar clientes inactivos entre los asignados al preventista
  const clientesAsignados = todosLosClientes.filter(c => agendaData[c.id]?.diaSemana != null);

  const inactivos = clientesAsignados.filter(c => {
    const ultimaCompra = ultimosCompra[c.nombre.toUpperCase()];
    if (!ultimaCompra) return true; // Nunca compró
    return ultimaCompra < fechaLimite;
  }).map(c => {
    const ultimaCompra = ultimosCompra[c.nombre.toUpperCase()];
    const diasSinComprar = ultimaCompra
      ? Math.floor((new Date() - ultimaCompra) / (1000 * 60 * 60 * 24))
      : null;
    return { ...c, ultimaCompra, diasSinComprar };
  }).sort((a, b) => (b.diasSinComprar || 9999) - (a.diasSinComprar || 9999));

  el.innerHTML = "";
  if (inactivos.length === 0) {
    el.innerHTML = `<p class="helper-text" style="text-align:center; padding:20px;">✓ Todos tus clientes compraron en los últimos ${diasInput} días.</p>`;
    return;
  }

  inactivos.forEach(c => {
    const card = document.createElement("div");
    card.className = "agenda-inactivo-card";
    card.innerHTML = `
      <div style="flex:1;">
        <p style="font-weight:700; font-size:0.88rem; margin:0 0 2px;">${c.nombre}</p>
        <p style="font-size:0.75rem; color:var(--muted); margin:0;">${c.direccion || ""} ${c.telefono ? "· " + c.telefono : ""}</p>
        <p style="font-size:0.75rem; color:#b8860b; margin:2px 0 0;">
          ${c.ultimaCompra ? `Última compra: ${c.ultimaCompra.toLocaleDateString("es-AR")}` : "Sin compras registradas desde el catálogo"}
        </p>
      </div>
      <div class="agenda-inactivo-dias">${c.diasSinComprar ? c.diasSinComprar + "d" : "—"}</div>
    `;
    if (c.telefono) {
      const btnWA = document.createElement("a");
      btnWA.href = `https://wa.me/${c.telefono.replace(/[^0-9]/g,"")}`;
      btnWA.target = "_blank"; btnWA.rel = "noopener";
      btnWA.className = "btn btn-secondary";
      btnWA.style.cssText = "padding:5px 10px; font-size:0.75rem;";
      btnWA.textContent = "📱";
      card.appendChild(btnWA);
    }
    el.appendChild(card);
  });
}

// ── Tabs de agenda ──
document.querySelectorAll(".agenda-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".agenda-tab").forEach(b => b.classList.remove("agenda-tab--active"));
    btn.classList.add("agenda-tab--active");
    ["hoy","semana","asignar","inactivos"].forEach(t => {
      const el = document.getElementById(`agenda-tab-${t}`);
      if (el) el.classList.toggle("hidden", t !== btn.dataset.tab);
    });
    if (btn.dataset.tab === "inactivos") renderInactivos();
    if (btn.dataset.tab === "asignar") renderAgendaAsignar();
  });
});

// ── Abrir/cerrar agenda ──
document.getElementById("prev-btn-agenda")?.addEventListener("click", () => {
  renderAgendaHoy();
  renderAgendaSemana();
  renderAgendaAsignar();
  document.getElementById("prev-agenda-panel").classList.remove("hidden");
});
document.getElementById("prev-btn-cerrar-agenda")?.addEventListener("click", () => {
  document.getElementById("prev-agenda-panel").classList.add("hidden");
});
