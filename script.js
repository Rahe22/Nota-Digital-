// =============================================
// NOTA DE REMISIÓN — script.js
// Vanilla HTML + CSS + JavaScript puro
// =============================================

let notaActual = null;
let notas = [];
let catalogo = [];
let config = { nombre: '', mensaje: 'Gracias por su compra.', folioInicial: 1, logoUrl: '' };
let gastos = [];
const STOCK_BAJO_LIMITE = 5;

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatCurrency(valor) {
  return (parseFloat(valor) || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });
}

function formatDate(fecha) {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function construirFecha(dia, mes, anio) {
  return new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function escapeHtml(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2800);
}

// ─────────────────────────────────────────────
// PERSISTENCIA (localStorage)
// ─────────────────────────────────────────────
function cargarDatos() {
  const n = localStorage.getItem('nr_notas');
  const c = localStorage.getItem('nr_catalogo');
  const cf = localStorage.getItem('nr_config');
  const na = localStorage.getItem('nr_notaActual');
  const g = localStorage.getItem('nr_gastos');

  notas = n ? JSON.parse(n) : [];
  catalogo = c ? JSON.parse(c).map(function(item) {
    return Object.assign({
      stock: 0,
      stockMinimo: STOCK_BAJO_LIMITE,
      vecesUsado: 0
    }, item);
  }) : [];
  gastos = g ? JSON.parse(g) : [];
  if (cf) config = Object.assign({}, config, JSON.parse(cf));
  notaActual = na ? JSON.parse(na) : null;
}

function guardarNotas() { localStorage.setItem('nr_notas', JSON.stringify(notas)); }
function guardarCatalogo() { localStorage.setItem('nr_catalogo', JSON.stringify(catalogo)); }
function guardarGastos() { localStorage.setItem('nr_gastos', JSON.stringify(gastos)); }
function guardarNotaActual() { localStorage.setItem('nr_notaActual', JSON.stringify(notaActual)); }

function guardarConfig() {
  config.nombre = document.getElementById('configNombre').value;
  config.mensaje = document.getElementById('configMensaje').value;
  config.folioInicial = parseInt(document.getElementById('configFolio').value, 10) || 1;
  config.logoUrl = document.getElementById('configLogoUrl').value;
  localStorage.setItem('nr_config', JSON.stringify(config));
  actualizarLogoDisplay();
  mostrarToast('Configuración guardada ✓');
}

// ─────────────────────────────────────────────
// CREAR Y CARGAR NOTA
// ─────────────────────────────────────────────
function crearNuevaNota() {
  const maxFolio = notas.reduce(function(max, n) {
    return Math.max(max, n.numero || 0);
  }, (config.folioInicial || 1) - 1);
  const numero = maxFolio + 1;

  notaActual = {
    id: generarId(),
    numero: numero,
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

function nuevaFila() {
  return { id: generarId(), cantidad: '', precioUnitario: '', descripcion: '' };
}

function cargarNotaEnEditor(nota) {
  notaActual = nota;
  document.getElementById('notaNumBadge').textContent = 'No. ' + String(nota.numero).padStart(4, '0');
  document.getElementById('cobradaBadge').style.display = nota.cobrada ? 'flex' : 'none';
  document.getElementById('cobradaBanner').style.display = nota.cobrada ? 'flex' : 'none';

  document.getElementById('clienteNombre').value = nota.cliente.nombre || '';
  document.getElementById('clienteTelefono').value = nota.cliente.telefono || '';
  document.getElementById('clienteVendedor').value = nota.cliente.vendedor || '';
  document.getElementById('clienteDireccion').value = nota.cliente.direccion || '';
  document.getElementById('clienteEmail').value = nota.cliente.email || '';
  document.getElementById('fechaTexto').textContent = formatDate(nota.cliente.fecha);

  const ivaToggle = document.getElementById('ivaToggle');
  ivaToggle.checked = !!nota.ivaActivo;
  actualizarSeccionIva();

  if (nota.datosFactura) {
    document.getElementById('fiscalRFC').value = nota.datosFactura.rfc || '';
    document.getElementById('fiscalRegimen').value = nota.datosFactura.regimenFiscal || '';
    document.getElementById('fiscalCP').value = nota.datosFactura.codigoPostal || '';
  } else {
    document.getElementById('fiscalRFC').value = '';
    document.getElementById('fiscalRegimen').value = '';
    document.getElementById('fiscalCP').value = '';
  }

  document.getElementById('facturadaToggle').checked = !!nota.facturada;
  actualizarFacuturadaDisplay();

  document.getElementById('btnEfectivo').classList.toggle('active', nota.metodoPago === 'efectivo');
  document.getElementById('btnTransferencia').classList.toggle('active', nota.metodoPago === 'transferencia');

  document.getElementById('anticipoInput').value = nota.anticipo || '';
  document.getElementById('observaciones').value = nota.observaciones || '';

  renderizarProductos();
  recalcularTotales();
  actualizarLogoDisplay();
  actualizarEstadoCobrada();
}

// ─────────────────────────────────────────────
// LOGO
// ─────────────────────────────────────────────
function actualizarLogoDisplay() {
  const url = (notaActual && notaActual.logoUri) || config.logoUrl;
  const logoImg = document.getElementById('logoImg');
  const logoPlaceholder = document.getElementById('logoPlaceholder');
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
// PRODUCTOS
// ─────────────────────────────────────────────
function renderizarProductos() {
  const contenedor = document.getElementById('productosContainer');
  contenedor.innerHTML = '';

  notaActual.productos.forEach(function(prod) {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.dataset.id = prod.id;

    const topRow = document.createElement('div');
    topRow.className = 'fila-top-row';

    const cantInput = document.createElement('input');
    cantInput.type = 'text';
    cantInput.inputMode = 'decimal';
    cantInput.className = 'celda-cantidad';
    cantInput.placeholder = 'Cant.';
    cantInput.value = prod.cantidad || '';
    cantInput.addEventListener('input', function(e) {
      const limpio = limpiarNumero(e.target.value);
      e.target.value = limpio;
      cambiarCampoProd(prod.id, 'cantidad', limpio);
    });

    const precioInput = document.createElement('input');
    precioInput.type = 'text';
    precioInput.inputMode = 'decimal';
    precioInput.className = 'celda-precio';
    precioInput.placeholder = '0.00';
    precioInput.value = prod.precioUnitario || '';
    precioInput.addEventListener('input', function(e) {
      const limpio = limpiarNumero(e.target.value);
      e.target.value = limpio;
      cambiarCampoProd(prod.id, 'precioUnitario', limpio);
    });

    const subSpan = document.createElement('span');
    subSpan.className = 'celda-subtotal';
    subSpan.textContent = formatCurrency(calcSubtotalFila(prod));

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-delete-fila';
    btnDel.title = 'Eliminar fila';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', function() { eliminarFila(prod.id); });

    topRow.appendChild(cantInput);
    topRow.appendChild(precioInput);
    topRow.appendChild(subSpan);
    topRow.appendChild(btnDel);

    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'celda-descripcion';
    descInput.placeholder = 'Descripción del producto o servicio';
    descInput.value = prod.descripcion || '';

    const sugWrap = document.createElement('div');

    descInput.addEventListener('input', function(e) {
      cambiarCampoProd(prod.id, 'descripcion', e.target.value);
      mostrarSugerencias(prod.id, e.target.value, sugWrap);
    });

    div.appendChild(topRow);
    div.appendChild(descInput);
    div.appendChild(sugWrap);
    contenedor.appendChild(div);
  });

  actualizarEstadoCobrada();
}

function limpiarNumero(t) {
  const clean = String(t).replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  return clean;
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
    if (prod) {
      fila.querySelector('.celda-subtotal').textContent = formatCurrency(calcSubtotalFila(prod));
    }
  }
  recalcularTotales();
  guardarNotaActual();
}

function eliminarFila(id) {
  if (notaActual.cobrada || notaActual.productos.length <= 1) return;
  notaActual.productos = notaActual.productos.filter(function(p) { return p.id !== id; });
  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();
}

function agregarFila() {
  if (notaActual.cobrada) return;
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
  wrapper.innerHTML = '';
  if (texto.trim().length < 2) return;

  const q = texto.trim().toLowerCase();
  const filtrados = catalogo
    .filter(function(p) { return p.nombre.toLowerCase().includes(q); })
    .sort(function(a, b) { return (b.vecesUsado || 0) - (a.vecesUsado || 0); })
    .slice(0, 5);

  if (!filtrados.length) return;

  const cont = document.createElement('div');
  cont.className = 'sugerencias-container';

  filtrados.forEach(function(p) {
    const stockNum = parseInt(p.stock, 10) || 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sugerencia-item';
    btn.innerHTML =
      '<span>📦</span>' +
      '<span class="sugerencia-nombre">' + escapeHtml(p.nombre) + ' <small style="color:#888;">(Stock: ' + stockNum + ')</small></span>' +
      (p.precioUnitario ? '<span class="sugerencia-precio">$' + (parseFloat(p.precioUnitario) || 0).toFixed(2) + '</span>' : '');
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
  wrapper.innerHTML = '';
  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();

  catalogo = catalogo.map(function(c) {
    return c.nombre === nombre ? Object.assign({}, c, { vecesUsado: (c.vecesUsado || 0) + 1 }) : c;
  });
  guardarCatalogo();
}

// ─────────────────────────────────────────────
// INVENTARIO / STOCK (CONTEO Y DESCUENTO)
// ─────────────────────────────────────────────
function descontarStockPorNota(nota) {
  if (!nota || nota.stockDescontado) return [];

  const alertas = [];
  const mapaVentas = new Map();

  (nota.productos || []).forEach(function(prod) {
    const nombre = (prod.descripcion || '').trim().toLowerCase();
    const cant = parseFloat(prod.cantidad) || 0;
    if (!nombre || cant <= 0) return;
    mapaVentas.set(nombre, (mapaVentas.get(nombre) || 0) + cant);
  });

  if (mapaVentas.size === 0) {
    nota.stockDescontado = true;
    return alertas;
  }

  catalogo = catalogo.map(function(item) {
    const key = (item.nombre || '').trim().toLowerCase();
    const vendido = mapaVentas.get(key);
    if (!vendido) return item;

    const stockActual = Math.max(0, parseInt(item.stock, 10) || 0);
    const nuevoStock = Math.max(0, stockActual - vendido);
    const limite = parseInt(item.stockMinimo, 10) || STOCK_BAJO_LIMITE;

    if (nuevoStock === 0) {
      alertas.push('❌ ' + item.nombre + ' quedó AGOTADO (0)');
    } else if (nuevoStock <= limite) {
      alertas.push('⚠️ Poco stock en ' + item.nombre + ': quedan ' + nuevoStock);
    }

    return Object.assign({}, item, {
      stock: nuevoStock,
      vecesUsado: (item.vecesUsado || 0) + 1
    });
  });

  nota.stockDescontado = true;
  guardarCatalogo();
  return alertas;
}

function ajustarStockProducto(id, delta) {
  catalogo = catalogo.map(function(c) {
    if (c.id !== id) return c;
    const actual = Math.max(0, parseInt(c.stock, 10) || 0);
    return Object.assign({}, c, { stock: Math.max(0, actual + delta) });
  });
  guardarCatalogo();
  renderizarCatalogo();
}

function eliminarDelCatalogo(id) {
  catalogo = catalogo.filter(function(c) { return c.id !== id; });
  guardarCatalogo();
  renderizarCatalogo();
  mostrarToast('Producto eliminado del catálogo');
}

// ─────────────────────────────────────────────
// CÁLCULOS
// ─────────────────────────────────────────────
function calcSubtotalFila(prod) {
  const cant = parseFloat(prod.cantidad) || 0;
  const precio = parseFloat(prod.precioUnitario) || 0;
  return cant * precio;
}

function calcSubtotalGeneral() {
  return notaActual.productos.reduce(function(sum, p) { return sum + calcSubtotalFila(p); }, 0);
}

function calcIVA(subtotal, ivaActivo) { return ivaActivo ? subtotal * 0.16 : 0; }
function calcTotal(subtotal, ivaActivo) { return subtotal + calcIVA(subtotal, ivaActivo); }
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

  document.getElementById('totalSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('totalIva').textContent = formatCurrency(iva);
  document.getElementById('totalIva').style.color = notaActual.ivaActivo ? '#1a1a2e' : '#aaa';
  document.getElementById('totalFinal').textContent = formatCurrency(total);

  const saldoRow = document.getElementById('saldoRow');
  const saldoLabel = document.getElementById('saldoLabel');
  const saldoValue = document.getElementById('saldoValue');

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

  actualizarSubtextCobrar(total);
  actualizarBadgePendientes();
}

function actualizarSubtextCobrar(total) {
  const el = document.getElementById('cobrarSubtext');
  const ivaOk = verificarIvaOk();
  const total2 = total !== undefined ? total : calcTotal(calcSubtotalGeneral(), notaActual.ivaActivo);
  if (!ivaOk) {
    el.textContent = '⚠️ Completa los datos fiscales para cobrar';
  } else if (notaActual.cobrada) {
    el.textContent = 'Nota cobrada · Toca para reimprimir o compartir';
  } else {
    el.textContent = 'Total a cobrar: ' + formatCurrency(total2);
  }
}

function verificarIvaOk() {
  if (!notaActual.ivaActivo) return true;
  const df = notaActual.datosFactura;
  if (!df) return false;
  return !!(df.rfc && df.rfc.trim() && df.regimenFiscal && df.regimenFiscal.trim() && df.codigoPostal && df.codigoPostal.trim());
}

// ─────────────────────────────────────────────
// SECCIÓN IVA Y ESTADO COBRADA
// ─────────────────────────────────────────────
function actualizarSeccionIva() {
  const activo = notaActual.ivaActivo;
  document.getElementById('fiscalContainer').style.display = activo ? 'flex' : 'none';
  document.getElementById('ivaLabel').textContent = activo ? 'I.V.A. (16%)' : 'I.V.A. (desactivado)';
  actualizarFiscalWarning();
}

function actualizarFiscalWarning() {
  const warning = document.getElementById('fiscalWarning');
  warning.style.display = (notaActual.ivaActivo && !verificarIvaOk()) ? 'flex' : 'none';
}

function actualizarFacuturadaDisplay() {
  const check = document.getElementById('facturadaCheck');
  const label = document.getElementById('facturadaLabel');
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
  const cobrada = !!(notaActual && notaActual.cobrada);
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
  document.getElementById('btnGuardarPendiente').style.display = cobrada ? 'none' : 'flex';
  document.getElementById('btnCobrar').innerHTML = cobrada ? '🔄 REIMPRIMIR / COMPARTIR' : '🖨️ COBRAR E IMPRIMIR';
}

// ─────────────────────────────────────────────
// BADGE PENDIENTES
// ─────────────────────────────────────────────
function actualizarBadgePendientes() {
  const pendientes = notas.filter(function(n) { return !n.cobrada; }).length;
  const badgeContainer = document.getElementById('badgeContainer');
  const navbarBadge = document.getElementById('navbarBadge');
  const menuBadge = document.getElementById('menuBadge');
  const menuPendientesSub = document.getElementById('menuPendientesSub');

  if (pendientes > 0) {
    badgeContainer.style.display = 'flex';
    navbarBadge.textContent = pendientes;
    menuBadge.style.display = 'flex';
    menuBadge.textContent = pendientes;
    menuPendientesSub.textContent = pendientes + ' pendiente' + (pendientes !== 1 ? 's' : '');
  } else {
    badgeContainer.style.display = 'none';
    menuBadge.style.display = 'none';
    menuPendientesSub.textContent = 'Sin pendientes';
  }
}

// ─────────────────────────────────────────────
// GUARDAR COMO PENDIENTE, COBRAR Y WHATSAPP
// ─────────────────────────────────────────────
function accionGuardarPendiente() {
  const tieneNombre = (notaActual.cliente.nombre || '').trim().length > 0;
  const tieneProducto = notaActual.productos.some(function(p) {
    return (p.descripcion || '').trim().length > 0;
  });

  if (!tieneNombre && !tieneProducto) {
    mostrarToast('Agrega el nombre del cliente o un producto primero');
    return;
  }

  const copia = JSON.parse(JSON.stringify(notaActual));
  copia.cobrada = false;
  copia.stockDescontado = false;

  const idx = notas.findIndex(function(n) { return n.id === copia.id; });
  if (idx >= 0) { notas[idx] = copia; } else { notas.push(copia); }
  guardarNotas();

  const num = String(copia.numero).padStart(4, '0');
  mostrarToast('Nota #' + num + ' guardada como "Por Cobrar" ✓');
  crearNuevaNota();
}

function accionCobrar() {
  if (!verificarIvaOk()) {
    mostrarToast('⚠️ Completa los datos fiscales');
    return;
  }

  const yaEstabaCobrada = !!notaActual.cobrada;
  notaActual.cobrada = true;

  const alertasStock = !yaEstabaCobrada ? descontarStockPorNota(notaActual) : [];

  const copia = JSON.parse(JSON.stringify(notaActual));
  const idx = notas.findIndex(function(n) { return n.id === copia.id; });
  if (idx >= 0) { notas[idx] = copia; } else { notas.push(copia); }
  guardarNotas();

  document.getElementById('cobradaBadge').style.display = 'flex';
  document.getElementById('cobradaBanner').style.display = 'flex';
  actualizarEstadoCobrada();
  actualizarBadgePendientes();
  recalcularTotales();

  const num = String(notaActual.numero).padStart(4, '0');
  if (alertasStock.length > 0) {
    mostrarToast('Nota #' + num + ' cobrada · ' + alertasStock[0]);
  } else {
    mostrarToast(yaEstabaCobrada ? 'Reimprimiendo Nota #' + num : 'Nota #' + num + ' cobrada ✓');
  }

  setTimeout(function() {
    window.print();
  }, 150);

  if (!yaEstabaCobrada) {
    setTimeout(function() {
      crearNuevaNota();
    }, 1200);
  }
}

function construirTextoNota(nota) {
  const subtotal = (nota.productos || []).reduce(function(sum, p) {
    return sum + ((parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0));
  }, 0);
  const iva = calcIVA(subtotal, nota.ivaActivo);
  const total = calcTotal(subtotal, nota.ivaActivo);
  const anticipo = parseFloat(nota.anticipo) || 0;
  const saldo = calcSaldo(total, nota.anticipo);
  const productos = (nota.productos || []).filter(function(p) {
    return p.descripcion && p.descripcion.trim();
  });

  let texto = '*Nota de Remisión #' + String(nota.numero).padStart(4, '0') + '*\n';
  if (nota.cliente && nota.cliente.nombre) texto += 'Cliente: ' + nota.cliente.nombre + '\n';
  texto += 'Fecha: ' + formatDate(nota.cliente ? nota.cliente.fecha : new Date()) + '\n';

  if (productos.length) {
    texto += '\n*Detalle:*\n';
    productos.forEach(function(p) {
      const cant = parseFloat(p.cantidad) || 0;
      const precio = parseFloat(p.precioUnitario) || 0;
      if (cant > 0 && precio > 0) {
        texto += '• ' + p.descripcion + ' (' + cant + ' x $' + precio.toFixed(2) + ') = $' + (cant * precio).toFixed(2) + '\n';
      } else {
        texto += '• ' + p.descripcion + '\n';
      }
    });
  }

  texto += '\n*Subtotal: ' + formatCurrency(subtotal) + '*';
  if (nota.ivaActivo) texto += '\nI.V.A. (16%): ' + formatCurrency(iva);
  texto += '\n*TOTAL: ' + formatCurrency(total) + '*';
  if (anticipo > 0) {
    texto += '\nAnticipo: ' + formatCurrency(anticipo);
    texto += '\n*Saldo pendiente: ' + formatCurrency(saldo) + '*';
  }
  texto += '\nPago: ' + (nota.metodoPago === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo');
  if (nota.observaciones && nota.observaciones.trim()) {
    texto += '\nObs: ' + nota.observaciones.trim();
  }
  if (config.nombre) texto += '\n\n' + config.nombre;
  texto += '\n' + (config.mensaje || 'Gracias por su compra.');
  return texto;
}

function compartirTextoPorWhatsapp(texto) {
  const url = 'https://wa.me/?text=' + encodeURIComponent(texto);
  window.open(url, '_blank');
}

function accionWhatsapp() {
  compartirTextoPorWhatsapp(construirTextoNota(notaActual));
}

function accionNuevaNota() {
  crearNuevaNota();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// SELECTOR DE FECHA
// ─────────────────────────────────────────────
function abrirSelectorFecha() {
  const fecha = new Date(notaActual.cliente.fecha);
  document.getElementById('fechaDia').value = fecha.getDate();
  document.getElementById('fechaMes').value = fecha.getMonth() + 1;
  document.getElementById('fechaAnio').value = fecha.getFullYear();
  actualizarMesPreview();
  document.getElementById('overlayFecha').style.display = 'flex';
}

function cerrarSelectorFecha() {
  document.getElementById('overlayFecha').style.display = 'none';
}

function confirmarFecha() {
  const dia = parseInt(document.getElementById('fechaDia').value, 10) || 1;
  const mes = parseInt(document.getElementById('fechaMes').value, 10) || 1;
  const anio = parseInt(document.getElementById('fechaAnio').value, 10) || new Date().getFullYear();
  const fecha = construirFecha(dia, mes, anio);
  notaActual.cliente.fecha = fecha.toISOString();
  document.getElementById('fechaTexto').textContent = formatDate(fecha);
  guardarNotaActual();
  cerrarSelectorFecha();
}

function actualizarMesPreview() {
  const mes = parseInt(document.getElementById('fechaMes').value, 10);
  const anio = document.getElementById('fechaAnio').value;
  const el = document.getElementById('fechaMesPreview');
  el.textContent = (mes >= 1 && mes <= 12) ? (MESES[mes - 1] + ' ' + anio) : '';
}

// ─────────────────────────────────────────────
// CATÁLOGO Y STOCK
// ─────────────────────────────────────────────
function abrirCatalogo() {
  renderizarCatalogo();
  document.getElementById('overlayCatalogo').style.display = 'flex';
}

function cerrarCatalogo() {
  document.getElementById('overlayCatalogo').style.display = 'none';
}

function renderizarCatalogo() {
  const busqueda = document.getElementById('catalogoBusqueda').value.trim().toLowerCase();
  const lista = document.getElementById('catalogoLista');

  let items = catalogo.slice().sort(function(a, b) {
    return (b.vecesUsado || 0) - (a.vecesUsado || 0);
  });
  if (busqueda) {
    items = items.filter(function(p) { return p.nombre.toLowerCase().includes(busqueda); });
  }

  document.getElementById('catalogoBusquedaWrap').style.display = catalogo.length > 4 ? 'flex' : 'none';
  lista.innerHTML = '';

  if (items.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'catalogo-empty';
    msg.innerHTML = catalogo.length === 0
      ? 'Aún no tienes productos en inventario.<br>Agrega uno arriba con su precio y stock.'
      : 'Sin resultados para esa búsqueda.';
    lista.appendChild(msg);
    return;
  }

  items.forEach(function(prod) {
    const stockNum = Math.max(0, parseInt(prod.stock, 10) || 0);
    const limite = parseInt(prod.stockMinimo, 10) || STOCK_BAJO_LIMITE;

    let badgeClase = 'stock-ok';
    let badgeTexto = 'Stock: ' + stockNum;
    if (stockNum === 0) {
      badgeClase = 'stock-agotado';
      badgeTexto = 'Agotado (0)';
    } else if (stockNum <= limite) {
      badgeClase = 'stock-bajo';
      badgeTexto = 'Poco stock: ' + stockNum;
    }

    const div = document.createElement('div');
    div.className = 'catalogo-item';

    const info = document.createElement('div');
    info.className = 'catalogo-item-info';
    info.innerHTML =
      '<div class="catalogo-item-nombre">' + escapeHtml(prod.nombre) + '</div>' +
      '<div class="catalogo-item-meta">' +
        '<span>' + formatCurrency(parseFloat(prod.precioUnitario) || 0) + '</span>' +
        '<span class="stock-badge ' + badgeClase + '">' + escapeHtml(badgeTexto) + '</span>' +
      '</div>';

    const btnMenos = document.createElement('button');
    btnMenos.type = 'button';
    btnMenos.className = 'stock-ajustar-btn';
    btnMenos.title = 'Restar 1 al stock';
    btnMenos.textContent = '-';
    btnMenos.addEventListener('click', function() { ajustarStockProducto(prod.id, -1); });

    const btnMas = document.createElement('button');
    btnMas.type = 'button';
    btnMas.className = 'stock-ajustar-btn';
    btnMas.title = 'Sumar 1 al stock';
    btnMas.textContent = '+';
    btnMas.addEventListener('click', function() { ajustarStockProducto(prod.id, 1); });

    const btnAddNota = document.createElement('button');
    btnAddNota.type = 'button';
    btnAddNota.className = 'btn-cat-add';
    btnAddNota.title = 'Pasar a la nota';
    btnAddNota.textContent = '↩';
    btnAddNota.addEventListener('click', function() {
      seleccionarDeCatalogo(prod.nombre, prod.precioUnitario);
      cerrarCatalogo();
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-cat-delete';
    btnDel.title = 'Eliminar producto';
    btnDel.textContent = '🗑';
    btnDel.addEventListener('click', function() { eliminarDelCatalogo(prod.id); });

    div.appendChild(info);
    div.appendChild(btnMenos);
    div.appendChild(btnMas);
    div.appendChild(btnAddNota);
    div.appendChild(btnDel);
    lista.appendChild(div);
  });
}

function agregarAlCatalogo(nombre, precio, stockInicial) {
  const stockVal = Math.max(0, parseInt(stockInicial, 10) || 0);
  const existe = catalogo.find(function(c) {
    return c.nombre.toLowerCase() === nombre.toLowerCase();
  });

  if (existe) {
    existe.vecesUsado = (existe.vecesUsado || 0) + 1;
    if (precio !== '' && precio !== undefined) existe.precioUnitario = precio;
    if (stockInicial !== '' && stockInicial !== undefined) {
      existe.stock = stockVal;
    }
  } else {
    catalogo.push({
      id: generarId(),
      nombre: nombre,
      precioUnitario: precio || '',
      stock: stockVal,
      stockMinimo: STOCK_BAJO_LIMITE,
      vecesUsado: 1
    });
  }
  guardarCatalogo();
}

function accionAgregarAlCatalogo() {
  const nombreEl = document.getElementById('catalogoNombreInput');
  const precioEl = document.getElementById('catalogoPrecioInput');
  const stockEl = document.getElementById('catalogoStockInput');

  const nombre = nombreEl.value.trim();
  const precio = precioEl.value.trim();
  const stock = stockEl.value.trim();

  if (!nombre) {
    mostrarToast('Escribe el nombre del producto');
    return;
  }

  agregarAlCatalogo(nombre, precio, stock);
  nombreEl.value = '';
  precioEl.value = '';
  stockEl.value = '';
  renderizarCatalogo();
  mostrarToast('"' + nombre + '" guardado en inventario ✓');
}

function seleccionarDeCatalogo(nombre, precio) {
  if (notaActual.cobrada) {
    mostrarToast('Crea una nueva nota para agregar productos');
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
}

// ─────────────────────────────────────────────
// AUTOCOMPLETAR CLIENTE
// ─────────────────────────────────────────────
function obtenerClientesPrevios() {
  const map = new Map();
  notas.forEach(function(n) {
    if (!n.cliente || !n.cliente.nombre) return;
    const key = n.cliente.nombre.trim().toLowerCase();
    if (key && !map.has(key)) {
      map.set(key, {
        nombre: n.cliente.nombre.trim(),
        telefono: n.cliente.telefono || '',
        email: n.cliente.email || '',
        direccion: n.cliente.direccion || ''
      });
    }
  });
  return Array.from(map.values());
}

function manejarAutocompletarNombre(texto) {
  notaActual.cliente.nombre = texto;
  guardarNotaActual();

  const container = document.getElementById('autocompleteContainer');
  if (texto.length < 2) {
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
  notaActual.cliente.nombre = c.nombre;
  notaActual.cliente.telefono = c.telefono;
  notaActual.cliente.email = c.email;
  notaActual.cliente.direccion = c.direccion;
  guardarNotaActual();

  document.getElementById('clienteNombre').value = c.nombre;
  document.getElementById('clienteTelefono').value = c.telefono;
  document.getElementById('clienteEmail').value = c.email;
  document.getElementById('clienteDireccion').value = c.direccion;

  const container = document.getElementById('autocompleteContainer');
  container.style.display = 'none';
  container.innerHTML = '';
}

// ─────────────────────────────────────────────
// MENÚ Y VISTAS SECUNDARIAS
// ─────────────────────────────────────────────
function abrirMenu() {
  actualizarBadgePendientes();
  document.getElementById('overlayMenu').style.display = 'flex';
}

function cerrarMenu() {
  document.getElementById('overlayMenu').style.display = 'none';
}

let filtroHistorialActual = 'todas';

function mostrarVista(tipo) {
  if (tipo === 'historial') {
    filtroHistorialActual = 'todas';
    document.getElementById('historialBuscar').value = '';
    renderizarHistorial('todas');
    document.getElementById('historialTitulo').textContent = 'Historial de Ventas';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'pendientes') {
    filtroHistorialActual = 'pendientes';
    document.getElementById('historialBuscar').value = '';
    renderizarHistorial('pendientes');
    document.getElementById('historialTitulo').textContent = 'Notas por Cobrar';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'gastos') {
    actualizarPantallaGastos();
    document.getElementById('vistaGastos').style.display = 'flex';
  } else if (tipo === 'iva') {
    filtroHistorialActual = 'iva';
    document.getElementById('historialBuscar').value = '';
    renderizarHistorial('iva');
    document.getElementById('historialTitulo').textContent = 'Notas con I.V.A.';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'clientes') {
    renderizarClientes();
    document.getElementById('vistaClientes').style.display = 'flex';
  } else if (tipo === 'finanzas') {
    renderizarFinanzas();
    document.getElementById('vistaFinanzas').style.display = 'flex';
  } else if (tipo === 'config') {
    document.getElementById('configNombre').value = config.nombre || '';
    document.getElementById('configMensaje').value = config.mensaje || 'Gracias por su compra.';
    document.getElementById('configFolio').value = config.folioInicial || 1;
    document.getElementById('configLogoUrl').value = config.logoUrl || '';
    document.getElementById('vistaConfig').style.display = 'flex';
  }
}

function cerrarVista(tipo) {
  if (tipo === 'historial') document.getElementById('vistaHistorial').style.display = 'none';
  else if (tipo === 'clientes') document.getElementById('vistaClientes').style.display = 'none';
  else if (tipo === 'finanzas') document.getElementById('vistaFinanzas').style.display = 'none';
  else if (tipo === 'config') document.getElementById('vistaConfig').style.display = 'none';
  else if (tipo === 'gastos') document.getElementById('vistaGastos').style.display = 'none';
}

// ─── HISTORIAL ───────────────────────────────
function renderizarHistorial(filtro) {
  if (filtro) filtroHistorialActual = filtro;
  const lista = document.getElementById('historialLista');
  const query = (document.getElementById('historialBuscar').value || '').trim().toLowerCase();
  lista.innerHTML = '';

  let notasFiltradas = notas.slice().sort(function(a, b) { return (b.numero || 0) - (a.numero || 0); });

  if (filtroHistorialActual === 'pendientes') {
    notasFiltradas = notasFiltradas.filter(function(n) { return !n.cobrada; });
  } else if (filtroHistorialActual === 'iva') {
    notasFiltradas = notasFiltradas.filter(function(n) { return !!n.ivaActivo; });
  }

  if (query) {
    notasFiltradas = notasFiltradas.filter(function(n) {
      const folioStr = String(n.numero || '').padStart(4, '0');
      const clienteStr = ((n.cliente && n.cliente.nombre) || '').toLowerCase();
      return folioStr.includes(query) || String(n.numero || '').includes(query) || clienteStr.includes(query);
    });
  }

  if (!notasFiltradas.length) {
    lista.innerHTML = '<div class="historial-empty">📭<br>No hay notas que coincidan.</div>';
    return;
  }

  notasFiltradas.forEach(function(nota) {
    const tot = calcTotalNota(nota);
    const card = document.createElement('div');
    card.className = 'nota-card';

    card.innerHTML =
      '<div class="nota-card-header">' +
        '<span class="nota-card-num">No. ' + String(nota.numero).padStart(4, '0') + '</span>' +
        '<span class="nota-card-fecha">' + escapeHtml(formatDate(nota.cliente ? nota.cliente.fecha : new Date())) + '</span>' +
      '</div>' +
      '<div class="nota-card-cliente">' + escapeHtml((nota.cliente && nota.cliente.nombre) || 'Sin nombre de cliente') + '</div>' +
      '<div class="nota-card-badges">' +
        (nota.cobrada
          ? '<span class="badge-cobrada">✓ COBRADA</span>'
          : '<span class="badge-pendiente">⏳ POR COBRAR</span>') +
        (nota.ivaActivo ? '<span class="badge-iva">IVA 16%</span>' : '') +
      '</div>' +
      '<div class="nota-card-total">' + formatCurrency(tot) + '</div>' +
      '<div class="nota-card-actions"></div>';

    const actions = card.querySelector('.nota-card-actions');

    const btnAbrir = document.createElement('button');
    btnAbrir.type = 'button';
    btnAbrir.className = 'btn-card-action';
    btnAbrir.textContent = 'Abrir';
    btnAbrir.addEventListener('click', function() {
      cargarNotaEnEditor(JSON.parse(JSON.stringify(nota)));
      guardarNotaActual();
      cerrarVista('historial');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const btnWa = document.createElement('button');
    btnWa.type = 'button';
    btnWa.className = 'btn-card-action';
    btnWa.textContent = 'WhatsApp';
    btnWa.addEventListener('click', function() {
      compartirTextoPorWhatsapp(construirTextoNota(nota));
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-card-action danger';
    btnDel.textContent = 'Borrar';
    btnDel.addEventListener('click', function() {
      if (!confirm('¿Eliminar la nota #' + String(nota.numero).padStart(4, '0') + '?')) return;
      notas = notas.filter(function(item) { return item.id !== nota.id; });
      guardarNotas();
      actualizarBadgePendientes();
      renderizarHistorial(filtroHistorialActual);
    });

    actions.appendChild(btnAbrir);
    actions.appendChild(btnWa);
    actions.appendChild(btnDel);
    lista.appendChild(card);
  });
}

// ─── CLIENTES ────────────────────────────────
function renderizarClientes() {
  const lista = document.getElementById('clientesLista');
  lista.innerHTML = '';

  const map = new Map();
  notas.forEach(function(n) {
    if (!n.cliente || !n.cliente.nombre) return;
    const key = n.cliente.nombre.trim().toLowerCase();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        nombre: n.cliente.nombre.trim(),
        telefono: n.cliente.telefono || '',
        notas: [],
        totalVentas: 0
      });
    }
    const entry = map.get(key);
    entry.notas.push(n);
    entry.totalVentas += calcTotalNota(n);
  });

  if (!map.size) {
    lista.innerHTML = '<div class="historial-empty">👥<br>Aún no hay clientes registrados.</div>';
    return;
  }

  const clientes = Array.from(map.values()).sort(function(a, b) { return b.totalVentas - a.totalVentas; });
  clientes.forEach(function(c) {
    const card = document.createElement('div');
    card.className = 'cliente-card';
    card.innerHTML =
      '<div class="cliente-card-nombre">' + escapeHtml(c.nombre) + '</div>' +
      '<div class="cliente-card-stats">' +
        '<span>' + c.notas.length + ' nota' + (c.notas.length !== 1 ? 's' : '') + '</span>' +
        '<span>Total: ' + formatCurrency(c.totalVentas) + '</span>' +
        (c.telefono ? '<span>📞 ' + escapeHtml(c.telefono) + '</span>' : '') +
      '</div>';
    lista.appendChild(card);
  });
}

// ─── FINANZAS ────────────────────────────────
function calcTotalNota(n) {
  const sub = (n.productos || []).reduce(function(s, p) {
    return s + ((parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0));
  }, 0);
  return n.ivaActivo ? sub * 1.16 : sub;
}

function renderizarFinanzas() {
  const body = document.getElementById('finanzasBody');
  body.innerHTML = '';

  const cobradas = notas.filter(function(n) { return !!n.cobrada; });
  const pendientes = notas.filter(function(n) { return !n.cobrada; });
  const totalCobrado = cobradas.reduce(function(sum, n) { return sum + calcTotalNota(n); }, 0);
  const totalPendiente = pendientes.reduce(function(sum, n) { return sum + calcTotalNota(n); }, 0);
  const totalVentas = totalCobrado + totalPendiente;
  const totalGastosTotal = gastos.reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);
  const balanceCobradoMenosGastos = totalCobrado - totalGastosTotal;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '12px';

  wrapper.innerHTML =
    '<div class="finanzas-resumen">' +
      '<div class="finanza-kpi"><span class="finanza-kpi-label">TOTAL VENTAS</span><span class="finanza-kpi-value">' + formatCurrency(totalVentas) + '</span><span class="finanza-kpi-sub">' + notas.length + ' notas</span></div>' +
      '<div class="finanza-kpi"><span class="finanza-kpi-label">COBRADO</span><span class="finanza-kpi-value" style="color:#27ae60">' + formatCurrency(totalCobrado) + '</span><span class="finanza-kpi-sub">' + cobradas.length + ' notas</span></div>' +
      '<div class="finanza-kpi"><span class="finanza-kpi-label">POR COBRAR</span><span class="finanza-kpi-value" style="color:#e74c3c">' + formatCurrency(totalPendiente) + '</span><span class="finanza-kpi-sub">' + pendientes.length + ' notas</span></div>' +
      '<div class="finanza-kpi"><span class="finanza-kpi-label">GASTOS TOTAL</span><span class="finanza-kpi-value" style="color:#e67e22">' + formatCurrency(totalGastosTotal) + '</span><span class="finanza-kpi-sub">' + gastos.length + ' registros</span></div>' +
    '</div>' +
    '<div class="card"><div class="total-row"><span class="total-label">COBRADO MENOS GASTOS</span><span class="total-value" style="color:' + (balanceCobradoMenosGastos >= 0 ? '#27ae60' : '#e74c3c') + '">' + formatCurrency(balanceCobradoMenosGastos) + '</span></div></div>';

  body.appendChild(wrapper);
}

// ─────────────────────────────────────────────
// MÓDULO DE GASTOS
// ─────────────────────────────────────────────
let gastoCategoriaActual = '⛽ Combustible';
let gastoFiltroMes = new Date().toISOString().substring(0, 7);

function setGastoCat(elemento, cat) {
  const botones = elemento.parentElement.querySelectorAll('.cat-btn');
  botones.forEach(function(btn) { btn.classList.remove('active'); });
  elemento.classList.add('active');
  gastoCategoriaActual = cat;
}

function accionGuardarGasto() {
  const concepto = document.getElementById('gastoConcepto').value.trim();
  const monto = parseFloat(document.getElementById('gastoMonto').value);
  const fecha = document.getElementById('gastoFecha').value;

  if (!concepto || isNaN(monto) || monto <= 0 || !fecha) {
    mostrarToast('⚠️ Llena concepto, monto y fecha');
    return;
  }

  gastos.unshift({
    id: generarId(),
    categoria: gastoCategoriaActual,
    concepto: concepto,
    monto: monto,
    fecha: fecha
  });
  guardarGastos();

  document.getElementById('gastoConcepto').value = '';
  document.getElementById('gastoMonto').value = '';
  actualizarPantallaGastos();
  mostrarToast('Gasto registrado ✓');
}

function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  gastos = gastos.filter(function(g) { return g.id !== id; });
  guardarGastos();
  actualizarPantallaGastos();
  mostrarToast('Gasto eliminado');
}

function cambiarFiltroMesGastos(delta) {
  const partes = gastoFiltroMes.split('-');
  let anio = parseInt(partes[0], 10);
  let mes = parseInt(partes[1], 10) - 1 + delta;
  if (mes < 0) { mes = 11; anio--; }
  if (mes > 11) { mes = 0; anio++; }
  gastoFiltroMes = anio + '-' + String(mes + 1).padStart(2, '0');
  actualizarPantallaGastos();
}

function actualizarPantallaGastos() {
  const lista = document.getElementById('listaGastos');
  const hoy = new Date().toISOString().split('T')[0];
  const esteMesReal = hoy.substring(0, 7);

  const totalHoy = gastos
    .filter(function(g) { return g.fecha === hoy; })
    .reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);

  const totalMes = gastos
    .filter(function(g) { return g.fecha && g.fecha.startsWith(esteMesReal); })
    .reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);

  document.getElementById('gastoHoy').textContent = formatCurrency(totalHoy);
  document.getElementById('gastoMes').textContent = formatCurrency(totalMes);

  const gastosFiltrados = gastos.filter(function(g) { return g.fecha && g.fecha.startsWith(gastoFiltroMes); });
  const totalFiltrado = gastosFiltrados.reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);
  const partes = gastoFiltroMes.split('-');
  const nombreMes = MESES[parseInt(partes[1], 10) - 1] + ' ' + partes[0];

  lista.innerHTML =
    '<div class="card" style="overflow:hidden; margin-bottom:10px">' +
      '<div class="seccion-header" style="background:#e67e22">' +
        '<button type="button" onclick="cambiarFiltroMesGastos(-1)" style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 6px">‹</button>' +
        '<span class="seccion-title" style="text-align:center">' + nombreMes.toUpperCase() + '</span>' +
        '<button type="button" onclick="cambiarFiltroMesGastos(1)" style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 6px">›</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px">' +
        '<span style="font-size:12px;font-weight:600;color:#888">' + gastosFiltrados.length + ' gasto' + (gastosFiltrados.length !== 1 ? 's' : '') + '</span>' +
        '<span style="font-size:16px;font-weight:700;color:#e67e22">' + formatCurrency(totalFiltrado) + '</span>' +
      '</div>' +
    '</div>';

  if (gastosFiltrados.length === 0) {
    lista.innerHTML += '<p style="text-align:center;color:#aaa;padding:30px 20px;font-size:13px">Sin gastos en ' + nombreMes + '.</p>';
    return;
  }

  gastosFiltrados.forEach(function(g) {
    const item = document.createElement('div');
    item.className = 'nota-card';
    item.style.marginBottom = '8px';
    item.innerHTML =
      '<div class="nota-card-header">' +
        '<span class="nota-card-num" style="color:#e67e22">' + escapeHtml(g.categoria || '📌 Otros') + '</span>' +
        '<span class="nota-card-fecha">' + escapeHtml(g.fecha || '') + '</span>' +
      '</div>' +
      '<div class="nota-card-cliente">' + escapeHtml(g.concepto || '') + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span class="nota-card-total" style="color:#1a1a2e">' + formatCurrency(parseFloat(g.monto) || 0) + '</span>' +
        '<button type="button" class="btn-card-action danger" style="max-width:90px" onclick="eliminarGasto(\'' + g.id + '\')">Eliminar</button>' +
      '</div>';
    lista.appendChild(item);
  });
}

// ─────────────────────────────────────────────
// REINICIO TOTAL
// ─────────────────────────────────────────────
function confirmarReinicioTotal() {
  const c1 = confirm('¿Estás seguro de que quieres borrar TODO? Se perderán notas, clientes, inventario y configuración.');
  if (!c1) return;
  const c2 = confirm('ESTA ACCIÓN NO SE PUEDE DESHACER. ¿Realmente quieres dejar la app como nueva?');
  if (!c2) return;

  ['nr_notas', 'nr_catalogo', 'nr_config', 'nr_notaActual', 'nr_gastos'].forEach(function(k) {
    localStorage.removeItem(k);
  });
  notas = [];
  catalogo = [];
  gastos = [];
  config = { nombre: '', mensaje: 'Gracias por su compra.', folioInicial: 1, logoUrl: '' };
  cerrarVista('config');
  crearNuevaNota();
  mostrarToast('Aplicación reiniciada ✓');
}

// ─────────────────────────────────────────────
// EVENTOS PRINCIPALES
// ─────────────────────────────────────────────
function inicializarEventos() {
  document.getElementById('btnMenu').addEventListener('click', abrirMenu);
  document.getElementById('overlayMenu').addEventListener('click', function(e) { if (e.target === this) cerrarMenu(); });
  document.getElementById('overlayCatalogo').addEventListener('click', function(e) { if (e.target === this) cerrarCatalogo(); });
  document.getElementById('overlayFecha').addEventListener('click', function(e) { if (e.target === this) cerrarSelectorFecha(); });
  document.getElementById('btnCerrarCatalogo').addEventListener('click', cerrarCatalogo);

  document.getElementById('fechaBtn').addEventListener('click', abrirSelectorFecha);
  document.getElementById('btnFechaCancelar').addEventListener('click', cerrarSelectorFecha);
  document.getElementById('btnFechaConfirmar').addEventListener('click', confirmarFecha);
  document.getElementById('fechaMes').addEventListener('input', actualizarMesPreview);
  document.getElementById('fechaAnio').addEventListener('input', actualizarMesPreview);

  document.getElementById('btnCatalogo').addEventListener('click', abrir
