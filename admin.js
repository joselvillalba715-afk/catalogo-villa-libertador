import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
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

const formNuevo = document.getElementById("form-nuevo");
const nuevoError = document.getElementById("nuevo-error");
const nPromoCheckbox = document.getElementById("n-promo");
const nPromoFields = document.getElementById("n-promo-fields");

const listaProductos = document.getElementById("lista-productos");
const listaVacia = document.getElementById("lista-vacia");

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

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginCard.classList.add("hidden");
    adminShell.classList.remove("hidden");
  } else {
    loginCard.classList.remove("hidden");
    adminShell.classList.add("hidden");
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

// ---------- Listado en tiempo real ----------
let productosCache = [];

const productosQuery = query(
  collection(db, "productos"),
  orderBy("categoria"),
  orderBy("orden")
);

onSnapshot(productosQuery, (snapshot) => {
  productosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderLista();
  actualizarListaCategorias();
});

function actualizarListaCategorias() {
  const datalist = document.getElementById("lista-categorias");
  const categorias = [...new Set(productosCache.map((p) => p.categoria).filter(Boolean))];
  categorias.sort((a, b) => a.localeCompare(b, "es"));
  datalist.innerHTML = "";
  for (const cat of categorias) {
    const option = document.createElement("option");
    option.value = cat;
    datalist.appendChild(option);
  }
}

function renderLista() {
  listaProductos.innerHTML = "";
  listaVacia.classList.toggle("hidden", productosCache.length > 0);

  for (const p of productosCache) {
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
      // Intentamos borrar la imagen asociada (si falla, no es grave)
      const extension = p.imagenUrl.split("?")[0].split(".").pop();
      try {
        await deleteObject(ref(storage, `productos/${p.id}.${extension}`));
      } catch (err) {
        // La imagen puede tener otro nombre o ya no existir; lo ignoramos
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
const btnExportarPedidos = document.getElementById("btn-exportar-pedidos");

let pedidosCache = [];

const pedidosQuery = query(collection(db, "pedidos"), orderBy("creadoEn", "desc"));

onSnapshot(
  pedidosQuery,
  (snapshot) => {
    pedidosCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPedidos();
  },
  (err) => {
    console.error(err);
  }
);

function formatearFechaHora(timestamp) {
  if (!timestamp || !timestamp.toDate) return "—";
  const fecha = timestamp.toDate();
  const fechaStr = fecha.toLocaleDateString("es-AR");
  const horaStr = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fechaStr} · ${horaStr}`;
}

function renderPedidos() {
  listaPedidos.innerHTML = "";
  pedidosVacio.classList.toggle("hidden", pedidosCache.length > 0);

  for (const pedido of pedidosCache) {
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

btnExportarPedidos.addEventListener("click", () => {
  if (pedidosCache.length === 0) {
    alert("No hay pedidos para exportar.");
    return;
  }

  const filas = [
    ["Fecha", "Hora", "Cliente", "WhatsApp", "Producto", "Cantidad", "Precio unitario", "Subtotal", "Total del pedido"],
  ];

  for (const pedido of pedidosCache) {
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
