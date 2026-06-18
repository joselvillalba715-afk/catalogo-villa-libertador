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

// ---------- Crear cuenta (solo emails autorizados) ----------
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

adminTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    adminTabs.forEach((b) => b.classList.remove("admin-tab--active"));
    btn.classList.add("admin-tab--active");
    if (btn.dataset.tab === "catalogo") {
      tabCatalogo.classList.remove("hidden");
      tabPedidos.classList.add("hidden");
    } else {
      tabCatalogo.classList.add("hidden");
      tabPedidos.classList.remove("hidden");
    }
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
  const precioPromo = document.getElementById("n-precio-promo").value
    ? parseFloat(document.getElementById("n-precio-promo").value)
    : null;
  const promoTexto = document.getElementById("n-promo-texto").value.trim();
  const archivo = document.getElementById("n-imagen").files[0];

  try {
    const docRef = await addDoc(collection(db, "productos"), {
      nombre,
      codigo,
      categoria,
      precio,
      orden,
      enStock,
      promo,
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
  } catch (err) {
    console.error(err);
    nuevoError.textContent = "No se pudo agregar el producto. Probá de nuevo.";
  }
});

// ---------- Variables de Datos y Cache ----------
let productosCache = [];
let pedidosCache = [];

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
}

function aplicarFiltroAdmin() {
  const textoBusqueda = elAdminBuscador ? normalizarTexto(elAdminBuscador.value.trim()) : "";
  
  let filtrados = productosCache;
  
  if (textoBusqueda) {
    filtrados = productosCache.filter((p) =>
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
    if (p.promo && p.precioPromo != null) {
      precioTexto += ` → ${fmt.format(p.precioPromo)}`;
    }
    meta.textContent = `${p.categoria} · ${precioTexto}`;
    info.appendChild(meta);

    const tags = document.createElement("p");
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

  const datos = {
    nombre: document.getElementById("e-nombre").value.trim(),
    codigo: document.getElementById("e-codigo").value.trim(),
    categoria: document.getElementById("e-categoria").value.trim(),
    precio: parseFloat(document.getElementById("e-precio").value),
    orden: parseInt(document.getElementById("e-orden").value, 10) || 0,
    enStock: document.getElementById("e-stock").checked,
    promo,
    precioPromo: promo
      ? parseFloat(document.getElementById("e-precio-promo").value) || null
      : null,
    promoTexto: promo ? document.getElementById("e-promo-texto").value.trim() : "",
  };

  try {
    const archivo = document.getElementById("e-imagen").files[0];
    if (archivo) {
      datos.imagenUrl = await subirImagen(archivo, id);
    }

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
      try {
        await deleteObject(ref(storage, `productos/${p.id}.${extension}`));
      } catch (err) {
        // Ignorar error si no existe la imagen
      }
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

function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obtenerPedidosFiltrados() {
  const desde = filtroDesde.value ? new Date(filtroDesde.value + "T00:00:00") : null;
  const hasta = filtroHasta.value ? new Date(filtroHasta.value + "T23:59:59") : null;
  const textoCliente = normalizarTexto(filtroCliente.value.trim());

  return pedidosCache.filter((pedido) => {
    const fecha = pedido.creadoEn?.toDate ? pedido.creadoEn.toDate() : null;

    if (desde && (!fecha || fecha < desde)) return false;
    if (hasta && (!fecha || fecha > hasta)) return false;

    if (textoCliente) {
      const nombreNormalizado = normalizarTexto(pedido.clienteNombre);
      if (!nombreNormalizado.includes(textoCliente)) return false;
    }

    return true;
  });
}

[filtroDesde, filtroHasta, filtroCliente].forEach((el) => {
  if (el) el.addEventListener("input", renderPedidos);
});

if (btnLimpiarFiltros) {
  btnLimpiarFiltros.addEventListener("click", () => {
    filtroDesde.value = "";
    filtroHasta.value = "";
    filtroCliente.value = "";
    renderPedidos();
  });
}

function slugifyPago(formaPago) {
  return formaPago
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
}

function formatearFechaHora(timestamp) {
  if (!timestamp || !timestamp.toDate) return "—";
  const fecha = timestamp.toDate();
  const fechaStr = fecha.toLocaleDateString("es-AR");
  const horaStr = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fechaStr} · ${horaStr}`;
}

function renderPedidos() {
  if (!listaPedidos) return;
  const pedidosFiltrados = obtenerPedidosFiltrados();

  listaPedidos.innerHTML = "";
  if (pedidosVacio) pedidosVacio.classList.toggle("hidden", pedidosCache.length > 0);

  const hayFiltrosActivos =
    filtroDesde.value || filtroHasta.value || (filtroCliente && filtroCliente.value.trim());
  
  if (pedidosSinResultados) {
    pedidosSinResultados.classList.toggle(
      "hidden",
      !(pedidosCache.length > 0 && hayFiltrosActivos && pedidosFiltrados.length === 0)
    );
  }

  for (const pedido of pedidosFiltrados) {
    const card = document.createElement("div");
    card.className = "order-card";

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

    const tabla = document.createElement("table");
    tabla.className = "order-detail-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>";
    tabla.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const item of pedido.items || []) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.nombre}</td>
        <td>${item.cantidad}</td>
        <td>${fmt.format(item.precioUnitario)}</td>
        <td>${fmt.format(item.subtotal)}</td>
      `;
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);
    detail.appendChild(tabla);

    const waLink = document.createElement("a");
    waLink.className = "btn btn-secondary";
    waLink.style.marginTop = "10px";
    waLink.style.display = "inline-block";
    waLink.textContent = "Abrir chat de WhatsApp";
    waLink.href = `https://wa.me/${pedido.clienteWhatsapp}`;
    waLink.target = "_blank";
    waLink.rel = "noopener";
    detail.appendChild(waLink);

    header.addEventListener("click", () => {
      detail.classList.toggle("hidden");
      chevron.textContent = detail.classList.contains("hidden") ? "▾" : "▴";
    });

    card.appendChild(header);
    card.appendChild(detail);
    listaPedidos.appendChild(card);
  }
}

// ----- Exportar a CSV -----
function escaparCSV(valor) {
  const texto = String(valor ?? "");
  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

if (btnExportarPedidos) {
  btnExportarPedidos.addEventListener("click", () => {
    const pedidosAExportar = obtenerPedidosFiltrados();

    if (pedidosAExportar.length === 0) {
      alert("No hay pedidos para exportar con el filtro actual.");
      return;
    }

    const filas = [
      ["Fecha", "Hora", "Cliente", "WhatsApp", "Forma de pago", "Producto", "Cantidad", "Precio unitario", "Subtotal", "Total del pedido"],
    ];

    for (const pedido of pedidosAExportar) {
      const fecha = pedido.creadoEn?.toDate ? pedido.creadoEn.toDate() : null;
      const fechaStr = fecha ? fecha.toLocaleDateString("es-AR") : "";
      const horaStr = fecha ? fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";

      const items = pedido.items && pedido.items.length > 0 ? pedido.items : [{}];

      items.forEach((item, idx) => {
        filas.push([
          fechaStr,
          horaStr,
          pedido.clienteNombre || "",
          pedido.clienteWhatsapp || "",
          pedido.formaPago || "",
          item.nombre || "",
          item.cantidad ?? "",
          item.precioUnitario ?? "",
          item.subtotal ?? "",
          idx === 0 ? pedido.total ?? "" : "",
        ]);
      });
    }

    const csv = filas.map((fila) => fila.map(escaparCSV).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const hoy = new Date().toISOString().slice(0, 10);
    a.download = `pedidos-villa-libertador-${hoy}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ============================================================
// IMPORTAR PRODUCTOS DESDE CSV
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
    const valores = [];
    let actual = "";
    let dentroComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const char = linea[i];
      if (char === '"') {
        if (dentroComillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          dentroComillas = !dentroComillas;
        }
      } else if (char === "," && !dentroComillas) {
        valores.push(actual);
        actual = "";
      } else {
        actual += char;
      }
    }
    valores.push(actual);
    return valores.map((v) => v.trim());
  }

  const headers = parsearLinea(lineas[0]).map((h) => h.toLowerCase().trim());
  const filas = [];

  for (let i = 1; i < lineas.length; i++) {
    const valores = parsearLinea(lineas[i]);
    const fila = {};
    headers.forEach((h, idx) => {
      fila[h] = valores[idx] !== undefined ? valores[idx] : "";
    });
    filas.push(fila);
  }

  return filas;
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

      if (filasCrudas.length === 0) {
        if (csvError) csvError.textContent = "El archivo está vacío o no se pudo leer.";
        return;
      }

      const primerFila = filasCrudas[0];
      const columnasEsperadas = ["codigo", "nombre", "precio", "categoria", "enstock"];
      const columnasFaltantes = columnasEsperadas.filter((c) => !(c in primerFila));
      if (columnasFaltantes.length > 0) {
        if (csvError) csvError.textContent = `Faltan columnas en el archivo: ${columnasFaltantes.join(", ")}.`;
        return;
      }

      filasImportacion = filasCrudas.map((fila) => {
        const codigo = (fila.codigo || "").trim();
        const existente = codigo
          ? productosCache.find((p) => (p.codigo || "").trim() === codigo)
          : null;

        return {
          codigo,
          nombre: (fila.nombre || "").trim(),
          precio: parseFloat(fila.precio) || 0,
          categoria: (fila.categoria || "").trim(),
          enStock: normalizarBooleano(fila.enstock),
          existenteId: existente ? existente.id : null,
          accion: existente ? "actualizar" : "agregar",
        };
      });

      abrirModalImportar();
      csvInput.value = "";
    } catch (err) {
      console.error(err);
      if (csvError) csvError.textContent = "No se pudo leer el archivo. Verificá que sea un CSV válido.";
    }
  });
}

function abrirModalImportar() {
  if (insertarError) insertarError.textContent = "";

  const nuevos = filasImportacion.filter((f) => f.accion === "agregar").length;
  const existentes = filasImportacion.filter((f) => f.existenteId).length;
  if (csvResumen) csvResumen.textContent = `${filasImportacion.length} filas leídas: ${nuevos} nuevas, ${existentes} ya existentes.`;

  renderTablaImportacion();
  if (modalImportar) modalImportar.classList.remove("hidden");
}

function renderTablaImportacion() {
  if (!importTableBody) return;
  importTableBody.innerHTML = "";

  filasImportacion.forEach((fila, idx) => {
    const tr = document.createElement("tr");
    tr.className = fila.existenteId ? "import-row--existente" : "import-row--nuevo";

    const tdCheck = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = fila.accion !== "saltear";
    checkbox.addEventListener("change", () => {
      fila.accion = checkbox.checked
        ? (fila.existenteId ? "actualizar" : "agregar")
        : "saltear";
    });
    tdCheck.appendChild(checkbox);
    tr.appendChild(tdCheck);

    const tdCodigo = document.createElement("td");
    tdCodigo.textContent = fila.codigo || "—";
    tr.appendChild(tdCodigo);

    const tdNombre = document.createElement("td");
    tdNombre.textContent = fila.nombre;
    tr.appendChild(tdNombre);

    const tdCategoria = document.createElement("td");
    tdCategoria.textContent = fila.categoria;
    tr.appendChild(tdCategoria);

    const tdPrecio = document.createElement("td");
    tdPrecio.textContent = fmt.format(fila.precio);
    tr.appendChild(tdPrecio);

    const tdStock = document.createElement("td");
    tdStock.textContent = fila.enStock ? "Sí" : "No";
    tr.appendChild(tdStock);

    const tdAccion = document.createElement("td");
    if (fila.existenteId) {
      const select = document.createElement("select");
      const optActualizar = document.createElement("option");
      optActualizar.value = "actualizar";
      optActualizar.textContent = "Actualizar existente";
      const optSaltear = document.createElement("option");
      optSaltear.value = "saltear";
      optSaltear.textContent = "Saltear (no tocar)";
      select.appendChild(optActualizar);
      select.appendChild(optSaltear);
      select.value = fila.accion;
      select.addEventListener("change", () => {
        fila.accion = select.value;
        checkbox.checked = select.value !== "saltear";
      });
      tdAccion.appendChild(select);
    } else {
      const tag = document.createElement("span");
      tag.className = "tag tag--promo";
      tag.textContent = "Nuevo";
      tdAccion.appendChild(tag);
    }
    tr.appendChild(tdAccion);

    importTableBody.appendChild(tr);
  });
}

if (btnCancelarImportar) {
  btnCancelarImportar.addEventListener("click", () => {
    modalImportar.classList.add("hidden");
    filasImportacion = [];
  });
}

if (btnConfirmarImportar) {
  btnConfirmarImportar.addEventListener("click", async () => {
    if (insertarError) insertarError.textContent = "";
    const aProcesar = filasImportacion.filter((f) => f.accion !== "saltear");

    if (aProcesar.length === 0) {
      if (insertarError) insertarError.textContent = "No hay ninguna fila seleccionada para importar.";
      return;
    }

    btnConfirmarImportar.disabled = true;
    btnConfirmarImportar.textContent = "Importando…";

    try {
      for (const fila of aProcesar) {
        if (fila.accion === "actualizar" && fila.existenteId) {
          await updateDoc(doc(db, "productos", fila.existenteId), {
            codigo: fila.codigo,
            nombre: fila.nombre,
            precio: fila.precio,
            categoria: fila.categoria,
            enStock: fila.enStock,
          });
        } else if (fila.accion === "agregar") {
          await addDoc(collection(db, "productos"), {
            codigo: fila.codigo,
            nombre: fila.nombre,
            precio: fila.precio,
            categoria: fila.categoria,
            orden: 0,
            enStock: fila.enStock,
            promo: false,
            precioPromo: null,
            promoTexto: "",
            imagenUrl: "",
          });
        }
      }

      modalImportar.classList.add("hidden");
      filasImportacion = [];
      alert("Importación completada.");
    } catch (err) {
      console.error(err);
      if (insertarError) insertarError.textContent = "Ocurrió un error al importar. Algunos productos pueden haberse cargado igual.";
    } finally {
      btnConfirmarImportar.disabled = false;
      btnConfirmarImportar.textContent = "Importar seleccionados";
    }
  });
}

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

// ============================================================
// CONTROL DE FLUJO Y CONEXIÓN EN TIEMPO REAL (ZONA SEGURA)
// ============================================================
let suscripcionProductos = null;
let suscripcionPedidos = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Escondemos logins y mostramos el entorno completo de control
    if (loginCard) loginCard.classList.add("hidden");
    if (registroCard) registroCard.classList.add("hidden");
    if (resetCard) resetCard.classList.add("hidden");
    if (adminShell) adminShell.classList.remove("hidden");

    // Conectamos la escucha en tiempo real de Firebase con sesión activa
    if (!suscripcionProductos) {
      const productosQuery = query(
        collection(db, "productos"),
        orderBy("categoria"),
        orderBy("orden")
      );

      suscripcionProductos = onSnapshot(productosQuery, (snapshot) => {
        productosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        aplicarFiltroAdmin();
        actualizarListaCategorias();
      }, (error) => {
        console.error("Error en productos:", error);
      });
    }

    if (!suscripcionPedidos) {
      const pedidosQuery = query(collection(db, "pedidos"), orderBy("creadoEn", "desc"));

      suscripcionPedidos = onSnapshot(pedidosQuery, (snapshot) => {
        pedidosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderPedidos();
      }, (err) => {
        console.error("Error en pedidos:", err);
      });
    }

  } else {
    // Si no está logueado, destruimos ganchos activos para evitar fugas de memoria y bloqueos
    if (suscripcionProductos) {
      suscripcionProductos();
      suscripcionProductos = null;
    }
    if (suscripcionPedidos) {
      suscripcionPedidos();
      suscripcionPedidos = null;
    }

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
    btnRenombrar.type = "button";
    btnRenombrar.className = "icon-btn";
    btnRenombrar.textContent = "Renombrar";
    btnRenombrar.addEventListener("click", () => abrirModalRenombrar(cat));
    actions.appendChild(btnRenombrar);

    const btnEliminarCat = document.createElement("button");
    btnEliminarCat.type = "button";
    btnEliminarCat.className = "icon-btn";
    btnEliminarCat.textContent = "Eliminar";
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
  renombrarNuevo.focus();
  renombrarNuevo.select();
}

if (btnCancelarRenombrar) {
  btnCancelarRenombrar.addEventListener("click", () => {
    modalRenombrar.classList.add("hidden");
    categoriaEnRenombrado = null;
  });
}

if (btnConfirmarRenombrar) {
  btnConfirmarRenombrar.addEventListener("click", async () => {
    const nuevoNombre = renombrarNuevo.value.trim();
    if (!nuevoNombre) {
      renombrarError.textContent = "El nombre no puede estar vacío.";
      return;
    }
    if (nuevoNombre === categoriaEnRenombrado) {
      modalRenombrar.classList.add("hidden");
      return;
    }

    btnConfirmarRenombrar.disabled = true;
    btnConfirmarRenombrar.textContent = "Actualizando…";
    renombrarError.textContent = "";

    try {
      const productosAfectados = productosCache.filter(
        (p) => p.categoria === categoriaEnRenombrado
      );
      for (const p of productosAfectados) {
        await updateDoc(doc(db, "productos", p.id), { categoria: nuevoNombre });
      }
      modalRenombrar.classList.add("hidden");
      categoriaEnRenombrado = null;
    } catch (err) {
      console.error(err);
      renombrarError.textContent = "No se pudo renombrar. Probá de nuevo.";
    } finally {
      btnConfirmarRenombrar.disabled = false;
      btnConfirmarRenombrar.textContent = "Renombrar";
    }
  });
}

async function eliminarCategoria(cat) {
  const cantidad = productosCache.filter((p) => p.categoria === cat).length;
  const mensaje =
    cantidad > 0
      ? `¿Eliminar la categoría "${cat}"? Tiene ${cantidad} producto${cantidad !== 1 ? "s" : ""} que quedarán sin categoría.`
      : `¿Eliminar la categoría "${cat}"?`;

  if (!confirm(mensaje)) return;

  try {
    const productosAfectados = productosCache.filter((p) => p.categoria === cat);
    for (const p of productosAfectados) {
      await updateDoc(doc(db, "productos", p.id), { categoria: "" });
    }
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar la categoría. Probá de nuevo.");
  }
}
