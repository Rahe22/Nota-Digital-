// =============================================
// NOTA DE REMISIÓN — script.js (Blindado y compatible 100%)
// =============================================

let notaActual = null;
let notas = [];
let catalogo = [];
let config = {
  nombre: '',
  mensaje: 'Gracias por su compra.',
  folioInicial: 1,
  logoUrl: ''
};
let gastos = [];

let gastoCategoriaActual = '⛽ Combustible';
let gastoFiltroMes = new Date().toISOString().substring(0, 7);
let filtroHistorialActual = 'todas';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ─────────────────────────────────────────────
// UTILIDADES SEGURAS
// ─────────────────────────────────────────────

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setVal(id, val) {
  const el = $(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

function setShow(id, visible, displayType) {
  const el = $(id);
  if (el) el.style.display = visible ? (displayType || 'flex') : 'none';
}

function on(id, evento, fn) {
  const el = $(id);
  if (el) el.addEventListener(evento, fn);
}

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatCurrency(valor) {
  const num = parseFloat(valor) || 0;
  return num.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });
}

function formatDate(fecha) {
  if (!fecha) return '--/--/----';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function construirFecha(dia, mes, anio) {
  return new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
}

function escapeHtml(t) {
  return String(t || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function limpiarNumero(t) {
  const clean = String(t || '').replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  return clean;
}

function mostrarToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2800);
}

// ─────────────────────────────────────────────
// PERSISTENCIA (localStorage)
// ─────────────────────────────────────────────

function cargarDatos() {
  try {
    const n = localStorage.getItem('nr_notas');
    const c = localStorage.getItem('nr_catalogo');
    const cf = localStorage.getItem('nr_config');
    const na = localStorage.getItem('nr_notaActual');
    const g = localStorage.getItem('nr_gastos');

    notas = n ? JSON.parse(n) : [];
    catalogo = c ? JSON.parse(c) : [];
    gastos = g ? JSON.parse(g) : [];
    if (cf) config = Object.assign({}, config, JSON.parse(cf));
    notaActual = na ? JSON.parse(na) : null;
  } catch (err) {
    console.error('Error leyendo localStorage:', err);
    notas = Array.isArray(notas) ? notas : [];
    catalogo = Array.isArray(catalogo) ? catalogo : [];
    gastos = Array.isArray(gastos) ? gastos : [];
    notaActual = null;
  }

  if (!Array.isArray(notas)) notas = [];
  if (!Array.isArray(catalogo)) catalogo = [];
  if (!Array.isArray(gastos)) gastos = [];
}

function guardarNotas() {
  localStorage.setItem('nr_notas', JSON.stringify(notas));
}

function guardarCatalogo() {
  localStorage.setItem('nr_catalogo', JSON.stringify(catalogo));
}

function guardarGastos() {
  localStorage.setItem('nr_gastos', JSON.stringify(gastos));
}

function guardarConfig() {
  const nomEl = $('configNombre');
  const msgEl = $('configMensaje');
  const folEl = $('configFolio');
  const logoEl = $('configLogoUrl');

  if (nomEl) config.nombre = nomEl.value;
  if (msgEl) config.mensaje = msgEl.value;
  if (folEl) config.folioInicial = parseInt(folEl.value, 10) || 1;
  if (logoEl) config.logoUrl = logoEl.value;

  localStorage.setItem('nr_config', JSON.stringify(config));
  actualizarLogoDisplay();
  mostrarToast('Configuración guardada ✓');
}

function guardarNotaActual() {
  if (notaActual) {
    localStorage.setItem('nr_notaActual', JSON.stringify(notaActual));
  }
}

// ─────────────────────────────────────────────
// CREAR Y CARGAR NOTA
// ─────────────────────────────────────────────

function nuevaFila() {
  return { id: generarId(), cantidad: '', precioUnitario: '', descripcion: '' };
}

function crearNuevaNota() {
  const maxFolio = notas.reduce(function(max, n) {
    return Math.max(max, parseInt(n && n.numero, 10) || 0);
  }, (parseInt(config.folioInicial, 10) || 1) - 1);

  notaActual = {
    id: generarId(),
    numero: maxFolio + 1,
    cobrada: false,
    stockDescontado: false,
    facturada: false,
    ivaActivo: false,
    metodoPago: 'efectivo',
    anticipo: '',
    observaciones: '',
    logoUri: config.logoUrl || '',
    cliente: {
      nombre: '',
      telefono: '',
      vendedor: '',
      direccion: '',
      email: '',
      fecha: new Date().toISOString()
    },
    productos: [nuevaFila()],
    datosFactura: null
  };

  guardarNotaActual();
  cargarNotaEnEditor(notaActual);
}

function normalizarEstructuraNota(nota) {
  if (!nota || typeof nota !== 'object') {
    crearNuevaNota();
    return notaActual;
  }
  if (!nota.cliente || typeof nota.cliente !== 'object') {
    nota.cliente = {
      nombre: '',
      telefono: '',
      vendedor: '',
      direccion: '',
      email: '',
      fecha: new Date().toISOString()
    };
  }
  if (!Array.isArray(nota.productos) || nota.productos.length === 0) {
    nota.productos = [nuevaFila()];
  }
  return nota;
}

function cargarNotaEnEditor(nota) {
  notaActual = normalizarEstructuraNota(nota);

  setText('notaNumBadge', 'No. ' + String(notaActual.numero || 1).padStart(4, '0'));
  setShow('cobradaBadge', !!notaActual.cobrada, 'flex');
  setShow('cobradaBanner', !!notaActual.cobrada, 'flex');

  setVal('clienteNombre', notaActual.cliente.nombre || '');
  setVal('clienteTelefono', notaActual.cliente.telefono || '');
  setVal('clienteVendedor', notaActual.cliente.vendedor || '');
  setVal('clienteDireccion', notaActual.cliente.direccion || '');
  setVal('clienteEmail', notaActual.cliente.email || '');

  setText('fechaTexto', formatDate(notaActual.cliente.fecha));
  const fechaInput = $('clienteFecha');
  if (fechaInput && notaActual.cliente.fecha) {
    const d = new Date(notaActual.cliente.fecha);
    if (!isNaN(d.getTime())) fechaInput.value = d.toISOString().split('T')[0];
  }

  const ivaToggle = $('ivaToggle');
  if (ivaToggle) ivaToggle.checked = !!notaActual.ivaActivo;
  actualizarSeccionIva();

  if (notaActual.datosFactura) {
    setVal('fiscalRFC', notaActual.datosFactura.rfc || '');
    setVal('fiscalRegimen', notaActual.datosFactura.regimenFiscal || '');
    setVal('fiscalCP', notaActual.datosFactura.codigoPostal || '');
  } else {
    setVal('fiscalRFC', '');
    setVal('fiscalRegimen', '');
    setVal('fiscalCP', '');
  }

  const factToggle = $('facturadaToggle');
  if (factToggle) factToggle.checked = !!notaActual.facturada;
  actualizarFacuturadaDisplay();

  const btnEf = $('btnEfectivo');
  const btnTr = $('btnTransferencia');
  if (btnEf) btnEf.classList.toggle('active', notaActual.metodoPago !== 'transferencia');
  if (btnTr) btnTr.classList.toggle('active', notaActual.metodoPago === 'transferencia');

  setVal('anticipoInput', notaActual.anticipo || '');
  setVal('observaciones', notaActual.observaciones || '');

  renderizarProductos();
  recalcularTotales();
  actualizarLogoDisplay();
  actualizarEstadoCobrada();
}

function actualizarLogoDisplay() {
  const url = (notaActual && notaActual.logoUri) || config.logoUrl;
  const logoImg = $('logoImg');
  const logoPlaceholder = $('logoPlaceholder');
  if (!logoImg || !logoPlaceholder) return;

  if (url) {
    logoImg.src = url;
    logoImg.style.display = 'block';
    logoPlaceholder.style.display = 'none';
  } else {
    logoImg.style.display = 'none';
    logoPlaceholder.style.display = 'flex';
  }
}

// ─────────────────────────────────────────────
// PRODUCTOS EN LA NOTA
// ─────────────────────────────────────────────

function renderizarProductos() {
  const contenedor = $('productosContainer');
  if (!contenedor || !notaActual) return;
  contenedor.innerHTML = '';

  notaActual.productos.forEach(function(prod) {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.dataset.id = prod.id;

    const subtotal = calcSubtotalFila(prod);

    div.innerHTML =
      '<div class="fila-top-row">' +
        '<input type="text" class="celda-cantidad" value="' + escapeHtml(prod.cantidad) + '" placeholder="0" inputmode="decimal" data-field="cantidad">' +
        '<input type="text" class="celda-precio" value="' + escapeHtml(prod.precioUnitario) + '" placeholder="0.00" inputmode="decimal" data-field="precioUnitario">' +
        '<span class="celda-subtotal">' + formatCurrency(subtotal) + '</span>' +
        '<button type="button" class="btn-star" title="Guardar en catálogo" data-id="' + prod.id + '">⭐</button>' +
        '<button type="button" class="btn-delete-fila" title="Eliminar fila" data-id="' + prod.id + '">🗑</button>' +
      '</div>' +
      '<div class="sugerencias-wrapper"></div>' +
      '<input type="text" class="celda-descripcion" value="' + escapeHtml(prod.descripcion) + '" placeholder="Descripción del producto o servicio" data-field="descripcion">';

    div.querySelector('[data-field="cantidad"]').addEventListener('input', function(e) {
      const val = limpiarNumero(e.target.value);
      e.target.value = val;
      cambiarCampoProd(prod.id, 'cantidad', val);
    });

    div.querySelector('[data-field="precioUnitario"]').addEventListener('input', function(e) {
      const val = limpiarNumero(e.target.value);
      e.target.value = val;
      cambiarCampoProd(prod.id, 'precioUnitario', val);
    });

    div.querySelector('[data-field="descripcion"]').addEventListener('input', function(e) {
      cambiarCampoProd(prod.id, 'descripcion', e.target.value);
      mostrarSugerencias(prod.id, e.target.value, div.querySelector('.sugerencias-wrapper'));
    });

    div.querySelector('.btn-star').addEventListener('click', function() {
      const p = obtenerFila(prod.id);
      if (!p || !p.descripcion || !p.descripcion.trim()) return;
      agregarAlCatalogo(p.descripcion.trim(), p.precioUnitario);
      mostrarToast('"' + p.descripcion.trim() + '" guardado en catálogo ⭐');
    });

    div.querySelector('.btn-delete-fila').addEventListener('click', function() {
      eliminarFila(prod.id);
    });

    contenedor.appendChild(div);
  });

  actualizarEstadoCobrada();
}

function obtenerFila(id) {
  return notaActual.productos.find(function(p) { return p.id === id; });
}

function cambiarCampoProd(id, campo, valor) {
  notaActual.productos = notaActual.productos.map(function(p) {
    return p.id === id ? Object.assign({}, p, { [campo]: valor }) : p;
  });

  const fila = document.querySelector('.fila-producto[data-id="' + id + '"]');
  if (fila) {
    const prod = obtenerFila(id);
    const subEl = fila.querySelector('.celda-subtotal');
    if (prod && subEl) {
      subEl.textContent = formatCurrency(calcSubtotalFila(prod));
    }
  }
  recalcularTotales();
  guardarNotaActual();
}

function eliminarFila(id) {
  if (!notaActual || notaActual.cobrada || notaActual.productos.length <= 1) return;
  notaActual.productos = notaActual.productos.filter(function(p) { return p.id !== id; });
  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();
}

function agregarFila() {
  if (!notaActual) crearNuevaNota();
  if (notaActual.cobrada) {
    mostrarToast('Esta nota ya está cobrada (solo lectura)');
    return;
  }
  notaActual.productos.push(nuevaFila());
  renderizarProductos();
  guardarNotaActual();
  const filas = document.querySelectorAll('.celda-descripcion');
  if (filas.length) filas[filas.length - 1].focus();
}

// ─────────────────────────────────────────────
// SUGERENCIAS DE CATÁLOGO EN FILA
// ─────────────────────────────────────────────

function mostrarSugerencias(prodId, texto, wrapper) {
  if (!wrapper) return;
  wrapper.innerHTML = '';
  if (!texto || texto.trim().length < 2) return;

  const q = texto.trim().toLowerCase();
  const filtrados = catalogo
    .filter(function(p) { return p && p.nombre && p.nombre.toLowerCase().includes(q); })
    .sort(function(a, b) { return (b.vecesUsado || 0) - (a.vecesUsado || 0); })
    .slice(0, 5);

  if (!filtrados.length) return;

  const cont = document.createElement('div');
  cont.className = 'sugerencias-container';

  filtrados.forEach(function(p) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sugerencia-item';
    const stockInfo = p.stock !== undefined && p.stock !== null ? ' · Stock: ' + p.stock : '';
    btn.innerHTML =
      '<span>⭐</span>' +
      '<span class="sugerencia-nombre">' + escapeHtml(p.nombre) + '</span>' +
      (p.precioUnitario
        ? '<span class="sugerencia-precio">$' + parseFloat(p.precioUnitario).toFixed(2) + stockInfo + '</span>'
        : (stockInfo ? '<span class="sugerencia-precio">' + stockInfo + '</span>' : ''));

    btn.addEventListener('click', function() {
      aplicarSugerencia(prodId, p.nombre, p.precioUnitario, wrapper);
    });
    cont.appendChild(btn);
  });

  wrapper.appendChild(cont);
}

function aplicarSugerencia(prodId, nombre, precio, wrapper) {
  notaActual.productos = notaActual.productos.map(function(p) {
    if (p.id !== prodId) return p;
    return Object.assign({}, p, {
      descripcion: nombre,
      precioUnitario: precio || p.precioUnitario,
      cantidad: p.cantidad || '1'
    });
  });
  if (wrapper) wrapper.innerHTML = '';
  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();

  catalogo = catalogo.map(function(c) {
    return c.nombre === nombre ? Object.assign({}, c, { vecesUsado: (c.vecesUsado || 0) + 1 }) : c;
  });
  guardarCatalogo();
}

// ─────────────────────────────────────────────
// CATÁLOGO E INVENTARIO UNIDOS (CON EDICIÓN)
// ─────────────────────────────────────────────

function normalizarNombreProd(nombre) {
  return String(nombre || '').trim().toLowerCase();
}

function abrirCatalogo() {
  renderizarCatalogo();
  setShow('overlayCatalogo', true, 'flex');
}

function cerrarCatalogo() {
  setShow('overlayCatalogo', false);
}

function editarItemCatalogoInventario(id) {
  const item = catalogo.find(function(c) { return c.id === id; });
  if (!item) return;

  const nuevoNombre = prompt('Nombre del producto:', item.nombre);
  if (nuevoNombre === null) return;
  const nombreLimpio = nuevoNombre.trim();
  if (!nombreLimpio) {
    mostrarToast('⚠️ El nombre no puede quedar vacío');
    return;
  }

  const nuevoPrecioStr = prompt('Precio unitario ($):', item.precioUnitario || '0');
  if (nuevoPrecioStr === null) return;
  const precioLimpio = limpiarNumero(nuevoPrecioStr);

  const nuevoStockStr = prompt('Cantidad exacta en inventario:', String(parseFloat(item.stock) || 0));
  if (nuevoStockStr === null) return;
  const stockNum = parseFloat(limpiarNumero(nuevoStockStr));

  item.nombre = nombreLimpio;
  item.precioUnitario = precioLimpio;
  if (!isNaN(stockNum) && stockNum >= 0) {
    item.stock = stockNum;
  }

  guardarCatalogo();
  const overlayCat = $('overlayCatalogo');
  if (overlayCat && overlayCat.style.display === 'flex') {
    renderizarCatalogo();
  }
  renderizarInventario();
  mostrarToast('Producto actualizado ✓');
}

function renderizarCatalogo() {
  const busqEl = $('catalogoBusqueda');
  const busqueda = busqEl ? busqEl.value.trim().toLowerCase() : '';
  const lista = $('catalogoLista');
  if (!lista) return;

  let items = catalogo.slice().sort(function(a, b) {
    return (b.vecesUsado || 0) - (a.vecesUsado || 0);
  });

  if (busqueda) {
    items = items.filter(function(p) {
      return p && p.nombre && p.nombre.toLowerCase().includes(busqueda);
    });
  }

  setShow('catalogoBusquedaWrap', catalogo.length > 4, 'flex');
  lista.innerHTML = '';

  if (items.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'catalogo-empty';
    msg.innerHTML = catalogo.length === 0
      ? 'Aún no tienes productos guardados.<br>Agrega uno arriba.'
      : 'Sin resultados para esa búsqueda.';
    lista.appendChild(msg);
    return;
  }

  items.forEach(function(prod) {
    const div = document.createElement('div');
    div.className = 'catalogo-item';
    const stockTxt = prod.stock !== undefined && prod.stock !== null ? ' · Stock: ' + prod.stock : '';

    div.innerHTML =
      '<div class="catalogo-item-info">' +
        '<div class="catalogo-item-nombre">' + escapeHtml(prod.nombre) + '</div>' +
        '<div class="catalogo-item-meta">' +
          (prod.vecesUsado > 1 ? 'Usado ' + prod.vecesUsado + ' veces' : 'Nuevo') +
          (prod.precioUnitario ? ' · $' + parseFloat(prod.precioUnitario).toFixed(2) : '') +
          stockTxt +
        '</div>' +
      '</div>' +
      '<button type="button" class="btn-cat-add" title="Agregar a la nota">+</button>' +
      '<button type="button" class="btn-cat-edit" title="Editar producto" style="background:none;border:none;cursor:pointer;font-size:1rem;padding:4px 6px;">✏️</button>' +
      '<button type="button" class="btn-cat-delete" title="Eliminar del catálogo">🗑</button>';

    div.querySelector('.btn-cat-add').addEventListener('click', function() {
      seleccionarDeCatalogo(prod.nombre, prod.precioUnitario);
      cerrarCatalogo();
    });

    div.querySelector('.btn-cat-edit').addEventListener('click', function() {
      editarItemCatalogoInventario(prod.id);
    });

    div.querySelector('.btn-cat-delete').addEventListener('click', function() {
      if (confirm('¿Eliminar "' + prod.nombre + '" del catálogo e inventario?')) {
        catalogo = catalogo.filter(function(c) { return c.id !== prod.id; });
        guardarCatalogo();
        renderizarCatalogo();
        renderizarInventario();
      }
    });

    lista.appendChild(div);
  });
}

function agregarAlCatalogo(nombre, precio, stockOpcional) {
  const existe = catalogo.find(function(c) {
    return normalizarNombreProd(c.nombre) === normalizarNombreProd(nombre);
  });
  const tieneStock = stockOpcional !== undefined && stockOpcional !== '' && !isNaN(parseFloat(stockOpcional));

  if (existe) {
    existe.vecesUsado = (existe.vecesUsado || 0) + 1;
    if (precio) existe.precioUnitario = precio;
    if (tieneStock) existe.stock = Math.max(0, parseFloat(stockOpcional));
  } else {
    catalogo.push({
      id: generarId(),
      nombre: nombre,
      precioUnitario: precio || '',
      stock: tieneStock ? Math.max(0, parseFloat(stockOpcional)) : 0,
      vecesUsado: 1
    });
  }
  guardarCatalogo();
}

function accionAgregarAlCatalogo() {
  const nombreEl = $('catalogoNombreInput');
  const precioEl = $('catalogoPrecioInput');
  const stockEl = $('catalogoStockInput');

  const nombre = nombreEl ? nombreEl.value.trim() : '';
  const precio = precioEl ? limpiarNumero(precioEl.value.trim()) : '';
  const stockVal = stockEl ? stockEl.value : '';

  if (!nombre) return;
  agregarAlCatalogo(nombre, precio, stockVal);

  if (nombreEl) nombreEl.value = '';
  if (precioEl) precioEl.value = '';
  if (stockEl) stockEl.value = '';

  renderizarCatalogo();
  renderizarInventario();
  mostrarToast('"' + nombre + '" agregado al catálogo ✓');
}

function seleccionarDeCatalogo(nombre, precio) {
  if (notaActual.cobrada) {
    mostrarToast('Nota cobrada · Solo lectura');
    return;
  }

  const filaVacia = notaActual.productos.find(function(p) {
    return !p.descripcion && !p.cantidad && !p.precioUnitario;
  });

  if (filaVacia) {
    notaActual.productos = notaActual.productos.map(function(p) {
      return p.id === filaVacia.id
        ? Object.assign({}, p, { descripcion: nombre, precioUnitario: precio || '', cantidad: '1' })
        : p;
    });
  } else {
    const f = nuevaFila();
    f.descripcion = nombre;
    f.precioUnitario = precio || '';
    f.cantidad = '1';
    notaActual.productos.push(f);
  }

  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();

  const enCat = catalogo.find(function(c) {
    return normalizarNombreProd(c.nombre) === normalizarNombreProd(nombre);
  });
  if (enCat) {
    enCat.vecesUsado = (enCat.vecesUsado || 0) + 1;
    guardarCatalogo();
  }
}

function sincronizarStockEnCatalogo(nombre, stockValor, precioOpcional) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return;
  const stockNum = Math.max(0, parseFloat(stockValor) || 0);
  const precioNum = precioOpcional !== undefined && precioOpcional !== ''
    ? limpiarNumero(precioOpcional)
    : '';

  const existe = catalogo.find(function(c) {
    return normalizarNombreProd(c.nombre) === normalizarNombreProd(limpio);
  });

  if (existe) {
    existe.stock = stockNum;
    if (precioNum !== '') existe.precioUnitario = precioNum;
  } else {
    catalogo.push({
      id: generarId(),
      nombre: limpio,
      precioUnitario: precioNum,
      stock: stockNum,
      vecesUsado: 0
    });
  }
  guardarCatalogo();
}

function accionGuardarInventario() {
  const nombreEl = $('invNombreInput');
  const stockEl = $('invStockInput');
  const precioEl = $('invPrecioInput');

  const nombre = nombreEl ? nombreEl.value.trim() : '';
  const stockRaw = stockEl ? stockEl.value : '';
  const precio = precioEl ? limpiarNumero(precioEl.value.trim()) : '';

  if (!nombre) {
    mostrarToast('⚠️ Escribe el nombre del producto');
    return;
  }
  if (stockRaw === '' || isNaN(parseFloat(stockRaw)) || parseFloat(stockRaw) < 0) {
    mostrarToast('⚠️ Indica una cantidad válida de inventario');
    return;
  }

  sincronizarStockEnCatalogo(nombre, parseFloat(stockRaw), precio);

  if (nombreEl) nombreEl.value = '';
  if (stockEl) stockEl.value = '';
  if (precioEl) precioEl.value = '';

  renderizarInventario();
  mostrarToast('Inventario actualizado y vinculado al catálogo ✓');
}

function ajustarStockItem(id, delta) {
  catalogo = catalogo.map(function(c) {
    if (c.id !== id) return c;
    const actual = parseFloat(c.stock) || 0;
    return Object.assign({}, c, { stock: Math.max(0, actual + delta) });
  });
  guardarCatalogo();
  renderizarInventario();
}

function renderizarInventario() {
  const lista = $('inventarioLista');
  if (!lista) return;
  lista.innerHTML = '';

  const items = catalogo.slice().sort(function(a, b) {
    return (a.nombre || '').localeCompare(b.nombre || '', 'es');
  });

  if (!items.length) {
    lista.innerHTML = '<div class="historial-empty">📦<br>No hay productos en inventario.<br>Agrega uno arriba (ej. Blanco con 30).</div>';
    return;
  }

  items.forEach(function(item) {
    const stock = parseFloat(item.stock) || 0;
    const precioTxt = item.precioUnitario ? formatCurrency(item.precioUnitario) : 'Sin precio';
    const card = document.createElement('div');
    card.className = 'inv-card';

    card.innerHTML =
      '<div class="inv-card-top">' +
        '<span class="inv-card-nombre">' + escapeHtml(item.nombre) + '</span>' +
        '<span class="inv-stock-badge ' + (stock <= 0 ? 'bajo' : '') + '">' + stock + ' pzs</span>' +
      '</div>' +
      '<div class="catalogo-item-meta">Precio catálogo: ' + precioTxt + '</div>' +
      '<div class="inv-card-actions">' +
        '<button type="button" class="btn-card-action btn-menos">-1</button>' +
        '<button type="button" class="btn-card-action btn-mas">+1</button>' +
        '<button type="button" class="btn-card-action btn-sumar-lote">+10</button>' +
        '<button type="button" class="btn-card-action btn-editar-inv">✏️ Editar</button>' +
      '</div>';

    card.querySelector('.btn-menos').addEventListener('click', function() {
      ajustarStockItem(item.id, -1);
    });
    card.querySelector('.btn-mas').addEventListener('click', function() {
      ajustarStockItem(item.id, 1);
    });
    card.querySelector('.btn-sumar-lote').addEventListener('click', function() {
      ajustarStockItem(item.id, 10);
    });
    card.querySelector('.btn-editar-inv').addEventListener('click', function() {
      editarItemCatalogoInventario(item.id);
    });

    lista.appendChild(card);
  });
}

function descontarInventarioPorNota(nota) {
  if (!nota || !Array.isArray(nota.productos)) return;

  const consumos = new Map();
  nota.productos.forEach(function(p) {
    const key = normalizarNombreProd(p.descripcion);
    const cant = parseFloat(p.cantidad) || 0;
    if (!key || cant <= 0) return;
    consumos.set(key, (consumos.get(key) || 0) + cant);
  });

  if (!consumos.size) return;

  let huboDescuento = false;
  catalogo = catalogo.map(function(item) {
    const key = normalizarNombreProd(item.nombre);
    if (!consumos.has(key)) return item;
    huboDescuento = true;
    const stockActual = parseFloat(item.stock) || 0;
    const restar = consumos.get(key);
    return Object.assign({}, item, {
      stock: Math.max(0, stockActual - restar)
    });
  });

  if (huboDescuento) {
    guardarCatalogo();
  }
}

// ─────────────────────────────────────────────
// CÁLCULOS E IVA
// ─────────────────────────────────────────────

function calcSubtotalFila(prod) {
  const cant = parseFloat(prod.cantidad) || 0;
  const precio = parseFloat(prod.precioUnitario) || 0;
  return cant * precio;
}

function calcSubtotalGeneral() {
  return notaActual.productos.reduce(function(sum, p) {
    return sum + calcSubtotalFila(p);
  }, 0);
}

function calcIVA(subtotal, ivaActivo) {
  return ivaActivo ? subtotal * 0.16 : 0;
}

function calcTotal(subtotal, ivaActivo) {
  return subtotal + calcIVA(subtotal, ivaActivo);
}

function calcSaldo(total, anticipo) {
  const ant = parseFloat(anticipo) || 0;
  return Math.max(0, total - ant);
}

function recalcularTotales() {
  const subtotal = calcSubtotalGeneral();
  const iva = calcIVA(subtotal, notaActual.ivaActivo);
  const total = calcTotal(subtotal, notaActual.ivaActivo);
  const saldo = calcSaldo(total, notaActual.anticipo);
  const anticipo = parseFloat(notaActual.anticipo) || 0;

  setText('totalSubtotal', formatCurrency(subtotal));
  const ivaEl = $('totalIva');
  if (ivaEl) {
    ivaEl.textContent = formatCurrency(iva);
    ivaEl.style.color = notaActual.ivaActivo ? '#1a1a2e' : '#aaa';
  }
  setText('totalFinal', formatCurrency(total));

  const saldoRow = $('saldoRow');
  const saldoLabel = $('saldoLabel');
  const saldoValue = $('saldoValue');

  if (saldoRow && saldoLabel && saldoValue) {
    if (anticipo > 0) {
      saldoRow.style.display = 'flex';
      if (saldo > 0) {
        saldoLabel.textContent = 'SALDO PENDIENTE';
        saldoLabel.style.color = '#e74c3c';
        saldoValue.textContent = formatCurrency(saldo);
        saldoValue.style.color = '#e74c3c';
        saldoRow.style.backgroundColor = '#FFF5F5';
      } else {
        saldoLabel.textContent = '✓ SALDO LIQUIDADO';
        saldoLabel.style.color = '#27ae60';
        saldoValue.textContent = formatCurrency(0);
        saldoValue.style.color = '#27ae60';
        saldoRow.style.backgroundColor = '#E8F8EF';
      }
    } else {
      saldoRow.style.display = 'none';
    }
  }

  actualizarSubtextCobrar(total);
  actualizarBadgePendientes();
}

function actualizarSubtextCobrar(total) {
  const el = $('cobrarSubtext');
  if (!el) return;
  const total2 = total !== undefined ? total : calcTotal(calcSubtotalGeneral(), notaActual.ivaActivo);

  if (notaActual.cobrada) {
    el.textContent = 'Nota cobrada · Toca para reimprimir o compartir';
  } else {
    el.textContent = 'Total a cobrar: ' + formatCurrency(total2);
  }
}

function verificarIvaOk() {
  return true;
}

function actualizarSeccionIva() {
  const activo = !!notaActual.ivaActivo;
  setShow('fiscalContainer', activo, 'flex');
  setText('ivaLabel', activo ? 'I.V.A. (16%)' : 'I.V.A. (desactivado)');
  actualizarFiscalWarning();
}

function actualizarFiscalWarning() {
  setShow('fiscalWarning', false);
}

function actualizarFacuturadaDisplay() {
  const check = $('facturadaCheck');
  const label = $('facturadaLabel');
  if (!check || !label) return;
  if (notaActual.facturada) {
    check.textContent = '✅';
    label.textContent = 'Ya fue facturada al SAT';
    label.style.color = '#27ae60';
    label.style.fontWeight = '600';
  } else {
    check.textContent = '○';
    label.textContent = '¿Ya se facturó esta nota?';
    label.style.color = '#555';
    label.style.fontWeight = '400';
  }
}

function actualizarEstadoCobrada() {
  if (!notaActual) return;
  const cobrada = !!notaActual.cobrada;
  const campos = document.querySelectorAll('.campo-input, .celda-descripcion, .celda-cantidad, .celda-precio, .observaciones-input, .anticipo-input');

  campos.forEach(function(el) {
    if (cobrada) {
      el.setAttribute('readonly', true);
      el.style.backgroundColor = '#F4F6FA';
      el.style.color = '#888';
    } else {
      el.removeAttribute('readonly');
      el.style.backgroundColor = '';
      el.style.color = '';
    }
  });

  setShow('btnGuardarPendiente', !cobrada, 'flex');
  const btnCobrar = $('btnCobrar');
  if (btnCobrar) {
    btnCobrar.innerHTML = cobrada ? '🔄 REIMPRIMIR / IMPRIMIR TICKET' : '🖨️ COBRAR E IMPRIMIR';
  }
}

function actualizarBadgePendientes() {
  const pendientes = notas.filter(function(n) { return n && !n.cobrada; }).length;
  if (pendientes > 0) {
    setShow('badgeContainer', true, 'flex');
    setText('navbarBadge', pendientes);
    setShow('menuBadge', true, 'flex');
    setText('menuBadge', pendientes);
    setText('menuPendientesSub', pendientes + ' pendiente' + (pendientes !== 1 ? 's' : ''));
  } else {
    setShow('badgeContainer', false);
    setShow('menuBadge', false);
    setText('menuPendientesSub', 'Sin pendientes');
  }
}

// ─────────────────────────────────────────────
// PENDIENTES, COBRO, IMPRESIÓN 58MM Y WHATSAPP
// ─────────────────────────────────────────────

function accionGuardarPendiente() {
  const tieneNombre = notaActual.cliente && notaActual.cliente.nombre && notaActual.cliente.nombre.trim().length > 0;
  const tieneProducto = notaActual.productos.some(function(p) {
    return p.descripcion && p.descripcion.trim().length > 0;
  });

  if (!tieneNombre && !tieneProducto) {
    mostrarToast('Agrega el nombre del cliente o un producto primero');
    return;
  }

  const copia = JSON.parse(JSON.stringify(notaActual));
  copia.cobrada = false;

  const idx = notas.findIndex(function(n) { return n.id === copia.id; });
  if (idx >= 0) notas[idx] = copia;
  else notas.push(copia);

  guardarNotas();
  const num = String(copia.numero).padStart(4, '0');
  mostrarToast('Nota #' + num + ' guardada como "Por Cobrar" ✓');
  crearNuevaNota();
}

function accionCobrar() {
  const esReimpresion = !!notaActual.cobrada;

  if (!esReimpresion) {
    notaActual.cobrada = true;
    const copia = JSON.parse(JSON.stringify(notaActual));
    const idx = notas.findIndex(function(n) { return n.id === copia.id; });
    if (idx >= 0) notas[idx] = copia;
    else notas.push(copia);

    guardarNotas();
    descontarInventarioPorNota(notaActual);

    setShow('cobradaBadge', true, 'flex');
    setShow('cobradaBanner', true, 'flex');
    actualizarEstadoCobrada();
    actualizarBadgePendientes();
    recalcularTotales();

    const num = String(notaActual.numero).padStart(4, '0');
    mostrarToast('Nota #' + num + ' cobrada ✓');
  }

  const textoParaTicketera = generarTextoTicketPlano();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textoParaTicketera).then(function() {
      alert("¡Nota copiada con éxito!\n\nAl darle 'Aceptar', se abrirá tu app de impresión. Deja presionado el cuadro blanco del centro, dale 'Pegar' y presiona el botón 'Print Text' para sacar el ticket.");
      window.location.href = "posprinter://";
    }).catch(function() {
      imprimirTicket58mm();
    });
  } else {
    imprimirTicket58mm();
  }

  compartirNota();

  if (!esReimpresion) {
    setTimeout(function() { crearNuevaNota(); }, 1200);
  }
}

function generarTextoTicketPlano() {
  const MAX_CARACTERES = 32;
  const centrar = function(t) {
    if (t.length >= MAX_CARACTERES) return t.substring(0, MAX_CARACTERES);
    return " ".repeat(Math.floor((MAX_CARACTERES - t.length) / 2)) + t;
  };
  const alinear = function(izq, der) {
    const disponible = MAX_CARACTERES - der.length;
    if (izq.length >= disponible) return izq.substring(0, disponible - 1) + " " + der;
    return izq + " ".repeat(disponible - izq.length) + der;
  };

  const subtotal = calcSubtotalGeneral();
  const total = calcTotal(subtotal, notaActual.ivaActivo);
  const iva = calcIVA(subtotal, notaActual.ivaActivo);
  const anticipo = parseFloat(notaActual.anticipo) || 0;
  const saldo = calcSaldo(total, notaActual.anticipo);
  const productos = notaActual.productos.filter(function(p) { return p.descripcion && p.descripcion.trim(); });

  let t = "";
  t += centrar(config.nombre || "MEGASERIGRAFICA") + "\n";
  t += centrar("Nota de Remision") + "\n";
  t += centrar("Folio: " + String(notaActual.numero).padStart(4, '0')) + "\n";
  t += centrar("Fecha: " + formatDate(notaActual.cliente.fecha)) + "\n";
  t += "--------------------------------\n";
  t += "Cliente: " + (notaActual.cliente.nombre || "Público en General").toUpperCase() + "\n";
  if (notaActual.cliente.telefono) t += "Tel: " + notaActual.cliente.telefono + "\n";
  t += "--------------------------------\n";

  productos.forEach(function(p) {
    const cant = parseFloat(p.cantidad) || 1;
    const precio = parseFloat(p.precioUnitario) || 0;
    t += p.descripcion.toUpperCase() + "\n";
    t += alinear("  " + cant + " x $" + precio.toFixed(2), "$" + (cant * precio).toFixed(2)) + "\n";
  });

  t += "--------------------------------\n";
  t += alinear("SUBTOTAL:", "$" + subtotal.toFixed(2)) + "\n";
  if (notaActual.ivaActivo) t += alinear("I.V.A. (16%):", "$" + iva.toFixed(2)) + "\n";
  t += alinear("TOTAL:", "$" + total.toFixed(2)) + "\n";

  if (anticipo > 0) {
    t += alinear("ANTICIPO:", "$" + anticipo.toFixed(2)) + "\n";
    t += alinear(saldo > 0 ? "SALDO PEND:" : "✓ LIQUIDADO:", "$" + saldo.toFixed(2)) + "\n";
  }
  t += "--------------------------------\n";
  t += "Pago: " + (notaActual.metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo') + "\n\n";
  t += centrar(config.mensaje || "¡Gracias por su compra!") + "\n\n\n\n";
  return t;
}

function imprimirTicket58mm() {
  const subtotal = calcSubtotalGeneral();
  const total = calcTotal(subtotal, notaActual.ivaActivo);
  const iva = calcIVA(subtotal, notaActual.ivaActivo);
  const anticipo = parseFloat(notaActual.anticipo) || 0;
  const saldo = calcSaldo(total, notaActual.anticipo);
  const productos = notaActual.productos.filter(function(p) { return p.descripcion && p.descripcion.trim(); });

  let iframe = $('ticketPrintIframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'ticketPrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow.document;
  doc.open();

  let html = '<html><head><style>' +
    '@page { margin: 0; }' +
    'body { font-family: "Courier New", Courier, monospace; font-size: 12px; width: 260px; margin: 0; padding: 10px; color: #000; background: #fff; line-height: 1.4; }' +
    '.center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; }' +
    '.linea { border-top: 1px dashed #000; margin: 8px 0; } .flex-row { display: flex; justify-content: space-between; }' +
    '</style></head><body>';

  html += '<div class="center bold" style="font-size:14px;">' + escapeHtml(config.nombre || 'MEGASERIGRAFICA') + '</div>';
  html += '<div class="center">Nota de Remision</div>';
  html += '<div class="center">Folio: ' + String(notaActual.numero).padStart(4, '0') + '</div>';
  html += '<div class="center">Fecha: ' + formatDate(notaActual.cliente.fecha) + '</div>';
  html += '<div class="linea"></div>';
  html += '<div><span class="bold">Cliente:</span> ' + escapeHtml(notaActual.cliente.nombre || 'Público en General') + '</div>';
  if (notaActual.cliente.telefono) html += '<div><span class="bold">Tel:</span> ' + escapeHtml(notaActual.cliente.telefono) + '</div>';
  html += '<div class="linea"></div>';
  html += '<div class="bold flex-row"><span>DESCRIPCIÓN</span><span class="right">TOTAL</span></div>';
  html += '<div class="linea"></div>';

  productos.forEach(function(p) {
    const cant = parseFloat(p.cantidad) || 1;
    const precio = parseFloat(p.precioUnitario) || 0;
    html += '<div>' + escapeHtml(p.descripcion) + '</div>';
    html += '<div class="flex-row" style="font-size:11px; padding-left:10px; margin-bottom:4px;">' +
              '<span>' + cant + ' x ' + precio.toFixed(2) + '</span>' +
              '<span class="right">' + (cant * precio).toFixed(2) + '</span>' +
            '</div>';
  });

  html += '<div class="linea"></div>';
  html += '<div class="flex-row"><span>SUBTOTAL:</span><span class="right">' + subtotal.toFixed(2) + '</span></div>';
  if (notaActual.ivaActivo) html += '<div class="flex-row"><span>I.V.A. (16%):</span><span class="right">' + iva.toFixed(2) + '</span></div>';
  html += '<div class="flex-row bold" style="font-size:13px;"><span>TOTAL:</span><span class="right">' + total.toFixed(2) + '</span></div>';

  if (anticipo > 0) {
    html += '<div class="flex-row"><span>ANTICIPO:</span><span class="right">' + anticipo.toFixed(2) + '</span></div>';
    html += '<div class="flex-row bold"><span>SALDO PEND:</span><span class="right">' + saldo.toFixed(2) + '</span></div>';
  }

  html += '<div class="linea"></div>';
  html += '<div><span class="bold">Método Pago:</span> ' + (notaActual.metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo') + '</div>';
  html += '<br><div class="center bold">' + escapeHtml(config.mensaje || '¡Gracias por su compra!') + '</div>';
  html += '<br><br><br></body></html>';

  doc.write(html);
  doc.close();

  setTimeout(function() {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 350);
}

function construirTextoWhatsapp(n) {
  const prods = Array.isArray(n.productos) ? n.productos : [];
  const sub = prods.reduce(function(s, p) {
    return s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0);
  }, 0);
  const iva = n.ivaActivo ? sub * 0.16 : 0;
  const tot = sub + iva;
  const ant = parseFloat(n.anticipo) || 0;
  const sal = Math.max(0, tot - ant);
  const validos = prods.filter(function(p) { return p.descripcion && p.descripcion.trim(); });

  let txt = '*Nota de Remisión #' + String(n.numero || 1).padStart(4, '0') + '*\n';
  txt += 'Cliente: ' + (n.cliente && n.cliente.nombre ? n.cliente.nombre : 'Público en General') + '\n';
  txt += 'Fecha: ' + formatDate(n.cliente ? n.cliente.fecha : new Date()) + '\n';

  if (validos.length) {
    txt += '\n*Detalle:*\n';
    validos.forEach(function(p) {
      const cant = parseFloat(p.cantidad) || 0;
      const precio = parseFloat(p.precioUnitario) || 0;
      if (cant > 0 && precio > 0) {
        txt += '  • ' + p.descripcion + ' (' + cant + ' x $' + precio.toFixed(2) + ') = $' + (cant * precio).toFixed(2) + '\n';
      } else {
        txt += '  • ' + p.descripcion + '\n';
      }
    });
  }

  txt += '\n*Subtotal: ' + formatCurrency(sub) + '*';
  if (n.ivaActivo) txt += '\nI.V.A. (16%): ' + formatCurrency(iva);
  txt += '\n*TOTAL: ' + formatCurrency(tot) + '*';
  if (ant > 0) {
    txt += '\nAnticipo: ' + formatCurrency(ant);
    txt += '\n*Saldo pendiente: ' + formatCurrency(sal) + '*';
  }
  txt += '\nPago: ' + (n.metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo');
  if (config.nombre) txt += '\n\n' + config.nombre;
  txt += '\n' + (config.mensaje || 'Gracias por su compra.');
  return txt;
}

function compartirNota() {
  const texto = construirTextoWhatsapp(notaActual);
  if (navigator.share) {
    navigator.share({ title: 'Nota de Remisión', text: texto }).catch(function() {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(function() {
      mostrarToast('Nota copiada al portapapeles 📋');
    }).catch(function() {});
  }
}

function accionWhatsapp() {
  const texto = construirTextoWhatsapp(notaActual);
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}

function accionNuevaNota() {
  crearNuevaNota();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// FECHA
// ─────────────────────────────────────────────

function abrirSelectorFecha() {
  const fecha = new Date((notaActual && notaActual.cliente && notaActual.cliente.fecha) || new Date());
  setVal('fechaDia', fecha.getDate());
  setVal('fechaMes', fecha.getMonth() + 1);
  setVal('fechaAnio', fecha.getFullYear());
  actualizarMesPreview();
  setShow('overlayFecha', true, 'flex');
}

function cerrarSelectorFecha() {
  setShow('overlayFecha', false);
}

function confirmarFecha() {
  const diaEl = $('fechaDia');
  const mesEl = $('fechaMes');
  const anioEl = $('fechaAnio');
  const dia = diaEl ? (parseInt(diaEl.value, 10) || 1) : 1;
  const mes = mesEl ? (parseInt(mesEl.value, 10) || 1) : 1;
  const anio = anioEl ? (parseInt(anioEl.value, 10) || new Date().getFullYear()) : new Date().getFullYear();

  const fecha = construirFecha(dia, mes, anio);
  notaActual.cliente.fecha = fecha.toISOString();
  setText('fechaTexto', formatDate(fecha));
  guardarNotaActual();
  cerrarSelectorFecha();
}

function actualizarMesPreview() {
  const mesEl = $('fechaMes');
  const anioEl = $('fechaAnio');
  const mes = mesEl ? parseInt(mesEl.value, 10) : 0;
  const anio = anioEl ? anioEl.value : '';
  setText('fechaMesPreview', (mes >= 1 && mes <= 12) ? (MESES[mes - 1] + ' ' + anio) : '');
}

// ─────────────────────────────────────────────
// CLIENTES Y AUTOCOMPLETADO
// ─────────────────────────────────────────────

function obtenerClientesPrevios() {
  const map = new Map();
  notas.forEach(function(n) {
    if (n && n.cliente && n.cliente.nombre) {
      const key = n.cliente.nombre.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, {
          nombre: n.cliente.nombre.trim(),
          telefono: n.cliente.telefono || '',
          email: n.cliente.email || '',
          direccion: n.cliente.direccion || ''
        });
      }
    }
  });
  return Array.from(map.values());
}

function manejarAutocompletarNombre(texto) {
  if (!notaActual.cliente) notaActual.cliente = {};
  notaActual.cliente.nombre = texto;
  guardarNotaActual();

  const container = $('autocompleteContainer');
  if (!container) return;

  if (!texto || texto.length < 2) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const q = texto.toLowerCase();
  const sugs = obtenerClientesPrevios()
    .filter(function(c) { return c.nombre.toLowerCase().includes(q); })
    .slice(0, 4);

  if (!sugs.length) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  sugs.forEach(function(c) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.innerHTML =
      '<span>👤</span>' +
      '<div style="flex:1">' +
        '<div class="autocomplete-nombre">' + escapeHtml(c.nombre) + '</div>' +
        (c.telefono ? '<div class="autocomplete-sub">' + escapeHtml(c.telefono) + '</div>' : '') +
      '</div>' +
      '<span style="color:#bbb;font-size:0.9rem">↩</span>';

    item.addEventListener('click', function() { seleccionarCliente(c); });
    container.appendChild(item);
  });

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'autocomplete-cerrar';
  cerrar.textContent = 'Cerrar sugerencias';
  cerrar.addEventListener('click', function() {
    container.style.display = 'none';
    container.innerHTML = '';
  });
  container.appendChild(cerrar);
  container.style.display = 'block';
}

function seleccionarCliente(c) {
  notaActual.cliente = {
    nombre: c.nombre,
    telefono: c.telefono || '',
    vendedor: notaActual.cliente.vendedor || '',
    direccion: c.direccion || '',
    email: c.email || '',
    fecha: notaActual.cliente.fecha || new Date().toISOString()
  };
  guardarNotaActual();

  setVal('clienteNombre', c.nombre);
  setVal('clienteTelefono', c.telefono || '');
  setVal('clienteDireccion', c.direccion || '');
  setVal('clienteEmail', c.email || '');

  const container = $('autocompleteContainer');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

// ─────────────────────────────────────────────
// MENÚ, HISTORIAL, CLIENTES Y FINANZAS
// ─────────────────────────────────────────────

function abrirMenu() {
  actualizarBadgePendientes();
  setShow('overlayMenu', true, 'flex');
}

function cerrarMenu() {
  setShow('overlayMenu', false);
}

function obtenerTextoBusquedaHistorial() {
  const el1 = $('busquedaHistorialInput');
  const el2 = $('historialBusqueda');
  const v1 = el1 ? el1.value : '';
  const v2 = el2 ? el2.value : '';
  return (v1 || v2 || '').trim().toLowerCase();
}

function limpiarBuscadoresHistorial() {
  setVal('busquedaHistorialInput', '');
  setVal('historialBusqueda', '');
}

function mostrarVista(tipo) {
  cerrarMenu();
  if (tipo === 'historial' || tipo === 'pendientes' || tipo === 'iva') {
    limpiarBuscadoresHistorial();
  }

  if (tipo === 'historial') {
    filtroHistorialActual = 'todas';
    setText('historialTitulo', 'Historial de Ventas');
    renderizarHistorial('todas');
    setShow('vistaHistorial', true, 'flex');
  } else if (tipo === 'pendientes') {
    filtroHistorialActual = 'pendientes';
    setText('historialTitulo', 'Notas por Cobrar');
    renderizarHistorial('pendientes');
    setShow('vistaHistorial', true, 'flex');
  } else if (tipo === 'iva') {
    filtroHistorialActual = 'iva';
    setText('historialTitulo', 'Notas con I.V.A.');
    renderizarHistorial('iva');
    setShow('vistaHistorial', true, 'flex');
  } else if (tipo === 'gastos') {
    actualizarPantallaGastos();
    setShow('vistaGastos', true, 'flex');
  } else if (tipo === 'inventario') {
    renderizarInventario();
    setShow('vistaInventario', true, 'flex');
  } else if (tipo === 'clientes') {
    renderizarClientes();
    setShow('vistaClientes', true, 'flex');
  } else if (tipo === 'finanzas') {
    renderizarFinanzas();
    setShow('vistaFinanzas', true, 'flex');
  } else if (tipo === 'config') {
    setVal('configNombre', config.nombre || '');
    setVal('configMensaje', config.mensaje || '');
    setVal('configFolio', config.folioInicial || 1);
    setVal('configLogoUrl', config.logoUrl || '');
    setShow('vistaConfig', true, 'flex');
  }
}

function cerrarVista(tipo) {
  if (tipo === 'historial') setShow('vistaHistorial', false);
  else if (tipo === 'clientes') setShow('vistaClientes', false);
  else if (tipo === 'finanzas') setShow('vistaFinanzas', false);
  else if (tipo === 'config') setShow('vistaConfig', false);
  else if (tipo === 'gastos') setShow('vistaGastos', false);
  else if (tipo === 'inventario') setShow('vistaInventario', false);
}

function calcTotalNota(n) {
  const prods = Array.isArray(n && n.productos) ? n.productos : [];
  const sub = prods.reduce(function(s, p) {
    return s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0);
  }, 0);
  return n && n.ivaActivo ? sub * 1.16 : sub;
}

function renderizarHistorial(filtro) {
  const lista = $('historialLista');
  if (!lista) return;
  lista.innerHTML = '';

  const textoBusqueda = obtenerTextoBusquedaHistorial();

  let notasFiltradas = notas.slice().sort(function(a, b) {
    return (parseInt(b && b.numero, 10) || 0) - (parseInt(a && a.numero, 10) || 0);
  });

  if (filtro === 'pendientes') {
    notasFiltradas = notasFiltradas.filter(function(n) { return n && !n.cobrada; });
  } else if (filtro === 'iva') {
    notasFiltradas = notasFiltradas.filter(function(n) { return n && !!n.ivaActivo; });
  }

  if (textoBusqueda) {
    notasFiltradas = notasFiltradas.filter(function(n) {
      const nombreCliente = (n.cliente && n.cliente.nombre) ? n.cliente.nombre.toLowerCase() : '';
      const numeroNota = String(n.numero || '');
      const numeroNotaFormateado = String(n.numero || '').padStart(4, '0');
      return nombreCliente.includes(textoBusqueda) ||
             numeroNota.includes(textoBusqueda) ||
             numeroNotaFormateado.includes(textoBusqueda);
    });
  }

  if (!notasFiltradas.length) {
    lista.innerHTML = '<div class="historial-empty">📭<br>No se encontraron notas que coincidan.</div>';
    return;
  }

  notasFiltradas.forEach(function(nota) {
    const tot = calcTotalNota(nota);
    const clienteNombreOriginal = (nota.cliente && nota.cliente.nombre) ? nota.cliente.nombre : 'Sin nombre';

    const card = document.createElement('div');
    card.className = 'nota-card';

    card.innerHTML =
      '<div class="nota-card-header">' +
        '<span class="nota-card-num">No. ' + String(nota.numero || 1).padStart(4, '0') + '</span>' +
        '<span class="nota-card-fecha">' + formatDate(nota.cliente ? nota.cliente.fecha : new Date()) + '</span>' +
      '</div>' +
      '<div class="nota-card-cliente">' + escapeHtml(clienteNombreOriginal) + '</div>' +
      '<div class="nota-card-total">' + formatCurrency(tot) + '</div>' +
      '<div class="nota-card-badges">' +
        (nota.cobrada ? '<span class="badge-cobrada">COBRADA</span>' : '<span class="badge-pendiente">POR COBRAR</span>') +
        (nota.ivaActivo ? '<span class="badge-iva">IVA</span>' : '') +
      '</div>' +
      '<div class="nota-card-actions">' +
        '<button type="button" class="btn-card-action" data-action="abrir">📝 Abrir</button>' +
        '<button type="button" class="btn-card-action" data-action="whatsapp">💬 WhatsApp</button>' +
        '<button type="button" class="btn-card-action danger" data-action="eliminar">🗑 Eliminar</button>' +
      '</div>';

    card.querySelector('[data-action="abrir"]').addEventListener('click', function() {
      const n = notas.find(function(x) { return x.id === nota.id; });
      if (n) {
        cargarNotaEnEditor(n);
        guardarNotaActual();
        setShow('vistaHistorial', false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    card.querySelector('[data-action="whatsapp"]').addEventListener('
