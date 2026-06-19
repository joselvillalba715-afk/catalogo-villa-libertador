import { firebaseConfig, WHATSAPP_NUMBER, BUSINESS_NAME } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
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

// ----- Links de WhatsApp -----
const waBase = `https://wa.me/${WHATSAPP_NUMBER}`;

function waLinkGeneral() {
  const texto = `Hola! Quiero hacer una consulta sobre el catálogo de ${BUSINESS_NAME}.`;
  return `${waBase}?text=${encodeURIComponent(texto)}`;
}

if (document.getElementById("wa-footer-link")) {
  document.getElementById("wa-footer-link").href = waLinkGeneral();
}
if (elUltimaActualizacion) {
  elUltimaActualizacion.textContent = "Stock y precios actualizados en el momento";
}

// ----- Formato de precio -----
const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function fmtCantidad(num) {
  // Muestra "3" en vez de "3.0", pero "3.5" tal cual
  return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(".", ",");
}

// ============================================================
// CARRITO
// ============================================================

const CART_KEY = "vl_carrito";

function cargarCarrito() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function guardarCarrito() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(carrito));
  } catch {}
}

let carrito = cargarCarrito();

function totalItems() {
  return Object.values(carrito).reduce((acc, it) => acc + it.cantidad, 0);
}

function actualizarBadge() {
  if (!elCartBadge) return;
  const total = totalItems();
  if (total > 0) {
    elCartBadge.textContent = total;
    elCartBadge.classList.remove("hidden");
  } else {
    elCartBadge.classList.add("hidden");
  }
}

function agregarAlCarrito(producto, cantidad) {
  const precioUnitario =
    producto.promo && producto.precioPromo != null
      ? producto.precioPromo
      : producto.precio || 0;

  if (carrito[producto.id]) {
    carrito[producto.id].cantidad += cantidad;
    carrito[producto.id].precioUnitario = precioUnitario;
    carrito[producto.id].nombre = producto.nombre;
    carrito[producto.id].fraccionable = !!producto.fraccionable;
  } else {
    carrito[producto.id] = {
      nombre: producto.nombre,
      precioUnitario,
      cantidad,
      fraccionable: !!producto.fraccionable,
    };
  }

  guardarCarrito();
  actualizarBadge();
}

function cambiarCantidadCarrito(id, nuevaCantidad) {
  if (!carrito[id]) return;
  if (nuevaCantidad <= 0) {
    delete carrito[id];
  } else {
    carrito[id].cantidad = nuevaCantidad;
  }
  guardarCarrito();
  actualizarBadge();
  renderCarrito();
}

function quitarDelCarrito(id) {
  delete carrito[id];
  guardarCarrito();
  actualizarBadge();
  renderCarrito();
}

function vaciarCarrito() {
  carrito = {};
  guardarCarrito();
  actualizarBadge();
  renderCarrito();
}

function totalCarrito() {
  return Object.values(carrito).reduce(
    (acc, it) => acc + it.precioUnitario * it.cantidad,
    0
  );
}

function mensajeWhatsAppCarrito(nombreCliente, formaPago) {
  const items = Object.values(carrito);
  const lineas = items.map(
    (it) =>
      `• ${it.nombre} x${it.cantidad} (${fmt.format(it.precioUnitario)} c/u) = ${fmt.format(
        it.precioUnitario * it.cantidad
      )}`
  );
  const texto =
    `Hola! Soy ${nombreCliente} y quiero hacer este pedido:\n\n` +
    lineas.join("\n") +
    `\n\nTotal: ${fmt.format(totalCarrito())}` +
    `\nForma de pago: ${formaPago}`;
  return `${waBase}?text=${encodeURIComponent(texto)}`;
}

// ----- Vista 1 <-> Vista 2 del drawer -----

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

if (elBtnVolverItems) {
  elBtnVolverItems.addEventListener("click", mostrarVistaItems);
}

// ----- Confirmación del pedido -----
if (elFormDatosCliente) {
  elFormDatosCliente.addEventListener("submit", async (e) => {
    e.preventDefault();
    elDatosClienteError.textContent = "";

    const nombreCliente = document.getElementById("cliente-nombre").value.trim();
    const whatsappCliente = document
      .getElementById("cliente-whatsapp")
      .value.trim()
      .replace(/[^0-9]/g, "");
    const formaPago = document.getElementById("cliente-pago").value;

    if (!nombreCliente || !whatsappCliente || !formaPago) {
      elDatosClienteError.textContent =
        "Completá tu nombre, tu número de WhatsApp y la forma de pago.";
      return;
    }

    const items = Object.entries(carrito).map(([id, it]) => ({
      productoId: id,
      nombre: it.nombre,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      subtotal: it.precioUnitario * it.cantidad,
    }));

    elBtnConfirmarPedido.disabled = true;
    elBtnConfirmarPedido.textContent = "Enviando…";

    try {
      await addDoc(collection(db, "pedidos"), {
        clienteNombre: nombreCliente,
        clienteWhatsapp: whatsappCliente,
        formaPago,
        items,
        total: totalCarrito(),
        creadoEn: serverTimestamp(),
      });

      const link = mensajeWhatsAppCarrito(nombreCliente, formaPago);
      window.open(link, "_blank", "noopener");

      vaciarCarrito();
      elFormDatosCliente.reset();
      elCartBackdrop.classList.add("hidden");
      mostrarVistaItems();
    } catch (err) {
      console.error(err);
      elDatosClienteError.textContent =
        "No se pudo registrar el pedido. Probá de nuevo en unos segundos.";
    } finally {
      elBtnConfirmarPedido.disabled = false;
      elBtnConfirmarPedido.textContent = "Confirmar y enviar por WhatsApp";
    }
  });
}

function renderCarrito() {
  const items = Object.entries(carrito);

  if (items.length === 0) {
    elCartItems.innerHTML = `<p class="state-message">Todavía no agregaste productos. Elegí cantidades en el catálogo y tocá "Agregar".</p>`;
    elCartFooter.innerHTML = "";
    return;
  }

  elCartItems.innerHTML = "";
  for (const [id, it] of items) {
    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    info.className = "cart-item__info";

    const name = document.createElement("p");
    name.className = "cart-item__name";
    name.textContent = it.nombre;
    info.appendChild(name);

    const price = document.createElement("p");
    price.className = "cart-item__price";
    price.textContent = `${fmt.format(it.precioUnitario)} c/u`;
    info.appendChild(price);

    const stepper = crearStepper(it.cantidad, (nuevaCantidad) => {
      cambiarCantidadCarrito(id, nuevaCantidad);
    }, it.fraccionable ? 0.5 : 1);
    info.appendChild(stepper);

    row.appendChild(info);

    const right = document.createElement("div");
    right.className = "cart-item__right";

    const subtotal = document.createElement("span");
    subtotal.className = "cart-item__subtotal";
    subtotal.textContent = fmt.format(it.precioUnitario * it.cantidad);
    right.appendChild(subtotal);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-item__remove";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => quitarDelCarrito(id));
    right.appendChild(remove);

    row.appendChild(right);
    elCartItems.appendChild(row);
  }

  elCartFooter.innerHTML = "";

  const totalRow = document.createElement("div");
  totalRow.className = "cart-total-row";
  totalRow.innerHTML = `<span>Total</span><span>${fmt.format(totalCarrito())}</span>`;
  elCartFooter.appendChild(totalRow);

  const btnEnviar = document.createElement("button");
  btnEnviar.type = "button";
  btnEnviar.className = "btn btn-primary btn-block";
  btnEnviar.textContent = "Continuar pedido";
  btnEnviar.addEventListener("click", mostrarVistaDatos);
  elCartFooter.appendChild(btnEnviar);

  const btnVaciar = document.createElement("button");
  btnVaciar.type = "button";
  btnVaciar.className = "btn btn-secondary btn-block";
  btnVaciar.textContent = "Vaciar pedido";
  btnVaciar.addEventListener("click", vaciarCarrito);
  elCartFooter.appendChild(btnVaciar);
}

// ----- Apertura / cierre del panel -----
if (elCartFloat) {
  elCartFloat.addEventListener("click", () => {
    renderCarrito();
    mostrarVistaItems();
    elCartBackdrop.classList.remove("hidden");
  });
}

if (elCartClose) {
  elCartClose.addEventListener("click", () => {
    elCartBackdrop.classList.add("hidden");
  });
}

if (elCartBackdrop) {
  elCartBackdrop.addEventListener("click", (e) => {
    if (e.target === elCartBackdrop) {
      elCartBackdrop.classList.add("hidden");
    }
  });
}

actualizarBadge();

// ============================================================
// STEPPER DE CANTIDAD (reutilizable)
// ============================================================

function crearStepper(valorInicial, onChange, paso = 1) {
  const wrap = document.createElement("div");
  wrap.className = "qty-stepper";

  const minimo = paso < 1 ? paso : 1;
  let valor = valorInicial;

  const btnMenos = document.createElement("button");
  btnMenos.type = "button";
  btnMenos.textContent = "−";
  btnMenos.setAttribute("aria-label", "Restar");

  const valorEl = document.createElement("span");
  valorEl.className = "qty-stepper__value";
  valorEl.textContent = fmtCantidad(valor);

  const btnMas = document.createElement("button");
  btnMas.type = "button";
  btnMas.textContent = "+";
  btnMas.setAttribute("aria-label", "Sumar");

  btnMenos.addEventListener("click", () => {
    valor = Math.max(minimo, Math.round((valor - paso) * 10) / 10);
    valorEl.textContent = fmtCantidad(valor);
    if (onChange) onChange(valor);
  });

  btnMas.addEventListener("click", () => {
    valor = Math.round((valor + paso) * 10) / 10;
    valorEl.textContent = fmtCantidad(valor);
    if (onChange) onChange(valor);
  });

  wrap.appendChild(btnMenos);
  wrap.appendChild(valorEl);
  wrap.appendChild(btnMas);

  return wrap;
}

// ============================================================
// RENDER DEL CATÁLOGO
// ============================================================

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

let todosLosProductos = [];

function renderNavCategorias(productos) {
  if (!elCatNav) return;
  const categorias = [...new Set(productos.map((p) => p.categoria || "Otros"))];
  const valorSeleccionadoPrevio = elCatNav.value;
  elCatNav.innerHTML = `<option value="">Todas las categorías</option>`;
  for (const cat of categorias) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    elCatNav.appendChild(opt);
  }
  if (valorSeleccionadoPrevio) {
    elCatNav.value = valorSeleccionadoPrevio;
  }
}

function aplicarFiltros() {
  const textoBusqueda = normalizarTexto(elBuscador ? elBuscador.value.trim() : "");
  const categoriaSeleccionada = elCatNav ? elCatNav.value : "";

  let filtrados = todosLosProductos;

  if (categoriaSeleccionada) {
    filtrados = filtrados.filter((p) => (p.categoria || "Otros") === categoriaSeleccionada);
  }

  if (textoBusqueda) {
    filtrados = filtrados.filter((p) =>
      normalizarTexto(p.nombre).includes(textoBusqueda)
    );
  }

  renderCatalogo(filtrados);
}

if (elBuscador) {
  elBuscador.addEventListener("input", aplicarFiltros);
}

if (elCatNav) {
  elCatNav.addEventListener("change", aplicarFiltros);
}

function renderCatalogo(productos) {
  if (!elCatalogo) return;

  if (!productos || productos.length === 0) {
    if (todosLosProductos.length === 0) {
      elCatalogo.innerHTML = `<p class="state-message">Por el momento no hay productos cargados. Volvé a revisar más tarde.</p>`;
      if (elCatNav) elCatNav.innerHTML = `<option value="">Todas las categorías</option>`;
    } else {
      elCatalogo.innerHTML = `
        <div class="no-results">
          <p class="no-results__title">No encontramos productos</p>
          <p>Probá con otra palabra o revisá la categoría elegida.</p>
        </div>`;
    }
    return;
  }

  const categorias = new Map();
  for (const p of productos) {
    const cat = p.categoria || "Otros";
    if (!categorias.has(cat)) categorias.set(cat, []);
    categorias.get(cat).push(p);
  }

  elCatalogo.innerHTML = "";
  for (const [cat, items] of categorias.entries()) {
    const section = document.createElement("section");
    section.className = "category-section";
    section.id = `cat-${slugify(cat)}`;

    const title = document.createElement("h2");
    title.className = "category-section__title";
    title.textContent = cat;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "product-grid";

    for (const p of items) {
      grid.appendChild(renderCard(p));
    }

    section.appendChild(grid);
    elCatalogo.appendChild(section);
  }
}

// Render de una card de producto. Si p.fraccionable, permite pedir en pasos de 0.5
function renderCard(p) {
  const precioMostrar =
    p.promo && p.precioPromo != null ? p.precioPromo : p.precio || 0;

  const card = document.createElement("article");
  card.className = "product-card";
  if (p.enStock === false) card.classList.add("product-card--soldout");

  // Imagen
  const imgWrap = document.createElement("div");
  imgWrap.className = "product-card__img-wrap";
  if (p.imagenUrl) {
    const img = document.createElement("img");
    img.src = p.imagenUrl;
    img.alt = p.nombre;
    img.loading = "lazy";
    imgWrap.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "product-card__img-placeholder";
    const phText = document.createElement("span");
    phText.textContent = p.nombre;
    ph.appendChild(phText);
    imgWrap.appendChild(ph);
  }

  if (p.promo && p.enStock !== false) {
    const stamp = document.createElement("span");
    stamp.className = "promo-stamp";
    stamp.textContent = "Oferta";
    imgWrap.appendChild(stamp);
  }
  card.appendChild(imgWrap);

  // Cuerpo
  const body = document.createElement("div");
  body.className = "product-card__body";

  const metaWrap = document.createElement("div");
  metaWrap.className = "product-card__meta";

  const name = document.createElement("h3");
  name.className = "product-card__name";
  name.textContent = p.nombre;
  metaWrap.appendChild(name);

  const priceRow = document.createElement("div");
  priceRow.className = "product-card__price-row";

  if (p.promo && p.precioPromo != null && p.enStock !== false) {
    const oldPrice = document.createElement("span");
    oldPrice.className = "product-card__price--old";
    oldPrice.textContent = fmt.format(p.precio);
    priceRow.appendChild(oldPrice);
  }

  const priceEl = document.createElement("span");
  priceEl.className = "product-card__price";
  priceEl.textContent = fmt.format(precioMostrar);
  priceRow.appendChild(priceEl);

  metaWrap.appendChild(priceRow);
  body.appendChild(metaWrap);

  if (p.promo && p.promoTexto && p.enStock !== false) {
    const promoText = document.createElement("p");
    promoText.className = "product-card__promo-text";
    promoText.textContent = p.promoTexto;
    metaWrap.appendChild(promoText);
  }

  if (p.fraccionable && p.enStock !== false) {
    const aviso = document.createElement("p");
    aviso.className = "product-card__fraccionable-text";
    aviso.textContent = "Se puede pedir por mitad (ej: 2 y media)";
    metaWrap.appendChild(aviso);
  }

  if (p.enStock === false) {
    const badge = document.createElement("span");
    badge.className = "product-card__stock-badge";
    badge.textContent = "Sin stock";
    body.appendChild(badge);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-order btn-order--disabled";
    btn.textContent = "No disponible";
    btn.disabled = true;
    body.appendChild(btn);
  } else {
    const controls = document.createElement("div");
    controls.className = "product-card__controls";

    const paso = p.fraccionable ? 0.5 : 1;
    const stepper = crearStepper(1, null, paso);
    controls.appendChild(stepper);

    const btnAgregar = document.createElement("button");
    btnAgregar.type = "button";
    btnAgregar.className = "btn-add";
    btnAgregar.textContent = "Agregar";
    btnAgregar.addEventListener("click", () => {
      const textoValor = stepper
        .querySelector(".qty-stepper__value")
        .textContent.replace(",", ".");
      const cantidad = parseFloat(textoValor);
      agregarAlCarrito(p, cantidad);

      const original = btnAgregar.textContent;
      btnAgregar.textContent = "✓ Agregado";
      btnAgregar.classList.add("btn-add--ok");
      setTimeout(() => {
        btnAgregar.textContent = original;
        btnAgregar.classList.remove("btn-add--ok");
      }, 900);
    });
    controls.appendChild(btnAgregar);

    body.appendChild(controls);
  }

  card.appendChild(body);
  return card;
}

// ----- Suscripción en tiempo real -----
const productosQuery = query(
  collection(db, "productos"),
  orderBy("categoria"),
  orderBy("orden")
);

onSnapshot(
  productosQuery,
  (snapshot) => {
    todosLosProductos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (elEstado) elEstado.classList.add("hidden");
    renderNavCategorias(todosLosProductos);
    aplicarFiltros();
  },
  (error) => {
    console.error(error);
    if (elEstado) {
      elEstado.textContent =
        "No se pudo cargar el catálogo. Revisá la configuración de Firebase (firebase-config.js).";
      elEstado.classList.remove("hidden");
    }
  }
);

function ajustarStickyNav() {
  const searchBar = document.querySelector(".search-bar");
  if (searchBar) {
    document.documentElement.style.setProperty(
      "--search-bar-height",
      `${searchBar.offsetHeight}px`
    );
  }
}

window.addEventListener("resize", ajustarStickyNav);
window.addEventListener("load", ajustarStickyNav);
ajustarStickyNav();
