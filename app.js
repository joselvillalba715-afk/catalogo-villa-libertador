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

// ----- Links de WhatsApp -----
const waBase = `https://wa.me/${WHATSAPP_NUMBER}`;

function waLinkGeneral() {
  const texto = `Hola! Quiero hacer un pedido del catálogo de ${BUSINESS_NAME}.`;
  return `${waBase}?text=${encodeURIComponent(texto)}`;
}

function waLinkProducto(nombre) {
  const texto = `Hola! Quiero pedir: ${nombre}`;
  return `${waBase}?text=${encodeURIComponent(texto)}`;
}

document.getElementById("wa-float").href = waLinkGeneral();
document.getElementById("wa-footer-link").href = waLinkGeneral();
elUltimaActualizacion.textContent = "Stock y precios actualizados en el momento";

// ----- Formato de precio -----
const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

// ----- Render -----
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
  }

  const btn = document.createElement("a");
  btn.className = "btn-order";
  if (p.enStock === false) {
    btn.classList.add("btn-order--disabled");
    btn.textContent = "No disponible";
    btn.href = "#";
  } else {
    btn.href = waLinkProducto(p.nombre);
    btn.target = "_blank";
    btn.rel = "noopener";
    btn.textContent = "Pedir por WhatsApp";
  }
  body.appendChild(btn);

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
