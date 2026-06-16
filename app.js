import { firebaseConfig, WHATSAPP_NUMBER, BUSINESS_NAME } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const elEstado = document.getElementById("estado");
const elCatalogo = document.getElementById("catalogo");
const elCatNav = document.getElementById("cat-nav-scroll");
const elUltimaActualizacion = document.getElementById("ultima-actualizacion");

const elCartFloat = document.getElementById("cart-float");
const elCartBadge = document.getElementById("cart-badge");
const elCartBackdrop = document.getElementById("cart-backdrop");
const elCartClose = document.getElementById("cart-close");
const elCartItems = document.getElementById("cart-items");
const elCartFooter = document.getElementById("cart-footer");

// ----- Links de WhatsApp -----
const waBase = `https://wa.me/${WHATSAPP_NUMBER}`;

function waLinkGeneral() {
  const texto = `Hola! Quiero hacer una consulta sobre el catálogo de ${BUSINESS_NAME}.`;
  return `${waBase}?text=${encodeURIComponent(texto)}`;
}

document.getElementById("wa-footer-link").href = waLinkGeneral();
elUltimaActualizacion.textContent = "Stock y precios actualizados en el momento";

// ----- Formato de precio -----
const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

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
  } catch {
    // si localStorage no está disponible, el carrito sigue funcionando
    // solo durante esta visita
  }
}

let carrito = cargarCarrito();

function totalItems() {
  return Object.values(carrito).reduce((acc, it) => acc + it.cantidad, 0);
}

function actualizarBadge() {
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
  } else {
    carrito[producto.id] = {
      nombre: producto.nombre,
      precioUnitario,
      cantidad,
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

function mensajeWhatsAppCarrito() {
  const items = Object.values(carrito);
  const lineas = items.map(
    (it) =>
      `• ${it.nombre} x${it.cantidad} (${fmt.format(it.precioUnitario)} c/u) = ${fmt.format(
        it.precioUnitario * it.cantidad
      )}`
  );
  const texto =
    `Hola! Quiero hacer este pedido:\n\n` +
    lineas.join("\n") +
    `\n\nTotal: ${fmt.format(totalCarrito())}`;
  return `${waBase}?text=${encodeURIComponent(texto)}`;
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
    });
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

  const btnEnviar = document.createElement("a");
  btnEnviar.className = "btn btn-primary btn-block";
  btnEnviar.textContent = "Enviar pedido por WhatsApp";
  btnEnviar.href = mensajeWhatsAppCarrito();
  btnEnviar.target = "_blank";
  btnEnviar.rel = "noopener";
  elCartFooter.appendChild(btnEnviar);

  const btnVaciar = document.createElement("button");
  btnVaciar.type = "button";
  btnVaciar.className = "btn btn-secondary btn-block";
  btnVaciar.textContent = "Vaciar pedido";
  btnVaciar.addEventListener("click", vaciarCarrito);
  elCartFooter.appendChild(btnVaciar);
}

// ----- Apertura / cierre del panel -----
elCartFloat.addEventListener("click", () => {
  renderCarrito();
  elCartBackdrop.classList.remove("hidden");
});

elCartClose.addEventListener("click", () => {
  elCartBackdrop.classList.add("hidden");
});

elCartBackdrop.addEventListener("click", (e) => {
  if (e.target === elCartBackdrop) {
    elCartBackdrop.classList.add("hidden");
  }
});

actualizarBadge();

// ============================================================
// STEPPER DE CANTIDAD (reutilizable)
// ============================================================

function crearStepper(valorInicial, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "qty-stepper";

  let valor = valorInicial;

  const btnMenos = document.createElement("button");
  btnMenos.type = "button";
  btnMenos.textContent = "−";
  btnMenos.setAttribute("aria-label", "Restar");

  const valorEl = document.createElement("span");
  valorEl.className = "qty-stepper__value";
  valorEl.textContent = valor;

  const btnMas = document.createElement("button");
  btnMas.type = "button";
  btnMas.textContent = "+";
  btnMas.setAttribute("aria-label", "Sumar");

  btnMenos.addEventListener("click", () => {
    valor = Math.max(1, valor - 1);
    valorEl.textContent = valor;
    if (onChange) onChange(valor);
  });

  btnMas.addEventListener("click", () => {
    valor = valor + 1;
    valorEl.textContent = valor;
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

function renderCatalogo(productos) {
  if (productos.length === 0) {
    elCatalogo.innerHTML = `<p class="state-message">Por el momento no hay productos cargados. Volvé a revisar más tarde.</p>`;
    elCatNav.innerHTML = "";
    return;
  }

  // Agrupar por categoría, conservando el orden de aparición
  const categorias = new Map();
  for (const p of productos) {
    const cat = p.categoria || "Otros";
    if (!categorias.has(cat)) categorias.set(cat, []);
    categorias.get(cat).push(p);
  }

  // Nav de categorías
  elCatNav.innerHTML = "";
  for (const cat of categorias.keys()) {
    const a = document.createElement("a");
    a.href = `#cat-${slugify(cat)}`;
    a.className = "cat-chip";
    a.textContent = cat;
    elCatNav.appendChild(a);
  }

  // Secciones
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

function renderCard(p) {
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
    ph.textContent = p.nombre;
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

  const name = document.createElement("h3");
  name.className = "product-card__name";
  name.textContent = p.nombre;
  body.appendChild(name);

  const priceRow = document.createElement("div");
  priceRow.className = "product-card__price-row";

  if (p.promo && p.precioPromo != null && p.enStock !== false) {
    const oldPrice = document.createElement("span");
    oldPrice.className = "product-card__price--old";
    oldPrice.textContent = fmt.format(p.precio);
    priceRow.appendChild(oldPrice);

    const newPrice = document.createElement("span");
    newPrice.className = "product-card__price";
    newPrice.textContent = fmt.format(p.precioPromo);
    priceRow.appendChild(newPrice);
  } else {
    const price = document.createElement("span");
    price.className = "product-card__price";
    price.textContent = fmt.format(p.precio || 0);
    priceRow.appendChild(price);
  }
  body.appendChild(priceRow);

  if (p.promo && p.promoTexto && p.enStock !== false) {
    const promoText = document.createElement("p");
    promoText.className = "product-card__promo-text";
    promoText.textContent = p.promoTexto;
    body.appendChild(promoText);
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

    const stepper = crearStepper(1, null);
    controls.appendChild(stepper);

    const btnAgregar = document.createElement("button");
    btnAgregar.type = "button";
    btnAgregar.className = "btn-add";
    btnAgregar.textContent = "Agregar";
    btnAgregar.addEventListener("click", () => {
      const cantidad = parseInt(
        stepper.querySelector(".qty-stepper__value").textContent,
        10
      );
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
    const productos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    elEstado.classList.add("hidden");
    renderCatalogo(productos);
  },
  (error) => {
    console.error(error);
    elEstado.textContent =
      "No se pudo cargar el catálogo. Revisá la configuración de Firebase (firebase-config.js).";
    elEstado.classList.remove("hidden");
  }
);
