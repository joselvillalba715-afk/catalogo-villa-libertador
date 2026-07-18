import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---------- Elementos ----------
const loginCard = document.getElementById("login-card");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const adminShell = document.getElementById("admin-shell");
const btnLogout = document.getElementById("btn-logout");

const resetCard = document.getElementById("reset-card");
const resetForm = document.getElementById("reset-form");
const resetError = document.getElementById("reset-error");
const resetSuccess = document.getElementById("reset-success");
const linkOlvidePassword = document.getElementById("link-olvide-password");
const linkVolverLogin = document.getElementById("link-volver-login");

const registroCard = document.getElementById("registro-card");
const registroForm = document.getElementById("registro-form");
const registroError = document.getElementById("registro-error");
const linkCrearCuenta = document.getElementById("link-crear-cuenta");
const linkVolverLoginRegistro = document.getElementById("link-volver-login-registro");

const formNuevo = document.getElementById("form-nuevo");
const nuevoError = document.getElementById("nuevo-error");
const nPromoCheckbox = document.getElementById("n-promo");
const nPromoFields = document.getElementById("n-promo-fields");

const listaProductos = document.getElementById("lista-productos");
const listaVacia = document.getElementById("lista-vacia");
const elAdminBuscador = document.getElementById("admin-buscador");

const modalEditar = document.getElementById("modal-editar");
const formEditar = document.getElementById("form-editar");
const editarError = document.getElementById("editar-error");
const ePromoCheckbox = document.getElementById("e-promo");
const ePromoFields = document.getElementById("e-promo-fields");
const btnCancelarEditar = document.getElementById("btn-cancelar-editar");

// ---------- Autenticación ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "No se pudo ingresar. Revisá el email y la contraseña.";
    console.error(err);
  }
});

btnLogout.addEventListener("click", () => signOut(auth));

// ---------- Recuperar contraseña ----------
linkOlvidePassword.addEventListener("click", (e) => {
  e.preventDefault();
  resetError.textContent = "";
  resetSuccess.textContent = "";
  resetForm.reset();
  loginCard.classList.add("hidden");
  resetCard.classList.remove("hidden");
});

linkVolverLogin.addEventListener("click", (e) => {
  e.preventDefault();
  resetCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  resetError.textContent = "";
  resetSuccess.textContent = "";
  const email = document.getElementById("reset-email").value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    resetSuccess.textContent =
      "Listo. Revisá tu casilla de email (también la carpeta de spam) y seguí el link para crear una nueva contraseña.";
  } catch (err) {
    console.error(err);
    resetError.textContent =
      "No se pudo enviar el email. Revisá que el email sea el correcto.";
  }
});

// ---------- Crear cuenta ----------
linkCrearCuenta.addEventListener("click", (e) => {
  e.preventDefault();
  registroError.textContent = "";
  registroForm.reset();
  loginCard.classList.add("hidden");
  registroCard.classList.remove("hidden");
});

linkVolverLoginRegistro.addEventListener("click", (e) => {
  e.preventDefault();
  registroCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
});

registroForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registroError.textContent = "";
  const email = document.getElementById("registro-email").value.trim().toLowerCase();
  const password = document.getElementById("registro-password").value;
  try {
    const refAutorizado = doc(db, "emailsAutorizados", email);
    const snapAutorizado = await getDoc(refAutorizado);
    if (!snapAutorizado.exists()) {
      registroError.textContent =
        "Este email no está autorizado para crear una cuenta. Pedile al administrador que lo agregue.";
      return;
    }
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") {
      registroError.textContent = "Ya existe una cuenta con ese email. Iniciá sesión normalmente.";
    } else if (err.code === "auth/weak-password") {
      registroError.textContent = "La contraseña debe tener al menos 6 caracteres.";
    } else {
      registroError.textContent = "No se pudo crear la cuenta. Probá de nuevo.";
    }
  }
});

// ---------- Pestañas ----------
const adminTabs = document.querySelectorAll(".admin-tab");
const tabCatalogo = document.getElementById("tab-catalogo");
const tabPedidos = document.getElementById("tab-pedidos");
const tabCupones = document.getElementById("tab-cupones");

const tabsPorNombre = { catalogo: tabCatalogo, pedidos: tabPedidos, cupones: tabCupones };

adminTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    adminTabs.forEach((b) => b.classList.remove("admin-tab--active"));
    btn.classList.add("admin-tab--active");
    Object.entries(tabsPorNombre).forEach(([nombre, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", nombre !== btn.dataset.tab);
    });
  });
});

nPromoCheckbox.addEventListener("change", () => {
  nPromoFields.classList.toggle("hidden", !nPromoCheckbox.checked);
});
ePromoCheckbox.addEventListener("change", () => {
  ePromoFields.classList.toggle("hidden", !ePromoCheckbox.checked);
});

// ---------- Formato auxiliar ----------
const fmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

// ---------- Subida de imágenes ----------
async function subirImagen(file, productoId) {
  const extension = file.name.split(".").pop();
  const path = `productos/${productoId}.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ---------- Alta de producto ----------
formNuevo.addEventListener("submit", async (e) => {
  e.preventDefault();
  nuevoError.textContent = "";
  const nombre = document.getElementById("n-nombre").value.trim();
  const codigo = document.getElementById("n-codigo").value.trim();
  const categoria = document.getElementById("n-categoria").value.trim();
  const precio = parseFloat(document.getElementById("n-precio").value);
  const orden = parseInt(document.getElementById("n-orden").value, 10) || 0;
  const enStock = document.getElementById("n-stock").checked;
  const promo = document.getElementById("n-promo").checked;
  const fraccionable = document.getElementById("n-fraccionable")?.checked || false;
  const destacado = document.getElementById("n-destacado")?.checked || false;
  const minimoCompraRaw = document.getElementById("n-minimo-compra").value;
  const minimoCompra = minimoCompraRaw !== "" ? parseFloat(minimoCompraRaw) : null;
  const preciosVolumen = leerEscalonesVolumen("n-volumen-filas");
  const precioPromo = document.getElementById("n-precio-promo").value
    ? parseFloat(document.getElementById("n-precio-promo").value)
    : null;
  const promoTexto = document.getElementById("n-promo-texto").value.trim();
  const archivo = document.getElementById("n-imagen").files[0];
  try {
    const docRef = await addDoc(collection(db, "productos"), {
      nombre, codigo, categoria, precio, orden, enStock, promo, fraccionable, destacado, minimoCompra,
      preciosVolumen,
      precioPromo: promo ? precioPromo : null,
      promoTexto: promo ? promoTexto : "",
      imagenUrl: "",
    });
    if (archivo) {
      const url = await subirImagen(archivo, docRef.id);
      await updateDoc(doc(db, "productos", docRef.id), { imagenUrl: url });
    }
    formNuevo.reset();
    nPromoFields.classList.add("hidden");
    limpiarEscalonesVolumen("n-volumen-filas");
  } catch (err) {
    console.error(err);
    nuevoError.textContent = "No se pudo agregar el producto. Probá de nuevo.";
  }
});

// ---------- Cache y buscador ----------
let productosCache = [];
let pedidosCache = [];

function normalizarTexto(texto) {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function actualizarListaCategorias() {
  const datalist = document.getElementById("lista-categorias");
  if (!datalist) return;
  const categorias = [...new Set(productosCache.map((p) => p.categoria).filter(Boolean))];
  categorias.sort((a, b) => a.localeCompare(b, "es"));
  datalist.innerHTML = "";
  for (const cat of categorias) {
    const option = document.createElement("option");
    option.value = cat;
    datalist.appendChild(option);
  }
  actualizarDatalistCategoriasCupon();
}

function aplicarFiltroAdmin() {
  const textoBusqueda = elAdminBuscador ? normalizarTexto(elAdminBuscador.value.trim()) : "";
  const soloSinStock = document.getElementById("filtro-sin-stock")?.checked || false;
  let filtrados = productosCache;
  if (soloSinStock) {
    filtrados = filtrados.filter((p) => p.enStock === false);
  }
  if (textoBusqueda) {
    filtrados = filtrados.filter((p) =>
      normalizarTexto(p.nombre).includes(textoBusqueda) ||
      normalizarTexto(p.codigo).includes(textoBusqueda) ||
      normalizarTexto(p.categoria).includes(textoBusqueda)
    );
  }
  renderLista(filtrados);
}

if (elAdminBuscador) {
  elAdminBuscador.addEventListener("input", aplicarFiltroAdmin);
}

const filtroSinStock = document.getElementById("filtro-sin-stock");
if (filtroSinStock) {
  filtroSinStock.addEventListener("change", aplicarFiltroAdmin);
}

function renderLista(productosARenderizar = productosCache) {
  listaProductos.innerHTML = "";
  listaVacia.classList.toggle("hidden", productosARenderizar.length > 0);

  for (const p of productosARenderizar) {
    const row = document.createElement("div");
    row.className = "admin-product-row";

    const thumb = document.createElement("div");
    thumb.className = "admin-product-row__thumb";
    if (p.imagenUrl) {
      const img = document.createElement("img");
      img.src = p.imagenUrl;
      img.alt = p.nombre;
      thumb.appendChild(img);
    } else {
      thumb.textContent = "Sin foto";
    }
    row.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "admin-product-row__info";

    const name = document.createElement("p");
    name.className = "admin-product-row__name";
    name.textContent = p.codigo ? `[${p.codigo}] ${p.nombre}` : p.nombre;
    info.appendChild(name);

    const meta = document.createElement("p");
    meta.className = "admin-product-row__meta";
    let precioTexto = fmt.format(p.precio || 0);
    if (p.promo && p.precioPromo != null) precioTexto += ` → ${fmt.format(p.precioPromo)}`;
    meta.textContent = `${p.categoria} · ${precioTexto}`;
    info.appendChild(meta);

    const tags = document.createElement("p");
    if (p.destacado) {
      const t = document.createElement("span");
      t.className = "tag tag--destacado";
      t.textContent = "⭐ Destacado";
      tags.appendChild(t);
    }
    if (p.fraccionable) {
      const t = document.createElement("span");
      t.className = "tag tag--promo";
      t.textContent = "½ Media";
      tags.appendChild(t);
    }
    if (p.promo) {
      const t = document.createElement("span");
      t.className = "tag tag--promo";
      t.textContent = "Promo";
      tags.appendChild(t);
    }
    if (p.enStock === false) {
      const t = document.createElement("span");
      t.className = "tag tag--soldout";
      t.textContent = "Sin stock";
      tags.appendChild(t);
    }
    if (tags.children.length > 0) info.appendChild(tags);
    row.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "admin-product-row__actions";

    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "icon-btn";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => abrirModalEditar(p));
    actions.appendChild(btnEditar);

    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "icon-btn";
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", () => eliminarProducto(p));
    actions.appendChild(btnEliminar);

    row.appendChild(actions);
    listaProductos.appendChild(row);
  }
}

// ---------- Edición ----------
let productoEnEdicion = null;

function abrirModalEditar(p) {
  productoEnEdicion = p;
  editarError.textContent = "";
  document.getElementById("e-id").value = p.id;
  document.getElementById("e-nombre").value = p.nombre || "";
  document.getElementById("e-codigo").value = p.codigo || "";
  document.getElementById("e-categoria").value = p.categoria || "";
  document.getElementById("e-precio").value = p.precio || 0;
  document.getElementById("e-orden").value = p.orden || 0;
  document.getElementById("e-stock").checked = p.enStock !== false;
  document.getElementById("e-promo").checked = !!p.promo;
  document.getElementById("e-precio-promo").value = p.precioPromo ?? "";
  document.getElementById("e-promo-texto").value = p.promoTexto || "";
  document.getElementById("e-imagen").value = "";
  const eFraccionable = document.getElementById("e-fraccionable");
  if (eFraccionable) eFraccionable.checked = !!p.fraccionable;
  const eDestacado = document.getElementById("e-destacado");
  if (eDestacado) eDestacado.checked = !!p.destacado;
  const eMinimoCompra = document.getElementById("e-minimo-compra");
  if (eMinimoCompra) eMinimoCompra.value = p.minimoCompra != null ? p.minimoCompra : "";
  cargarEscalonesVolumen("e-volumen-filas", p.preciosVolumen || []);
  ePromoFields.classList.toggle("hidden", !p.promo);
  modalEditar.classList.remove("hidden");
}

btnCancelarEditar.addEventListener("click", () => {
  modalEditar.classList.add("hidden");
  productoEnEdicion = null;
});

formEditar.addEventListener("submit", async (e) => {
  e.preventDefault();
  editarError.textContent = "";
  const id = document.getElementById("e-id").value;
  const promo = document.getElementById("e-promo").checked;
  const fraccionable = document.getElementById("e-fraccionable")?.checked || false;
  const destacado = document.getElementById("e-destacado")?.checked || false;
  const minimoCompraRawE = document.getElementById("e-minimo-compra").value;
  const minimoCompra = minimoCompraRawE !== "" ? parseFloat(minimoCompraRawE) : null;
  const preciosVolumen = leerEscalonesVolumen("e-volumen-filas");
  const datos = {
    nombre: document.getElementById("e-nombre").value.trim(),
    codigo: document.getElementById("e-codigo").value.trim(),
    categoria: document.getElementById("e-categoria").value.trim(),
    precio: parseFloat(document.getElementById("e-precio").value),
    orden: parseInt(document.getElementById("e-orden").value, 10) || 0,
    enStock: document.getElementById("e-stock").checked,
    promo, fraccionable, destacado, minimoCompra, preciosVolumen,
    precioPromo: promo ? parseFloat(document.getElementById("e-precio-promo").value) || null : null,
    promoTexto: promo ? document.getElementById("e-promo-texto").value.trim() : "",
  };
  try {
    const archivo = document.getElementById("e-imagen").files[0];
    if (archivo) datos.imagenUrl = await subirImagen(archivo, id);
    await updateDoc(doc(db, "productos", id), datos);
    modalEditar.classList.add("hidden");
    productoEnEdicion = null;
  } catch (err) {
    console.error(err);
    editarError.textContent = "No se pudieron guardar los cambios. Probá de nuevo.";
  }
});

// ---------- Eliminar ----------
async function eliminarProducto(p) {
  const ok = confirm(`¿Eliminar "${p.nombre}" del catálogo?`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "productos", p.id));
    if (p.imagenUrl) {
      const extension = p.imagenUrl.split("?")[0].split(".").pop();
      try { await deleteObject(ref(storage, `productos/${p.id}.${extension}`)); } catch (err) {}
    }
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar el producto.");
  }
}

// ============================================================
// PEDIDOS
// ============================================================
const listaPedidos = document.getElementById("lista-pedidos");
const pedidosVacio = document.getElementById("pedidos-vacio");
const pedidosSinResultados = document.getElementById("pedidos-sin-resultados");
const btnExportarPedidos = document.getElementById("btn-exportar-pedidos");
const filtroDesde = document.getElementById("filtro-desde");
const filtroHasta = document.getElementById("filtro-hasta");
const filtroCliente = document.getElementById("filtro-cliente");
const btnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");

function obtenerPedidosFiltrados() {
  const desde = filtroDesde.value ? new Date(filtroDesde.value + "T00:00:00") : null;
  const hasta = filtroHasta.value ? new Date(filtroHasta.value + "T23:59:59") : null;
  const textoCliente = normalizarTexto(filtroCliente.value.trim());
  return pedidosCache.filter((pedido) => {
    const fecha = pedido.creadoEn?.toDate ? pedido.creadoEn.toDate() : null;
    if (desde && (!fecha || fecha < desde)) return false;
    if (hasta && (!fecha || fecha > hasta)) return false;
    if (textoCliente) {
      if (!normalizarTexto(pedido.clienteNombre).includes(textoCliente)) return false;
    }
    return true;
  });
}

[filtroDesde, filtroHasta, filtroCliente].forEach((el) => {
  if (el) el.addEventListener("input", () => { paginaActualPedidos = 1; renderPedidos(); });
});

if (btnLimpiarFiltros) {
  btnLimpiarFiltros.addEventListener("click", () => {
    filtroDesde.value = "";
    filtroHasta.value = "";
    filtroCliente.value = "";
    paginaActualPedidos = 1;
    renderPedidos();
  });
}

function slugifyPago(formaPago) {
  return formaPago.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}

function formatearFechaHora(timestamp) {
  if (!timestamp || !timestamp.toDate) return "—";
  const fecha = timestamp.toDate();
  return `${fecha.toLocaleDateString("es-AR")} · ${fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

const PEDIDOS_POR_PAGINA = 10;
let paginaActualPedidos = 1;

function renderPedidos() {
  if (!listaPedidos) return;
  const pedidosFiltrados = obtenerPedidosFiltrados();
  listaPedidos.innerHTML = "";
  if (pedidosVacio) pedidosVacio.classList.toggle("hidden", pedidosCache.length > 0);
  const hayFiltrosActivos = filtroDesde.value || filtroHasta.value || (filtroCliente && filtroCliente.value.trim());
  if (pedidosSinResultados) {
    pedidosSinResultados.classList.toggle("hidden", !(pedidosCache.length > 0 && hayFiltrosActivos && pedidosFiltrados.length === 0));
  }

  const totalPaginas = Math.ceil(pedidosFiltrados.length / PEDIDOS_POR_PAGINA);
  if (paginaActualPedidos > totalPaginas) paginaActualPedidos = Math.max(1, totalPaginas);
  const inicio = (paginaActualPedidos - 1) * PEDIDOS_POR_PAGINA;
  const pedidosPagina = pedidosFiltrados.slice(inicio, inicio + PEDIDOS_POR_PAGINA);

  for (const pedido of pedidosPagina) {
    const card = document.createElement("div");
    card.className = "order-card";
    if (pedido.procesado) card.classList.add("order-card--procesado");

    const header = document.createElement("button");
    header.type = "button";
    header.className = "order-card__header";
    const headerInfo = document.createElement("div");
    headerInfo.className = "order-card__header-info";
    const fechaHora = document.createElement("span");
    fechaHora.className = "order-card__datetime";
    fechaHora.textContent = formatearFechaHora(pedido.creadoEn);
    headerInfo.appendChild(fechaHora);
    const cliente = document.createElement("span");
    cliente.className = "order-card__client";
    cliente.textContent = `${pedido.clienteNombre || "Sin nombre"} · ${pedido.clienteWhatsapp || "Sin número"}`;
    headerInfo.appendChild(cliente);
    header.appendChild(headerInfo);

    if (pedido.procesado) {
      const tagProcesado = document.createElement("span");
      tagProcesado.className = "tag tag--procesado";
      tagProcesado.textContent = "✓ Procesado";
      header.appendChild(tagProcesado);
    }

    if (pedido.formaPago) {
      const pago = document.createElement("span");
      pago.className = `tag tag--pago tag--pago-${slugifyPago(pedido.formaPago)}`;
      pago.textContent = pedido.formaPago;
      header.appendChild(pago);
    }
    const total = document.createElement("span");
    total.className = "order-card__total";
    total.textContent = fmt.format(pedido.total || 0);
    header.appendChild(total);
    const chevron = document.createElement("span");
    chevron.className = "order-card__chevron";
    chevron.textContent = "▾";
    header.appendChild(chevron);

    const detail = document.createElement("div");
    detail.className = "order-card__detail hidden";

    if (pedido.formaPago) {
      const pagoDetalle = document.createElement("p");
      pagoDetalle.className = "helper-text";
      pagoDetalle.style.marginBottom = "10px";
      pagoDetalle.innerHTML = `<strong>Forma de pago:</strong> ${pedido.formaPago}`;
      detail.appendChild(pagoDetalle);
    }
    if (pedido.cuponCodigo && pedido.descuento > 0) {
      const cuponDetalle = document.createElement("p");
      cuponDetalle.className = "helper-text";
      cuponDetalle.style.marginBottom = "10px";
      cuponDetalle.innerHTML = `<strong>Cupón aplicado:</strong> ${pedido.cuponCodigo} (−${fmt.format(pedido.descuento)})`;
      detail.appendChild(cuponDetalle);
    }
    if (pedido.observaciones) {
      const obsDetalle = document.createElement("p");
      obsDetalle.className = "helper-text";
      obsDetalle.style.marginBottom = "10px";
      obsDetalle.innerHTML = `<strong>Observaciones:</strong> ${pedido.observaciones}`;
      detail.appendChild(obsDetalle);
    }

    const tabla = document.createElement("table");
    tabla.className = "order-detail-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>";
    tabla.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const item of pedido.items || []) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.nombre}</td><td>${item.cantidad}</td><td>${fmt.format(item.precioUnitario)}</td><td>${fmt.format(item.subtotal)}</td>`;
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);
    detail.appendChild(tabla);

    // Botones de acción
    const acciones = document.createElement("div");
    acciones.style.cssText = "display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;";

    const waLink = document.createElement("a");
    waLink.className = "btn btn-secondary";
    waLink.textContent = "Abrir WhatsApp";
    waLink.href = `https://wa.me/${pedido.clienteWhatsapp}`;
    waLink.target = "_blank";
    waLink.rel = "noopener";
    acciones.appendChild(waLink);

    const btnProcesado = document.createElement("button");
    btnProcesado.type = "button";
    btnProcesado.className = pedido.procesado ? "btn btn-secondary" : "btn btn-primary";
    btnProcesado.textContent = pedido.procesado ? "Marcar como pendiente" : "✓ Marcar como procesado";
    btnProcesado.addEventListener("click", async () => {
      try {
        await updateDoc(doc(db, "pedidos", pedido.id), { procesado: !pedido.procesado });
      } catch (err) { console.error(err); alert("No se pudo actualizar el pedido."); }
    });
    acciones.appendChild(btnProcesado);

    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "btn btn-danger";
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", async () => {
      const nombre = pedido.clienteNombre || "Sin nombre";
      if (!confirm(`¿Eliminar el pedido de "${nombre}"? Esta acción no se puede deshacer.`)) return;
      try {
        await deleteDoc(doc(db, "pedidos", pedido.id));
      } catch (err) { console.error(err); alert("No se pudo eliminar el pedido."); }
    });
    acciones.appendChild(btnEliminar);

    detail.appendChild(acciones);

    header.addEventListener("click", () => {
      detail.classList.toggle("hidden");
      chevron.textContent = detail.classList.contains("hidden") ? "▾" : "▴";
    });
    card.appendChild(header);
    card.appendChild(detail);
    listaPedidos.appendChild(card);
  }

  // Paginación
  if (totalPaginas > 1) {
    const paginador = document.createElement("div");
    paginador.className = "order-paginador";

    const btnAnterior = document.createElement("button");
    btnAnterior.type = "button";
    btnAnterior.className = "btn btn-secondary";
    btnAnterior.textContent = "← Anterior";
    btnAnterior.disabled = paginaActualPedidos === 1;
    btnAnterior.addEventListener("click", () => { paginaActualPedidos--; renderPedidos(); });

    const infoPagina = document.createElement("span");
    infoPagina.className = "order-paginador__info";
    infoPagina.textContent = `Página ${paginaActualPedidos} de ${totalPaginas} (${pedidosFiltrados.length} pedidos)`;

    const btnSiguiente = document.createElement("button");
    btnSiguiente.type = "button";
    btnSiguiente.className = "btn btn-secondary";
    btnSiguiente.textContent = "Siguiente →";
    btnSiguiente.disabled = paginaActualPedidos === totalPaginas;
    btnSiguiente.addEventListener("click", () => { paginaActualPedidos++; renderPedidos(); });

    paginador.appendChild(btnAnterior);
    paginador.appendChild(infoPagina);
    paginador.appendChild(btnSiguiente);
    listaPedidos.appendChild(paginador);
  }
}

function escaparCSV(valor) {
  const texto = String(valor ?? "");
  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

if (btnExportarPedidos) {
  btnExportarPedidos.addEventListener("click", () => {
    const pedidosAExportar = obtenerPedidosFiltrados();
    if (pedidosAExportar.length === 0) { alert("No hay pedidos para exportar con el filtro actual."); return; }
    const filas = [["Fecha", "Hora", "Cliente", "WhatsApp", "Forma de pago", "Cupón", "Descuento", "Producto", "Cantidad", "Precio unitario", "Subtotal", "Total del pedido"]];
    for (const pedido of pedidosAExportar) {
      const fecha = pedido.creadoEn?.toDate ? pedido.creadoEn.toDate() : null;
      const fechaStr = fecha ? fecha.toLocaleDateString("es-AR") : "";
      const horaStr = fecha ? fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
      const items = pedido.items && pedido.items.length > 0 ? pedido.items : [{}];
      items.forEach((item, idx) => {
        filas.push([fechaStr, horaStr, pedido.clienteNombre || "", pedido.clienteWhatsapp || "", pedido.formaPago || "", idx === 0 ? (pedido.cuponCodigo || "") : "", idx === 0 ? (pedido.descuento ?? "") : "", item.nombre || "", item.cantidad ?? "", item.precioUnitario ?? "", item.subtotal ?? "", idx === 0 ? pedido.total ?? "" : ""]);
      });
    }
    const csv = filas.map((fila) => fila.map(escaparCSV).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-villa-libertador-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ============================================================
// IMPORTAR CSV
// ============================================================
const csvInput = document.getElementById("csv-input");
const csvError = document.getElementById("csv-error");
const csvResumen = document.getElementById("csv-resumen");
const modalImportar = document.getElementById("modal-importar");
const importTableBody = document.getElementById("import-table-body");
const insertarError = document.getElementById("importar-error");
const btnCancelarImportar = document.getElementById("btn-cancelar-importar");
const btnConfirmarImportar = document.getElementById("btn-confirmar-importar");
let filasImportacion = [];

function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length === 0) return [];
  function parsearLinea(linea) {
    const valores = []; let actual = ""; let dentroComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];
      if (char === '"') { if (dentroComillas && linea[i + 1] === '"') { actual += '"'; i++; } else { dentroComillas = !dentroComillas; } }
      else if (char === "," && !dentroComillas) { valores.push(actual); actual = ""; }
      else { actual += char; }
    }
    valores.push(actual);
    return valores.map((v) => v.trim());
  }
  const headers = parsearLinea(lineas[0]).map((h) => h.toLowerCase().trim());
  return lineas.slice(1).map((l) => { const v = parsearLinea(l); const f = {}; headers.forEach((h, i) => { f[h] = v[i] !== undefined ? v[i] : ""; }); return f; });
}

function normalizarBooleano(valor) {
  const v = String(valor).trim().toLowerCase();
  return !(v === "false" || v === "0" || v === "no" || v === "");
}

if (csvInput) {
  csvInput.addEventListener("change", async (e) => {
    if (csvError) csvError.textContent = "";
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const filasCrudas = parsearCSV(texto);
      if (filasCrudas.length === 0) { if (csvError) csvError.textContent = "El archivo está vacío."; return; }
      const primerFila = filasCrudas[0];
      const columnasFaltantes = ["codigo", "nombre", "precio", "categoria", "enstock"].filter((c) => !(c in primerFila));
      if (columnasFaltantes.length > 0) { if (csvError) csvError.textContent = `Faltan columnas: ${columnasFaltantes.join(", ")}.`; return; }
      filasImportacion = filasCrudas.map((fila) => {
        const codigo = (fila.codigo || "").trim();
        const existente = codigo ? productosCache.find((p) => (p.codigo || "").trim() === codigo) : null;
        return { codigo, nombre: (fila.nombre || "").trim(), precio: parseFloat(fila.precio) || 0, categoria: (fila.categoria || "").trim(), enStock: normalizarBooleano(fila.enstock), existenteId: existente ? existente.id : null, accion: existente ? "actualizar" : "agregar" };
      });
      if (csvResumen) csvResumen.textContent = `${filasImportacion.length} filas leídas: ${filasImportacion.filter((f) => f.accion === "agregar").length} nuevas, ${filasImportacion.filter((f) => f.existenteId).length} ya existentes.`;
      renderTablaImportacion();
      if (modalImportar) modalImportar.classList.remove("hidden");
      csvInput.value = "";
    } catch (err) { console.error(err); if (csvError) csvError.textContent = "No se pudo leer el archivo."; }
  });
}

function renderTablaImportacion() {
  if (!importTableBody) return;
  importTableBody.innerHTML = "";
  filasImportacion.forEach((fila) => {
    const tr = document.createElement("tr");
    tr.className = fila.existenteId ? "import-row--existente" : "import-row--nuevo";
    const tdCheck = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = fila.accion !== "saltear";
    checkbox.addEventListener("change", () => { fila.accion = checkbox.checked ? (fila.existenteId ? "actualizar" : "agregar") : "saltear"; });
    tdCheck.appendChild(checkbox);
    tr.appendChild(tdCheck);
    [fila.codigo || "—", fila.nombre, fila.categoria, fmt.format(fila.precio), fila.enStock ? "Sí" : "No"].forEach((val) => {
      const td = document.createElement("td"); td.textContent = val; tr.appendChild(td);
    });
    const tdAccion = document.createElement("td");
    if (fila.existenteId) {
      const select = document.createElement("select");
      [["actualizar", "Actualizar existente"], ["saltear", "Saltear (no tocar)"]].forEach(([v, t]) => {
        const opt = document.createElement("option"); opt.value = v; opt.textContent = t; select.appendChild(opt);
      });
      select.value = fila.accion;
      select.addEventListener("change", () => { fila.accion = select.value; checkbox.checked = select.value !== "saltear"; });
      tdAccion.appendChild(select);
    } else {
      const tag = document.createElement("span"); tag.className = "tag tag--promo"; tag.textContent = "Nuevo"; tdAccion.appendChild(tag);
    }
    tr.appendChild(tdAccion);
    importTableBody.appendChild(tr);
  });
}

if (btnCancelarImportar) { btnCancelarImportar.addEventListener("click", () => { modalImportar.classList.add("hidden"); filasImportacion = []; }); }

if (btnConfirmarImportar) {
  btnConfirmarImportar.addEventListener("click", async () => {
    if (insertarError) insertarError.textContent = "";
    const aProcesar = filasImportacion.filter((f) => f.accion !== "saltear");
    if (aProcesar.length === 0) { if (insertarError) insertarError.textContent = "No hay ninguna fila seleccionada."; return; }
    btnConfirmarImportar.disabled = true; btnConfirmarImportar.textContent = "Importando…";
    try {
      for (const fila of aProcesar) {
        if (fila.accion === "actualizar" && fila.existenteId) {
          await updateDoc(doc(db, "productos", fila.existenteId), { codigo: fila.codigo, nombre: fila.nombre, precio: fila.precio, categoria: fila.categoria, enStock: fila.enStock });
        } else if (fila.accion === "agregar") {
          await addDoc(collection(db, "productos"), { codigo: fila.codigo, nombre: fila.nombre, precio: fila.precio, categoria: fila.categoria, orden: 0, enStock: fila.enStock, fraccionable: false, promo: false, precioPromo: null, promoTexto: "", imagenUrl: "" });
        }
      }
      modalImportar.classList.add("hidden"); filasImportacion = []; alert("Importación completada.");
    } catch (err) { console.error(err); if (insertarError) insertarError.textContent = "Ocurrió un error al importar."; }
    finally { btnConfirmarImportar.disabled = false; btnConfirmarImportar.textContent = "Importar seleccionados"; }
  });
}

function ajustarStickyNav() {
  const searchBar = document.querySelector(".search-bar");
  if (searchBar) document.documentElement.style.setProperty("--search-bar-height", `${searchBar.offsetHeight}px`);
}
window.addEventListener("resize", ajustarStickyNav);
window.addEventListener("load", ajustarStickyNav);
ajustarStickyNav();

// ============================================================
// CONTROL DE FLUJO Y CONEXIÓN EN TIEMPO REAL
// ============================================================
let suscripcionProductos = null;
let suscripcionPedidos = null;
let suscripcionCupones = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (loginCard) loginCard.classList.add("hidden");
    if (registroCard) registroCard.classList.add("hidden");
    if (resetCard) resetCard.classList.add("hidden");
    if (adminShell) adminShell.classList.remove("hidden");
    cargarMinimoGeneral();
    cargarPopup();

    if (!suscripcionProductos) {
      const productosQuery = query(collection(db, "productos"), orderBy("categoria"), orderBy("orden"));
      suscripcionProductos = onSnapshot(productosQuery, (snapshot) => {
        productosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        aplicarFiltroAdmin();
        actualizarListaCategorias();
        renderCategoriasAdmin();
      }, (error) => { console.error("Error en productos:", error); });
    }

    if (!suscripcionPedidos) {
      const pedidosQuery = query(collection(db, "pedidos"), orderBy("creadoEn", "desc"));
      suscripcionPedidos = onSnapshot(pedidosQuery, (snapshot) => {
        pedidosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderPedidos();
      }, (err) => { console.error("Error en pedidos:", err); });
    }

    if (!suscripcionCupones) {
      suscripcionCupones = onSnapshot(collection(db, "cupones"), (snapshot) => {
        cuponesCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderListaCupones();
        actualizarDatalistCategoriasCupon();
      }, (err) => { console.error("Error en cupones:", err); });
    }

  } else {
    [suscripcionProductos, suscripcionPedidos, suscripcionCupones].forEach((unsub) => { if (unsub) unsub(); });
    suscripcionProductos = null; suscripcionPedidos = null; suscripcionCupones = null;
    if (adminShell) adminShell.classList.add("hidden");
    if (loginCard) loginCard.classList.remove("hidden");
  }
});

// ============================================================
// GESTIÓN DE CATEGORÍAS
// ============================================================
const listaCatAdmin = document.getElementById("lista-categorias-admin");
const categoriasVacia = document.getElementById("categorias-vacia");
const modalRenombrar = document.getElementById("modal-renombrar");
const btnCancelarRenombrar = document.getElementById("btn-cancelar-renombrar");
const btnConfirmarRenombrar = document.getElementById("btn-confirmar-renombrar");
const renombrarNuevo = document.getElementById("renombrar-nuevo");
const renombrarError = document.getElementById("renombrar-error");
let categoriaEnRenombrado = null;

function renderCategoriasAdmin() {
  if (!listaCatAdmin) return;
  listaCatAdmin.innerHTML = "";
  const categorias = [...new Set(productosCache.map((p) => p.categoria).filter(Boolean))];
  categorias.sort((a, b) => a.localeCompare(b, "es"));
  if (categoriasVacia) categoriasVacia.classList.toggle("hidden", categorias.length > 0);
  for (const cat of categorias) {
    const cantidad = productosCache.filter((p) => p.categoria === cat).length;
    const row = document.createElement("div");
    row.className = "admin-product-row";
    row.style.alignItems = "center";
    const info = document.createElement("div");
    info.className = "admin-product-row__info";
    const nombre = document.createElement("p");
    nombre.className = "admin-product-row__name";
    nombre.textContent = cat;
    info.appendChild(nombre);
    const meta = document.createElement("p");
    meta.className = "admin-product-row__meta";
    meta.textContent = `${cantidad} producto${cantidad !== 1 ? "s" : ""}`;
    info.appendChild(meta);
    row.appendChild(info);
    const actions = document.createElement("div");
    actions.className = "admin-product-row__actions";
    const btnRenombrar = document.createElement("button");
    btnRenombrar.type = "button"; btnRenombrar.className = "icon-btn"; btnRenombrar.textContent = "Renombrar";
    btnRenombrar.addEventListener("click", () => abrirModalRenombrar(cat));
    actions.appendChild(btnRenombrar);
    const btnEliminarCat = document.createElement("button");
    btnEliminarCat.type = "button"; btnEliminarCat.className = "icon-btn"; btnEliminarCat.textContent = "Eliminar";
    btnEliminarCat.addEventListener("click", () => eliminarCategoria(cat));
    actions.appendChild(btnEliminarCat);
    row.appendChild(actions);
    listaCatAdmin.appendChild(row);
  }
}

function abrirModalRenombrar(cat) {
  categoriaEnRenombrado = cat;
  renombrarNuevo.value = cat;
  renombrarError.textContent = "";
  modalRenombrar.classList.remove("hidden");
  renombrarNuevo.focus(); renombrarNuevo.select();
}

if (btnCancelarRenombrar) { btnCancelarRenombrar.addEventListener("click", () => { modalRenombrar.classList.add("hidden"); categoriaEnRenombrado = null; }); }

if (btnConfirmarRenombrar) {
  btnConfirmarRenombrar.addEventListener("click", async () => {
    const nuevoNombre = renombrarNuevo.value.trim();
    if (!nuevoNombre) { renombrarError.textContent = "El nombre no puede estar vacío."; return; }
    if (nuevoNombre === categoriaEnRenombrado) { modalRenombrar.classList.add("hidden"); return; }
    btnConfirmarRenombrar.disabled = true; btnConfirmarRenombrar.textContent = "Actualizando…"; renombrarError.textContent = "";
    try {
      for (const p of productosCache.filter((p) => p.categoria === categoriaEnRenombrado)) {
        await updateDoc(doc(db, "productos", p.id), { categoria: nuevoNombre });
      }
      modalRenombrar.classList.add("hidden"); categoriaEnRenombrado = null;
    } catch (err) { console.error(err); renombrarError.textContent = "No se pudo renombrar. Probá de nuevo."; }
    finally { btnConfirmarRenombrar.disabled = false; btnConfirmarRenombrar.textContent = "Renombrar"; }
  });
}

async function eliminarCategoria(cat) {
  const cantidad = productosCache.filter((p) => p.categoria === cat).length;
  const mensaje = cantidad > 0 ? `¿Eliminar la categoría "${cat}"? Tiene ${cantidad} producto${cantidad !== 1 ? "s" : ""} que quedarán sin categoría.` : `¿Eliminar la categoría "${cat}"?`;
  if (!confirm(mensaje)) return;
  try {
    for (const p of productosCache.filter((p) => p.categoria === cat)) {
      await updateDoc(doc(db, "productos", p.id), { categoria: "" });
    }
  } catch (err) { console.error(err); alert("No se pudo eliminar la categoría. Probá de nuevo."); }
}

// ============================================================
// CUPONES DE DESCUENTO
// ============================================================
let cuponesCache = [];

const formNuevoCupon = document.getElementById("form-nuevo-cupon");
const cuponError = document.getElementById("cupon-error");
const listaCupones = document.getElementById("lista-cupones");
const cuponesVacio = document.getElementById("cupones-vacio");
const cuAlcance = document.getElementById("cu-alcance");
const cuCategoriaField = document.getElementById("cu-categoria-field");
const cuTipo = document.getElementById("cu-tipo");
const cuValorLabel = document.getElementById("cu-valor-label");
const modalEditarCupon = document.getElementById("modal-editar-cupon");
const formEditarCupon = document.getElementById("form-editar-cupon");
const editarCuponError = document.getElementById("editar-cupon-error");
const btnCancelarEditarCupon = document.getElementById("btn-cancelar-editar-cupon");
const ecAlcance = document.getElementById("ec-alcance");
const ecCategoriaField = document.getElementById("ec-categoria-field");
const ecTipo = document.getElementById("ec-tipo");
const ecValorLabel = document.getElementById("ec-valor-label");

function actualizarCampoCategoria(selectAlcance, campoCategoria) {
  if (!selectAlcance || !campoCategoria) return;
  campoCategoria.classList.toggle("hidden", selectAlcance.value !== "categoria");
}

function actualizarLabelValor(selectTipo, label) {
  if (!selectTipo || !label) return;
  label.textContent = selectTipo.value === "porcentaje" ? "Porcentaje de descuento (%)" : "Monto fijo a descontar ($)";
}

cuAlcance?.addEventListener("change", () => actualizarCampoCategoria(cuAlcance, cuCategoriaField));
ecAlcance?.addEventListener("change", () => actualizarCampoCategoria(ecAlcance, ecCategoriaField));
cuTipo?.addEventListener("change", () => actualizarLabelValor(cuTipo, cuValorLabel));
ecTipo?.addEventListener("change", () => actualizarLabelValor(ecTipo, ecValorLabel));

actualizarCampoCategoria(cuAlcance, cuCategoriaField);
actualizarLabelValor(cuTipo, cuValorLabel);

function actualizarDatalistCategoriasCupon() {
  const datalist = document.getElementById("lista-categorias-cupon");
  if (!datalist) return;
  const categorias = [...new Set(productosCache.map((p) => p.categoria).filter(Boolean))];
  categorias.sort((a, b) => a.localeCompare(b, "es"));
  datalist.innerHTML = "";
  for (const cat of categorias) {
    const option = document.createElement("option");
    option.value = cat;
    datalist.appendChild(option);
  }
}

formNuevoCupon?.addEventListener("submit", async (e) => {
  e.preventDefault();
  cuponError.textContent = "";
  const codigo = document.getElementById("cu-codigo").value.trim().toUpperCase();
  const tipo = document.getElementById("cu-tipo").value;
  const valor = parseFloat(document.getElementById("cu-valor").value);
  const alcance = document.getElementById("cu-alcance").value;
  const categoria = document.getElementById("cu-categoria").value.trim();
  const desde = document.getElementById("cu-desde").value;
  const hasta = document.getElementById("cu-hasta").value;
  const minimoRaw = document.getElementById("cu-minimo").value;
  const topeRaw = document.getElementById("cu-tope").value;
  const minimo = minimoRaw !== "" ? parseFloat(minimoRaw) : null;
  const tope = topeRaw !== "" ? parseFloat(topeRaw) : null;
  const activo = document.getElementById("cu-activo").checked;

  if (!codigo) { cuponError.textContent = "El código no puede estar vacío."; return; }
  if (alcance === "categoria" && !categoria) { cuponError.textContent = "Especificá la categoría."; return; }
  if (desde && hasta && desde > hasta) { cuponError.textContent = "La fecha 'desde' no puede ser posterior a 'hasta'."; return; }
  if (cuponesCache.some((c) => c.codigo === codigo)) { cuponError.textContent = "Ya existe un cupón con ese código."; return; }

  try {
    await addDoc(collection(db, "cupones"), { codigo, tipo, valor, alcance, categoria: alcance === "categoria" ? categoria : "", desde, hasta, minimo, tope, activo });
    formNuevoCupon.reset();
    actualizarCampoCategoria(cuAlcance, cuCategoriaField);
    actualizarLabelValor(cuTipo, cuValorLabel);
  } catch (err) { console.error(err); cuponError.textContent = "No se pudo crear el cupón. Probá de nuevo."; }
});

function formatearFechaCupon(fechaStr) {
  if (!fechaStr) return "—";
  const [anio, mes, dia] = fechaStr.split("-");
  return `${dia}/${mes}/${anio}`;
}

function renderListaCupones() {
  if (!listaCupones) return;
  listaCupones.innerHTML = "";
  cuponesVacio?.classList.toggle("hidden", cuponesCache.length > 0);

  for (const c of cuponesCache) {
    const row = document.createElement("div");
    row.className = "admin-product-row";
    const info = document.createElement("div");
    info.className = "admin-product-row__info";
    const name = document.createElement("p");
    name.className = "admin-product-row__name";
    name.textContent = c.codigo;
    info.appendChild(name);
    const valorTexto = c.tipo === "porcentaje" ? `${c.valor}%` : fmt.format(c.valor);
    const alcanceTexto = c.alcance === "categoria" ? `Solo "${c.categoria}"` : "Todo el pedido";
    const extras = [];
    if (c.minimo != null) extras.push(`mín. ${fmt.format(c.minimo)}`);
    if (c.tope != null) extras.push(`tope ${fmt.format(c.tope)}`);
    const meta = document.createElement("p");
    meta.className = "admin-product-row__meta";
    meta.textContent = `${valorTexto} · ${alcanceTexto} · ${formatearFechaCupon(c.desde)} al ${formatearFechaCupon(c.hasta)}${extras.length ? " · " + extras.join(", ") : ""}`;
    info.appendChild(meta);
    const tags = document.createElement("p");
    const tagEstado = document.createElement("span");
    tagEstado.className = c.activo ? "tag tag--promo" : "tag tag--soldout";
    tagEstado.textContent = c.activo ? "Activo" : "Inactivo";
    tags.appendChild(tagEstado);
    info.appendChild(tags);
    row.appendChild(info);
    const actions = document.createElement("div");
    actions.className = "admin-product-row__actions";
    const btnEditar = document.createElement("button");
    btnEditar.type = "button"; btnEditar.className = "icon-btn"; btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => abrirModalEditarCupon(c));
    actions.appendChild(btnEditar);
    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button"; btnEliminar.className = "icon-btn"; btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", () => eliminarCupon(c));
    actions.appendChild(btnEliminar);
    row.appendChild(actions);
    listaCupones.appendChild(row);
  }
}

function abrirModalEditarCupon(c) {
  editarCuponError.textContent = "";
  document.getElementById("ec-id").value = c.id;
  document.getElementById("ec-codigo").value = c.codigo;
  document.getElementById("ec-tipo").value = c.tipo;
  document.getElementById("ec-valor").value = c.valor;
  document.getElementById("ec-alcance").value = c.alcance;
  document.getElementById("ec-categoria").value = c.categoria || "";
  document.getElementById("ec-desde").value = c.desde || "";
  document.getElementById("ec-hasta").value = c.hasta || "";
  document.getElementById("ec-minimo").value = c.minimo != null ? c.minimo : "";
  document.getElementById("ec-tope").value = c.tope != null ? c.tope : "";
  document.getElementById("ec-activo").checked = !!c.activo;
  actualizarCampoCategoria(ecAlcance, ecCategoriaField);
  actualizarLabelValor(ecTipo, ecValorLabel);
  modalEditarCupon.classList.remove("hidden");
}

btnCancelarEditarCupon?.addEventListener("click", () => { modalEditarCupon.classList.add("hidden"); });

formEditarCupon?.addEventListener("submit", async (e) => {
  e.preventDefault();
  editarCuponError.textContent = "";
  const id = document.getElementById("ec-id").value;
  const codigo = document.getElementById("ec-codigo").value.trim().toUpperCase();
  const alcance = document.getElementById("ec-alcance").value;
  const categoria = document.getElementById("ec-categoria").value.trim();
  const desde = document.getElementById("ec-desde").value;
  const hasta = document.getElementById("ec-hasta").value;
  const minimoRawE = document.getElementById("ec-minimo").value;
  const topeRawE = document.getElementById("ec-tope").value;
  const minimo = minimoRawE !== "" ? parseFloat(minimoRawE) : null;
  const tope = topeRawE !== "" ? parseFloat(topeRawE) : null;

  if (alcance === "categoria" && !categoria) { editarCuponError.textContent = "Especificá la categoría."; return; }
  if (desde && hasta && desde > hasta) { editarCuponError.textContent = "La fecha 'desde' no puede ser posterior a 'hasta'."; return; }
  if (cuponesCache.some((c) => c.codigo === codigo && c.id !== id)) { editarCuponError.textContent = "Ya existe otro cupón con ese código."; return; }
  try {
    await updateDoc(doc(db, "cupones", id), { codigo, tipo: document.getElementById("ec-tipo").value, valor: parseFloat(document.getElementById("ec-valor").value), alcance, categoria: alcance === "categoria" ? categoria : "", desde, hasta, minimo, tope, activo: document.getElementById("ec-activo").checked });
    modalEditarCupon.classList.add("hidden");
  } catch (err) { console.error(err); editarCuponError.textContent = "No se pudieron guardar los cambios."; }
});

async function eliminarCupon(c) {
  if (!confirm(`¿Eliminar el cupón "${c.codigo}"?`)) return;
  try { await deleteDoc(doc(db, "cupones", c.id)); }
  catch (err) { console.error(err); alert("No se pudo eliminar el cupón."); }
}

// ============================================================
// MÍNIMO GENERAL DE COMPRA
// ============================================================

const btnGuardarMinimoGeneral = document.getElementById("btn-guardar-minimo-general");
const minimoGeneralInput = document.getElementById("minimo-general-valor");
const minimoGeneralError = document.getElementById("minimo-general-error");
const minimoGeneralOk = document.getElementById("minimo-general-ok");

// Cargar el valor actual al iniciar
async function cargarMinimoGeneral() {
  try {
    const snap = await getDoc(doc(db, "configuracion", "catalogo"));
    if (snap.exists() && minimoGeneralInput) {
      const val = snap.data().minimoGeneral;
      minimoGeneralInput.value = val != null && val > 0 ? val : "";
    }
  } catch (err) {
    console.error("Error cargando mínimo general:", err);
  }
}

if (btnGuardarMinimoGeneral) {
  btnGuardarMinimoGeneral.addEventListener("click", async () => {
    minimoGeneralError.textContent = "";
    minimoGeneralOk.classList.add("hidden");
    const raw = minimoGeneralInput.value;
    const valor = raw !== "" ? parseFloat(raw) : 0;
    try {
      await setDoc(doc(db, "configuracion", "catalogo"), { minimoGeneral: valor }, { merge: true });
      minimoGeneralOk.classList.remove("hidden");
      setTimeout(() => minimoGeneralOk.classList.add("hidden"), 3000);
    } catch (err) {
      console.error(err);
      minimoGeneralError.textContent = "No se pudo guardar. Probá de nuevo.";
    }
  });
}

// ============================================================
// POPUP PROMOCIONAL
// ============================================================

const btnGuardarPopup = document.getElementById("btn-guardar-popup");
const popupError = document.getElementById("popup-error");
const popupOk = document.getElementById("popup-ok");
const popupImagenActual = document.getElementById("popup-imagen-actual");

async function cargarPopup() {
  try {
    const snap = await getDoc(doc(db, "configuracion", "popup"));
    if (snap.exists()) {
      const datos = snap.data();
      const chk = document.getElementById("popup-activo");
      const seg = document.getElementById("popup-segundos");
      if (chk) chk.checked = !!datos.activo;
      if (seg) seg.value = datos.segundos || 8;
      if (popupImagenActual && datos.imagenUrl) {
        popupImagenActual.innerHTML = `Imagen actual: <a href="${datos.imagenUrl}" target="_blank" rel="noopener">ver imagen</a>`;
      }
    }
  } catch (err) { console.error("Error cargando popup:", err); }
}

if (btnGuardarPopup) {
  btnGuardarPopup.addEventListener("click", async () => {
    popupError.textContent = "";
    popupOk.classList.add("hidden");

    const activo = document.getElementById("popup-activo").checked;
    const segundos = parseInt(document.getElementById("popup-segundos").value) || 8;
    const archivo = document.getElementById("popup-imagen").files[0];

    btnGuardarPopup.disabled = true;
    btnGuardarPopup.textContent = "Guardando…";

    try {
      let imagenUrl = null;

      // Si hay imagen nueva, subirla
      if (archivo) {
        const extension = archivo.name.split(".").pop();
        const storageRef = ref(storage, `configuracion/popup.${extension}`);
        await uploadBytes(storageRef, archivo);
        imagenUrl = await getDownloadURL(storageRef);
      } else {
        // Mantener la imagen existente
        const snap = await getDoc(doc(db, "configuracion", "popup"));
        if (snap.exists()) imagenUrl = snap.data().imagenUrl || null;
      }

      await setDoc(doc(db, "configuracion", "popup"), { activo, segundos, imagenUrl }, { merge: true });

      if (popupImagenActual && imagenUrl) {
        popupImagenActual.innerHTML = `Imagen actual: <a href="${imagenUrl}" target="_blank" rel="noopener">ver imagen</a>`;
      }

      popupOk.classList.remove("hidden");
      setTimeout(() => popupOk.classList.add("hidden"), 3000);
      document.getElementById("popup-imagen").value = "";
    } catch (err) {
      console.error(err);
      popupError.textContent = "No se pudo guardar. Probá de nuevo.";
    } finally {
      btnGuardarPopup.disabled = false;
      btnGuardarPopup.textContent = "Guardar popup";
    }
  });
}

// ============================================================
// PRECIOS POR VOLUMEN — funciones auxiliares
// ============================================================

function leerEscalonesVolumen(contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return [];
  const filas = contenedor.querySelectorAll(".precio-volumen-fila");
  const escalones = [];
  filas.forEach((fila) => {
    const cantidadInput = fila.querySelector(".pv-cantidad");
    const precioInput = fila.querySelector(".pv-precio");
    const cantidad = cantidadInput ? parseFloat(cantidadInput.value) : NaN;
    const precio = precioInput ? parseFloat(precioInput.value) : NaN;
    if (!isNaN(cantidad) && cantidad > 0 && !isNaN(precio) && precio > 0) {
      escalones.push({ cantidad, precio });
    }
  });
  // Ordenar de menor a mayor cantidad
  escalones.sort((a, b) => a.cantidad - b.cantidad);
  return escalones;
}

function cargarEscalonesVolumen(contenedorId, escalones) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  const filas = contenedor.querySelectorAll(".precio-volumen-fila");
  filas.forEach((fila, idx) => {
    const cantidadInput = fila.querySelector(".pv-cantidad");
    const precioInput = fila.querySelector(".pv-precio");
    const escalon = escalones[idx];
    if (cantidadInput) cantidadInput.value = escalon ? escalon.cantidad : "";
    if (precioInput) precioInput.value = escalon ? escalon.precio : "";
  });
}

function limpiarEscalonesVolumen(contenedorId) {
  cargarEscalonesVolumen(contenedorId, []);
}
