// =============================================
// NOTA DE REMISIÓN — script.js
// Vanilla HTML + CSS + JavaScript puro
// =============================================

// ─────────────────────────────────────────────
// ESTADO GLOBAL DE LA APLICACIÓN
// ─────────────────────────────────────────────
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

// Variables del escáner de cámara
let html5QrScanner = null;
let escanerActivo = false;
let ultimoCodigoLeido = '';
let ultimaLecturaMs = 0;
let conteoSesionEscaner = 0;

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function normalizarTexto(t) {
  return String(t || '').trim().toLowerCase();
}

function normalizarCodigo(c) {
  return String(c || '').trim().toUpperCase();
}

function generarCodigoProducto() {
  let maxNum = 0;
  catalogo.forEach(function(item) {
    const match = String(item.codigo || '').match(/^PROD-(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  let candidato = '';
  do {
    maxNum++;
    candidato = 'PROD-' + String(maxNum).padStart(4, '0');
  } while (catalogo.some(function(c) { return normalizarCodigo(c.codigo) === candidato; }));
  return candidato;
}

function formatCurrency(valor) {
  return (parseFloat(valor) || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });
}

function formatDate(fecha) {
  if (!fecha) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const partes = fecha.split('-');
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function toInputDateValue(fecha) {
  if (!fecha) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function escapeHtml(t) {
  return String(t || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    toast.classList.remove('show');
  }, 2800);
}

function limpiarNumero(t) {
  const clean = String(t || '').replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  return clean;
}

function redondearDosDecimales(num) {
  return Math.round((parseFloat(num) || 0) * 100) / 100;
}

function feedbackLecturaExitosa() {
  if (navigator.vibrate) {
    navigator.vibrate(70);
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  } catch (e) {}
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
  let huboNuevosCodigos = false;
  catalogo = c ? JSON.parse(c).map(function(item) {
    const base = Object.assign({ stock: 0, minimo: 5, vecesUsado: 0, codigo: '' }, item);
    return base;
  }) : [];

  catalogo.forEach(function(item) {
    if (!item.codigo || !String(item.codigo).trim()) {
      item.codigo = generarCodigoProducto();
      huboNuevosCodigos = true;
    } else {
      item.codigo = normalizarCodigo(item.codigo);
    }
  });
  if (huboNuevosCodigos) {
    guardarCatalogo();
  }

  gastos = g ? JSON.parse(g) : [];
  if (cf) config = Object.assign({}, config, JSON.parse(cf));
  notaActual = na ? JSON.parse(na) : null;
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
  config.nombre = document.getElementById('configNombre').value.trim();
  config.mensaje = document.getElementById('configMensaje').value.trim() || 'Gracias por su compra.';
  config.folioInicial = parseInt(document.getElementById('configFolio').value, 10) || 1;
  config.logoUrl = document.getElementById('configLogoUrl').value.trim();

  localStorage.setItem('nr_config', JSON.stringify(config));
  if (notaActual && !notaActual.cobrada) {
    notaActual.logoUri = config.logoUrl || '';
    guardarNotaActual();
  }
  actualizarLogoDisplay();
  mostrarToast('Configuración guardada ✓');
}

function guardarNotaActual() {
  localStorage.setItem('nr_notaActual', JSON.stringify(notaActual));
}

// ─────────────────────────────────────────────
// CREAR UNA NUEVA NOTA
// ─────────────────────────────────────────────
function crearNuevaNota() {
  const maxFolio = notas.reduce(function(max, n) {
    return Math.max(max, parseInt(n.numero, 10) || 0);
  }, (parseInt(config.folioInicial, 10) || 1) - 1);
  const numero = maxFolio + 1;

  notaActual = {
    id: generarId(),
    numero: numero,
    cobrada: false,
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
      fecha: new Date().toISOString().split('T')[0]
    },
    productos: [nuevaFila()],
    datosFactura: null
  };

  guardarNotaActual();
  cargarNotaEnEditor(notaActual);
}

function nuevaFila() {
  return {
    id: generarId(),
    cantidad: '',
    precioUnitario: '',
    descripcion: ''
  };
}

// ─────────────────────────────────────────────
// CARGAR NOTA EN EL EDITOR
// ─────────────────────────────────────────────
function cargarNotaEnEditor(nota) {
  notaActual = nota;
  if (!notaActual.cliente) {
    notaActual.cliente = {
      nombre: '',
      telefono: '',
      vendedor: '',
      direccion: '',
      email: '',
      fecha: new Date().toISOString().split('T')[0]
    };
  }
  if (!Array.isArray(notaActual.productos) || !notaActual.productos.length) {
    notaActual.productos = [nuevaFila()];
  }

  document.getElementById('notaNumBadge').textContent = 'No. ' + String(nota.numero).padStart(4, '0');
  document.getElementById('cobradaBadge').style.display = nota.cobrada ? 'flex' : 'none';
  document.getElementById('cobradaBanner').style.display = nota.cobrada ? 'flex' : 'none';

  document.getElementById('clienteNombre').value = nota.cliente.nombre || '';
  document.getElementById('clienteTelefono').value = nota.cliente.telefono || '';
  document.getElementById('clienteVendedor').value = nota.cliente.vendedor || '';
  document.getElementById('clienteDireccion').value = nota.cliente.direccion || '';
  document.getElementById('clienteEmail').value = nota.cliente.email || '';
  document.getElementById('clienteFecha').value = toInputDateValue(nota.cliente.fecha);

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

  document.getElementById('btnEfectivo').classList.toggle('active', nota.metodoPago !== 'transferencia');
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

    const inputCant = document.createElement('input');
    inputCant.type = 'text';
    inputCant.inputMode = 'decimal';
    inputCant.className = 'celda-cantidad';
    inputCant.placeholder = '0';
    inputCant.value = prod.cantidad || '';
    inputCant.addEventListener('input', function(e) {
      const val = limpiarNumero(e.target.value);
      e.target.value = val;
      cambiarCampoProd(prod.id, 'cantidad', val);
    });

    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'text';
    inputPrecio.inputMode = 'decimal';
    inputPrecio.className = 'celda-precio';
    inputPrecio.placeholder = '0.00';
    inputPrecio.value = prod.precioUnitario || '';
    inputPrecio.addEventListener('input', function(e) {
      const val = limpiarNumero(e.target.value);
      e.target.value = val;
      cambiarCampoProd(prod.id, 'precioUnitario', val);
    });

    const spanSub = document.createElement('span');
    spanSub.className = 'celda-subtotal';
    spanSub.textContent = formatCurrency(calcSubtotalFila(prod));

    const btnStar = document.createElement('button');
    btnStar.type = 'button';
    btnStar.className = 'btn-star';
    btnStar.title = 'Guardar en catálogo';
    btnStar.textContent = '⭐';
    btnStar.addEventListener('click', function() {
      const actual = obtenerFila(prod.id) || prod;
      const desc = (actual.descripcion || '').trim();
      if (!desc) {
        mostrarToast('Escribe una descripción primero');
        return;
      }
      agregarAlCatalogo(desc, actual.precioUnitario || '');
      mostrarToast('"' + desc + '" guardado en catálogo ✓');
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-delete-fila';
    btnDel.title = 'Eliminar fila';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', function() {
      eliminarFila(prod.id);
    });

    topRow.appendChild(inputCant);
    topRow.appendChild(inputPrecio);
    topRow.appendChild(spanSub);
    topRow.appendChild(btnStar);
    topRow.appendChild(btnDel);

    const inputDesc = document.createElement('input');
    inputDesc.type = 'text';
    inputDesc.className = 'celda-descripcion';
    inputDesc.placeholder = 'Descripción del producto o servicio';
    inputDesc.value = prod.descripcion || '';

    const sugWrap = document.createElement('div');
    sugWrap.className = 'sugerencias-wrapper';

    inputDesc.addEventListener('input', function(e) {
      cambiarCampoProd(prod.id, 'descripcion', e.target.value);
      mostrarSugerencias(prod.id, e.target.value, sugWrap);
    });

    div.appendChild(topRow);
    div.appendChild(inputDesc);
    div.appendChild(sugWrap);
    contenedor.appendChild(div);
  });

  actualizarEstadoCobrada();
}

function obtenerFila(id) {
  return notaActual.productos.find(function(p) {
    return p.id === id;
  });
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
  if (notaActual.productos.length <= 1) return;
  notaActual.productos = notaActual.productos.filter(function(p) {
    return p.id !== id;
  });
  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();
}

function agregarFila() {
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
  if (!texto || texto.trim().length < 2) return;

  const q = normalizarTexto(texto);
  const filtrados = catalogo
    .filter(function(p) {
      return normalizarTexto(p.nombre).includes(q) || normalizarTexto(p.codigo).includes(q);
    })
    .sort(function(a, b) {
      return (b.vecesUsado || 0) - (a.vecesUsado || 0);
    })
    .slice(0, 5);

  if (!filtrados.length) return;

  filtrados.forEach(function(p) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sugerencia-chip';
    const stockTxt = ' · Stock: ' + (parseFloat(p.stock) || 0);
    const precioTxt = p.precioUnitario ? '$' + (parseFloat(p.precioUnitario) || 0).toFixed(2) : '';
    btn.innerHTML =
      '<span>⭐ ' + escapeHtml(p.nombre) + escapeHtml(stockTxt) + '</span>' +
      (precioTxt ? '<strong>' + precioTxt + '</strong>' : '');

    btn.addEventListener('click', function() {
      aplicarSugerencia(prodId, p.nombre, p.precioUnitario, wrapper);
    });
    wrapper.appendChild(btn);
  });
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
    return normalizarTexto(c.nombre) === normalizarTexto(nombre)
      ? Object.assign({}, c, { vecesUsado: (c.vecesUsado || 0) + 1 })
      : c;
  });
  guardarCatalogo();
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

// ─────────────────────────────────────────────
// SECCIÓN IVA
// ─────────────────────────────────────────────
function actualizarSeccionIva() {
  const activo = !!notaActual.ivaActivo;
  const fiscalContainer = document.getElementById('fiscalContainer');
  const ivaLabel = document.getElementById('ivaLabel');

  fiscalContainer.style.display = activo ? 'flex' : 'none';
  ivaLabel.textContent = activo ? 'I.V.A. (16%)' : 'I.V.A. (desactivado)';
  actualizarFiscalWarning();
}

function actualizarFiscalWarning() {
  const warning = document.getElementById('fiscalWarning');
  if (warning) warning.style.display = 'none';
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

// ─────────────────────────────────────────────
// ESTADO COBRADA (bloquear campos)
// ─────────────────────────────────────────────
function actualizarEstadoCobrada() {
  const cobrada = !!(notaActual && notaActual.cobrada);
  const campos = document.querySelectorAll(
    '.campo-input, .celda-descripcion, .celda-cantidad, .celda-precio, .observaciones-input, .anticipo-input'
  );

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

  const btnEscanear = document.getElementById('btnEscanear');
  if (btnEscanear) btnEscanear.style.display = cobrada ? 'none' : 'inline-block';

  document.getElementById('btnGuardarPendiente').style.display = cobrada ? 'none' : 'flex';
  const btnCobrar = document.getElementById('btnCobrar');
  btnCobrar.innerHTML = cobrada ? '🔄 REIMPRIMIR / COMPARTIR' : '🖨️ COBRAR E IMPRIMIR';
}

// ─────────────────────────────────────────────
// BADGE PENDIENTES
// ─────────────────────────────────────────────
function actualizarBadgePendientes() {
  const pendientes = notas.filter(function(n) {
    return !n.cobrada;
  }).length;

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
// GUARDAR COMO PENDIENTE
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

  const idx = notas.findIndex(function(n) {
    return n.id === copia.id;
  });
  if (idx >= 0) {
    notas[idx] = copia;
  } else {
    notas.push(copia);
  }
  guardarNotas();

  const num = String(copia.numero).padStart(4, '0');
  mostrarToast('Nota #' + num + ' guardada como "Por Cobrar" ✓');
  crearNuevaNota();
}

// ─────────────────────────────────────────────
// COBRAR, INVENTARIO, COMPARTIR E IMPRIMIR
// ─────────────────────────────────────────────
function accionCobrar() {
  const esReimpresion = !!notaActual.cobrada;
  const num = String(notaActual.numero).padStart(4, '0');

  if (!esReimpresion) {
    notaActual.cobrada = true;
    const copia = JSON.parse(JSON.stringify(notaActual));
    const idx = notas.findIndex(function(n) {
      return n.id === copia.id;
    });
    if (idx >= 0) {
      notas[idx] = copia;
    } else {
      notas.push(copia);
    }
    guardarNotas();
    guardarNotaActual();
    descontarInventarioPorNota(notaActual);

    document.getElementById('cobradaBadge').style.display = 'flex';
    document.getElementById('cobradaBanner').style.display = 'flex';
    actualizarEstadoCobrada();
    actualizarBadgePendientes();
    recalcularTotales();

    mostrarToast('Nota #' + num + ' cobrada ✓');
  } else {
    mostrarToast('Reimprimiendo nota #' + num);
  }

  setTimeout(function() {
    if (!esReimpresion) {
      let yaCreoSiguiente = false;
      const prepararSiguiente = function() {
        if (yaCreoSiguiente) return;
        yaCreoSiguiente = true;
        window.removeEventListener('afterprint', prepararSiguiente);
        crearNuevaNota();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      window.addEventListener('afterprint', prepararSiguiente);
      window.print();
      setTimeout(prepararSiguiente, 1200);
    } else {
      window.print();
    }
  }, 150);
}

function armarTextoNota(nota, usarAsteriscosWhatsapp) {
  const b = usarAsteriscosWhatsapp ? '*' : '';
  const productosArr = Array.isArray(nota.productos) ? nota.productos : [];
  const subtotal = productosArr.reduce(function(s, p) {
    return s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0);
  }, 0);
  const iva = nota.ivaActivo ? subtotal * 0.16 : 0;
  const total = subtotal + iva;
  const anticipo = parseFloat(nota.anticipo) || 0;
  const saldo = Math.max(0, total - anticipo);
  const productos = productosArr.filter(function(p) {
    return p.descripcion && p.descripcion.trim();
  });

  let texto = '🧾 ' + b + 'Nota de Remisión #' + String(nota.numero).padStart(4, '0') + b + '\n';
  if (nota.cliente && nota.cliente.nombre) texto += 'Cliente: ' + nota.cliente.nombre + '\n';
  texto += 'Fecha: ' + formatDate(nota.cliente && nota.cliente.fecha) + '\n';

  if (productos.length) {
    texto += '\n' + b + 'Detalle:' + b + '\n';
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

  texto += '\nSubtotal: ' + formatCurrency(subtotal);
  if (nota.ivaActivo) texto += '\nI.V.A. (16%): ' + formatCurrency(iva);
  texto += '\n' + b + 'TOTAL: ' + formatCurrency(total) + b;

  if (anticipo > 0) {
    texto += '\nAnticipo: ' + formatCurrency(anticipo);
    texto += '\n' + b + 'Saldo pendiente: ' + formatCurrency(saldo) + b;
  }

  texto += '\nPago: ' + (nota.metodoPago === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo');
  if (config.nombre) texto += '\n\n' + config.nombre;
  texto += '\n' + (config.mensaje || 'Gracias por su compra.');

  return texto;
}

function compartirNota() {
  const texto = armarTextoNota(notaActual, false);
  if (navigator.share) {
    navigator.share({ title: 'Nota de Remisión', text: texto }).catch(function() {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(function() {
      mostrarToast('Nota copiada al portapapeles 📋');
    }).catch(function() {});
  }
}

function accionWhatsapp(notaOpcional) {
  const nota = notaOpcional || notaActual;
  const texto = armarTextoNota(nota, true);
  const url = 'https://wa.me/?text=' + encodeURIComponent(texto);
  window.open(url, '_blank');
}

function accionNuevaNota() {
  crearNuevaNota();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// ESCÁNER DE CÁMARA HD (CÓDIGO DE BARRAS / QR)
// ─────────────────────────────────────────────
function abrirEscaner() {
  if (notaActual && notaActual.cobrada) {
    mostrarToast('Esta nota ya fue cobrada');
    return;
  }
  if (typeof Html5Qrcode === 'undefined') {
    mostrarToast('⚠️ No se cargó el módulo de cámara. Revisa tu conexión.');
    return;
  }

  conteoSesionEscaner = 0;
  ultimoCodigoLeido = '';
  ultimaLecturaMs = 0;

  const estadoEl = document.getElementById('escanerEstado');
  const contadorEl = document.getElementById('escanerContador');
  if (estadoEl) {
    estadoEl.style.color = '#2B3A8F';
    estadoEl.textContent = 'Iniciando cámara HD...';
  }
  if (contadorEl) contadorEl.textContent = 'Productos escaneados en esta sesión: 0';

  document.getElementById('overlayEscaner').style.display = 'flex';

  // Esperar 300ms a que abra el modal para calcular bien el cuadro guía
  setTimeout(function() {
    if (escanerActivo) return;

    const formatosSoportados = typeof Html5QrcodeSupportedFormats !== 'undefined'
      ? [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      : undefined;

    html5QrScanner = new Html5Qrcode('readerEscaner', {
      formatsToSupport: formatosSoportados,
      verbose: false
    });

    const configCamara = {
      fps: 15,
      qrbox: function(viewfinderWidth, viewfinderHeight) {
        const ancho = Math.min(280, Math.floor(viewfinderWidth * 0.85));
        const alto = Math.min(130, Math.floor(viewfinderHeight * 0.55));
        return { width: ancho, height: alto };
      },
      aspectRatio: 1.5,
      videoConstraints: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        focusMode: 'continuous'
      }
    };

    html5QrScanner.start(
      { facingMode: 'environment' },
      configCamara,
      onCodigoEscaneado,
      function() {}
    ).then(function() {
      escanerActivo = true;
      if (estadoEl) estadoEl.textContent = 'Cámara lista · Centra las barras dentro del recuadro';
    }).catch(function() {
      escanerActivo = false;
      if (estadoEl) {
        estadoEl.style.color = '#e74c3c';
        estadoEl.textContent = '⚠️ No se pudo abrir la cámara. Verifica los permisos en Safari/Chrome.';
      }
    });
  }, 300);
}

function cerrarEscaner() {
  document.getElementById('overlayEscaner').style.display = 'none';
  if (html5QrScanner && escanerActivo) {
    escanerActivo = false;
    html5QrScanner.stop().then(function() {
      html5QrScanner.clear();
      html5QrScanner = null;
    }).catch(function() {
      html5QrScanner = null;
    });
  } else if (html5QrScanner) {
    try { html5QrScanner.clear(); } catch (e) {}
    html5QrScanner = null;
  }
}

function onCodigoEscaneado(decodedText) {
  const codigo = normalizarCodigo(decodedText);
  if (!codigo) return;

  const ahora = Date.now();
  // Pausa de 2.5 segundos para dar tiempo de retirar la etiqueta sin duplicar
  if (codigo === ultimoCodigoLeido && (ahora - ultimaLecturaMs) < 2500) {
    return;
  }
  ultimoCodigoLeido = codigo;
  ultimaLecturaMs = ahora;

  const producto = catalogo.find(function(c) {
    return normalizarCodigo(c.codigo) === codigo;
  });

  const estadoEl = document.getElementById('escanerEstado');
  const contadorEl = document.getElementById('escanerContador');

  if (!producto) {
    if (estadoEl) {
      estadoEl.style.color = '#e74c3c';
      estadoEl.textContent = '❌ Código "' + codigo + '" no registrado en Inventario';
    }
    mostrarToast('Código no encontrado: ' + codigo);
    return;
  }

  agregarProductoEscaneadoANota(producto);
  feedbackLecturaExitosa();
  conteoSesionEscaner++;

  if (estadoEl) {
    estadoEl.style.color = '#27ae60';
    estadoEl.textContent = '✓ +1 ' + producto.nombre + ' (listo para el siguiente...)';
  }
  if (contadorEl) {
    contadorEl.textContent = 'Productos escaneados en esta sesión: ' + conteoSesionEscaner;
  }
  mostrarToast('+1 ' + producto.nombre + ' ✓');
}

function agregarProductoEscaneadoANota(prodCatalogo) {
  // Si el producto ya está en la nota actual, suma +1 a la cantidad
  const filaExistente = notaActual.productos.find(function(p) {
    return normalizarTexto(p.descripcion) === normalizarTexto(prodCatalogo.nombre);
  });

  if (filaExistente) {
    const nuevaCant = redondearDosDecimales((parseFloat(filaExistente.cantidad) || 0) + 1);
    filaExistente.cantidad = String(nuevaCant);
    if (!filaExistente.precioUnitario && prodCatalogo.precioUnitario) {
      filaExistente.precioUnitario = prodCatalogo.precioUnitario;
    }
  } else {
    const filaVacia = notaActual.productos.find(function(p) {
      return !p.descripcion && !p.cantidad && !p.precioUnitario;
    });
    if (filaVacia) {
      filaVacia.descripcion = prodCatalogo.nombre;
      filaVacia.precioUnitario = prodCatalogo.precioUnitario || '';
      filaVacia.cantidad = '1';
    } else {
      const f = nuevaFila();
      f.descripcion = prodCatalogo.nombre;
      f.precioUnitario = prodCatalogo.precioUnitario || '';
      f.cantidad = '1';
      notaActual.productos.push(f);
    }
  }

  prodCatalogo.vecesUsado = (prodCatalogo.vecesUsado || 0) + 1;
  guardarCatalogo();

  renderizarProductos();
  recalcularTotales();
  guardarNotaActual();
}

// ─────────────────────────────────────────────
// ETIQUETAS IMPRIMIBLES (CÓDIGO DE BARRAS LINEAL)
// ─────────────────────────────────────────────
function abrirEtiquetaProducto(item) {
  const codigo = normalizarCodigo(item.codigo) || generarCodigoProducto();
  if (!item.codigo) {
    item.codigo = codigo;
    guardarCatalogo();
  }

  document.getElementById('etiquetaEmpresa').textContent = config.nombre || 'NOTA DE REMISIÓN';
  const codigoTxtEl = document.getElementById('etiquetaCodigoTxt');
  if (codigoTxtEl) {
    codigoTxtEl.textContent = codigo;
    codigoTxtEl.style.display = 'none'; // JsBarcode ya imprime la clave justo debajo de las barras
  }

  document.getElementById('etiquetaNombreTxt').textContent = item.nombre;
  document.getElementById('etiquetaPrecioTxt').textContent = item.precioUnitario
    ? formatCurrency(item.precioUnitario)
    : '';

  const barcodeBox = document.getElementById('etiquetaQrContainer');
  barcodeBox.innerHTML = '';

  if (typeof JsBarcode !== 'undefined') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    barcodeBox.appendChild(svg);
    JsBarcode(svg, codigo, {
      format: 'CODE128',
      width: 1.5,
      height: 38,
      displayValue: true,
      fontSize: 11,
      fontOptions: 'bold',
      margin: 2,
      background: '#ffffff',
      lineColor: '#000000'
    });
  } else {
    if (codigoTxtEl) codigoTxtEl.style.display = 'block';
    barcodeBox.innerHTML = '<div style="padding:8px;font-family:monospace;font-weight:700">' + escapeHtml(codigo) + '</div>';
  }

  document.getElementById('overlayEtiqueta').style.display = 'flex';
}

function cerrarEtiqueta() {
  document.getElementById('overlayEtiqueta').style.display = 'none';
}

function imprimirEtiquetaActual() {
  document.body.classList.add('imprimiendo-etiqueta');
  let limpio = false;
  const limpiarModoEtiqueta = function() {
    if (limpio) return;
    limpio = true;
    window.removeEventListener('afterprint', limpiarModoEtiqueta);
    document.body.classList.remove('imprimiendo-etiqueta');
  };
  window.addEventListener('afterprint', limpiarModoEtiqueta);
  window.print();
  setTimeout(limpiarModoEtiqueta, 1200);
}

// ─────────────────────────────────────────────
// CATÁLOGO DE PRODUCTOS (UNIDO A INVENTARIO)
// ─────────────────────────────────────────────
function abrirCatalogo() {
  renderizarCatalogo();
  document.getElementById('overlayCatalogo').style.display = 'flex';
}

function cerrarCatalogo() {
  document.getElementById('overlayCatalogo').style.display = 'none';
}

function renderizarCatalogo() {
  const busquedaEl = document.getElementById('catalogoBusqueda');
  const busqueda = busquedaEl ? normalizarTexto(busquedaEl.value) : '';
  const lista = document.getElementById('catalogoLista');

  let items = catalogo.slice().sort(function(a, b) {
    return (b.vecesUsado || 0) - (a.vecesUsado || 0);
  });

  if (busqueda) {
    items = items.filter(function(p) {
      return normalizarTexto(p.nombre).includes(busqueda) || normalizarTexto(p.codigo).includes(busqueda);
    });
  }

  document.getElementById('catalogoBusquedaWrap').style.display = catalogo.length > 4 ? 'flex' : 'none';
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

    const info = document.createElement('div');
    info.className = 'catalogo-item-info';

    const nombre = document.createElement('div');
    nombre.className = 'catalogo-item-nombre';
    nombre.textContent = prod.nombre;

    const meta = document.createElement('div');
    meta.className = 'catalogo-item-meta';
    const precioTxt = prod.precioUnitario ? formatCurrency(prod.precioUnitario) : 'Sin precio';
    const stockTxt = 'Stock: ' + (parseFloat(prod.stock) || 0) + ' pzs';
    const codTxt = prod.codigo ? ' · [' + prod.codigo + ']' : '';
    meta.textContent = precioTxt + ' · ' + stockTxt + codTxt;

    info.appendChild(nombre);
    info.appendChild(meta);

    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'btn-cat-add';
    btnAdd.title = 'Agregar a la nota';
    btnAdd.textContent = '＋';
    btnAdd.addEventListener('click', function() {
      seleccionarDeCatalogo(prod.nombre, prod.precioUnitario);
      cerrarCatalogo();
      mostrarToast('"' + prod.nombre + '" agregado a la nota ✓');
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-cat-delete';
    btnDel.title = 'Eliminar del catálogo';
    btnDel.textContent = '🗑';
    btnDel.addEventListener('click', function() {
      catalogo = catalogo.filter(function(c) {
        return c.id !== prod.id;
      });
      guardarCatalogo();
      renderizarCatalogo();
      mostrarToast('Eliminado del catálogo');
    });

    div.appendChild(info);
    div.appendChild(btnAdd);
    div.appendChild(btnDel);
    lista.appendChild(div);
  });
}

function agregarAlCatalogo(nombre, precio, stockInicial, codigoOpcional) {
  const codLimpio = normalizarCodigo(codigoOpcional);
  const existe = catalogo.find(function(c) {
    return normalizarTexto(c.nombre) === normalizarTexto(nombre);
  });
  if (existe) {
    existe.vecesUsado = (existe.vecesUsado || 0) + 1;
    if (precio !== undefined && precio !== '') existe.precioUnitario = precio;
    if (codLimpio) existe.codigo = codLimpio;
    else if (!existe.codigo) existe.codigo = generarCodigoProducto();
    if (stockInicial !== undefined && stockInicial !== '') {
      existe.stock = redondearDosDecimales(Math.max(0, parseFloat(stockInicial) || 0));
    }
  } else {
    catalogo.push({
      id: generarId(),
      codigo: codLimpio || generarCodigoProducto(),
      nombre: nombre,
      precioUnitario: precio || '',
      stock: stockInicial !== undefined && stockInicial !== '' ? redondearDosDecimales(Math.max(0, parseFloat(stockInicial) || 0)) : 0,
      minimo: 5,
      vecesUsado: 1
    });
  }
  guardarCatalogo();
}

function accionAgregarAlCatalogo() {
  const nombre = document.getElementById('catalogoNombreInput').value.trim();
  const precio = limpiarNumero(document.getElementById('catalogoPrecioInput').value.trim());
  if (!nombre) {
    mostrarToast('Escribe el nombre del producto');
    return;
  }
  agregarAlCatalogo(nombre, precio);
  document.getElementById('catalogoNombreInput').value = '';
  document.getElementById('catalogoPrecioInput').value = '';
  renderizarCatalogo();
  mostrarToast('"' + nombre + '" agregado al catálogo ✓');
}

function seleccionarDeCatalogo(nombre, precio) {
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
    return normalizarTexto(c.nombre) === normalizarTexto(nombre);
  });
  if (enCat) {
    enCat.vecesUsado = (enCat.vecesUsado || 0) + 1;
    guardarCatalogo();
  }
}

// ─────────────────────────────────────────────
// INVENTARIO UNIDO AL CATÁLOGO + ALERTAS DE STOCK
// ─────────────────────────────────────────────
function sincronizarStockEnCatalogo(nombre, stockValor, precioOpcional, codigoOpcional) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return;
  const stockNum = redondearDosDecimales(Math.max(0, parseFloat(stockValor) || 0));
  const precioNum = precioOpcional !== undefined && precioOpcional !== ''
    ? limpiarNumero(precioOpcional)
    : '';
  const codLimpio = normalizarCodigo(codigoOpcional);

  const existe = catalogo.find(function(c) {
    return normalizarTexto(c.nombre) === normalizarTexto(limpio);
  });

  if (existe) {
    existe.stock = stockNum;
    if (precioNum !== '') existe.precioUnitario = precioNum;
    if (codLimpio) existe.codigo = codLimpio;
    else if (!existe.codigo) existe.codigo = generarCodigoProducto();
  } else {
    catalogo.push({
      id: generarId(),
      codigo: codLimpio || generarCodigoProducto(),
      nombre: limpio,
      precioUnitario: precioNum,
      stock: stockNum,
      minimo: 5,
      vecesUsado: 0
    });
  }
  guardarCatalogo();
}

function accionGuardarInventario() {
  const nombre = document.getElementById('invNombreInput').value.trim();
  const codigoEl = document.getElementById('invCodigoInput');
  const codigo = codigoEl ? normalizarCodigo(codigoEl.value) : '';
  const stockRaw = document.getElementById('invStockInput').value;
  const precio = limpiarNumero(document.getElementById('invPrecioInput').value.trim());

  if (!nombre) {
    mostrarToast('⚠️ Escribe el nombre del producto');
    return;
  }
  if (stockRaw === '' || isNaN(parseFloat(stockRaw)) || parseFloat(stockRaw) < 0) {
    mostrarToast('⚠️ Indica una cantidad válida de inventario');
    return;
  }

  // Verificar que el código no pertenezca a otro producto distinto
  if (codigo) {
    const duplicado = catalogo.find(function(c) {
      return normalizarCodigo(c.codigo) === codigo && normalizarTexto(c.nombre) !== normalizarTexto(nombre);
    });
    if (duplicado) {
      mostrarToast('⚠️ El código "' + codigo + '" ya lo usa "' + duplicado.nombre + '"');
      return;
    }
  }

  sincronizarStockEnCatalogo(nombre, parseFloat(stockRaw), precio, codigo);

  document.getElementById('invNombreInput').value = '';
  if (codigoEl) codigoEl.value = '';
  document.getElementById('invStockInput').value = '';
  document.getElementById('invPrecioInput').value = '';

  renderizarInventario();
  mostrarToast('Inventario actualizado y vinculado al catálogo ✓');
}

function cambiarMinimoInventario(id) {
  const prod = catalogo.find(function(c) {
    return c.id === id;
  });
  if (!prod) return;

  const actual = prod.minimo !== undefined ? prod.minimo : 5;
  const nuevoStr = prompt(
    'Aviso de stock bajo para "' + prod.nombre + '"\n\n¿Con cuántas piezas restantes quieres que te avise antes de que se acabe?',
    String(actual)
  );
  if (nuevoStr === null) return;

  const nuevoMin = parseFloat(limpiarNumero(nuevoStr));
  if (isNaN(nuevoMin) || nuevoMin < 0) {
    mostrarToast('⚠️ Número no válido');
    return;
  }

  prod.minimo = redondearDosDecimales(nuevoMin);
  guardarCatalogo();
  renderizarInventario();
  mostrarToast('Alerta configurada a ' + prod.minimo + ' piezas ✓');
}

function ajustarStockItem(id, delta) {
  let alertaManual = '';

  catalogo = catalogo.map(function(c) {
    if (c.id !== id) return c;
    const actual = parseFloat(c.stock) || 0;
    const nuevoStock = redondearDosDecimales(Math.max(0, actual + delta));
    const minimo = c.minimo !== undefined ? parseFloat(c.minimo) : 5;

    if (delta < 0) {
      if (nuevoStock <= 0) {
        alertaManual = '🔴 AGOTADO: ' + c.nombre + ' quedó en 0 piezas.';
      } else if (nuevoStock <= minimo) {
        alertaManual = '⚠️ STOCK BAJO: ' + c.nombre + ' bajó a ' + nuevoStock + ' piezas (mínimo: ' + minimo + ').';
      }
    }

    return Object.assign({}, c, { stock: nuevoStock });
  });

  guardarCatalogo();
  renderizarInventario();

  if (alertaManual) {
    alert('📢 AVISO DE INVENTARIO:\n\n' + alertaManual);
  }
}

function renderizarInventario() {
  const lista = document.getElementById('inventarioLista');
  if (!lista) return;
  lista.innerHTML = '';

  const items = catalogo.slice().sort(function(a, b) {
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  if (!items.length) {
    lista.innerHTML = '<div class="catalogo-empty">📦<br>No hay productos en inventario.<br>Agrega uno arriba (ej. Blanco con 30).</div>';
    return;
  }

  items.forEach(function(item) {
    const stock = parseFloat(item.stock) || 0;
    const minimo = item.minimo !== undefined ? parseFloat(item.minimo) : 5;
    const precioTxt = item.precioUnitario ? formatCurrency(item.precioUnitario) : 'Sin precio';
    const codigoTxt = item.codigo || '';
    let cardClass = 'inv-card';
    let pillClass = 'inv-stock-pill ok';

    if (stock <= 0) {
      cardClass += ' stock-agotado';
      pillClass = 'inv-stock-pill agotado';
    } else if (stock <= minimo) {
      cardClass += ' stock-bajo';
      pillClass = 'inv-stock-pill bajo';
    }

    const card = document.createElement('div');
    card.className = cardClass;

    card.innerHTML =
      '<div class="inv-top">' +
        '<div>' +
          '<div class="inv-nombre">' + escapeHtml(item.nombre) + '</div>' +
          (codigoTxt ? '<span class="inv-codigo-pill">🏷️ ' + escapeHtml(codigoTxt) + '</span>' : '') +
          '<div class="inv-meta">Precio: ' + precioTxt + ' · Aviso mínimo: ' + minimo + ' pzs</div>' +
        '</div>' +
        '<span class="' + pillClass + '">' + stock + ' pzs</span>' +
      '</div>' +
      '<div class="inv-controles">' +
        '<button type="button" class="inv-btn salida">-1</button>' +
        '<button type="button" class="inv-btn entrada">+1</button>' +
        '<button type="button" class="inv-btn entrada">+10</button>' +
        '<button type="button" class="inv-btn">🔔 Mín: ' + minimo + '</button>' +
        '<button type="button" class="inv-btn etiqueta">🏷️ Etiqueta</button>' +
        '<button type="button" class="inv-btn usar">Editar</button>' +
      '</div>';

    const botones = card.querySelectorAll('.inv-btn');
    botones[0].addEventListener('click', function() {
      ajustarStockItem(item.id, -1);
    });
    botones[1].addEventListener('click', function() {
      ajustarStockItem(item.id, 1);
    });
    botones[2].addEventListener('click', function() {
      ajustarStockItem(item.id, 10);
    });
    botones[3].addEventListener('click', function() {
      cambiarMinimoInventario(item.id);
    });
    botones[4].addEventListener('click', function() {
      abrirEtiquetaProducto(item);
    });
    botones[5].addEventListener('click', function() {
      document.getElementById('invNombreInput').value = item.nombre;
      const codEl = document.getElementById('invCodigoInput');
      if (codEl) codEl.value = item.codigo || '';
      document.getElementById('invStockInput').value = stock;
      document.getElementById('invPrecioInput').value = item.precioUnitario || '';
      document.getElementById('invStockInput').focus();
    });

    lista.appendChild(card);
  });
}

function descontarInventarioPorNota(nota) {
  if (!nota || !Array.isArray(nota.productos)) return;

  const consumos = new Map();
  nota.productos.forEach(function(p) {
    const key = normalizarTexto(p.descripcion);
    const cant = parseFloat(p.cantidad) || 0;
    if (!key || cant <= 0) return;
    consumos.set(key, (consumos.get(key) || 0) + cant);
  });

  if (!consumos.size) return;

  let huboDescuento = false;
  const alertasDisparadas = [];

  catalogo = catalogo.map(function(item) {
    const key = normalizarTexto(item.nombre);
    if (!consumos.has(key)) return item;

    huboDescuento = true;
    const stockActual = parseFloat(item.stock) || 0;
    const restar = consumos.get(key);
    const nuevoStock = redondearDosDecimales(Math.max(0, stockActual - restar));
    const minimo = item.minimo !== undefined ? parseFloat(item.minimo) : 5;

    if (nuevoStock <= 0) {
      alertasDisparadas.push('🔴 AGOTADO: ' + item.nombre + ' quedó en 0 piezas.');
    } else if (nuevoStock <= minimo) {
      alertasDisparadas.push('⚠️ STOCK BAJO: ' + item.nombre + ' tiene solo ' + nuevoStock + ' piezas (mínimo: ' + minimo + ').');
    }

    return Object.assign({}, item, {
      stock: nuevoStock
    });
  });

  if (huboDescuento) {
    guardarCatalogo();
  }

  if (alertasDisparadas.length > 0) {
    alert('📢 AVISO DE INVENTARIO:\n\n' + alertasDisparadas.join('\n'));
  }
}

// ─────────────────────────────────────────────
// AUTOCOMPLETAR NOMBRE DEL CLIENTE
// ─────────────────────────────────────────────
function obtenerClientesPrevios() {
  const map = new Map();
  notas.forEach(function(n) {
    const nombre = (n.cliente && n.cliente.nombre) ? n.cliente.nombre.trim() : '';
    const key = normalizarTexto(nombre);
    if (key && !map.has(key)) {
      map.set(key, {
        nombre: nombre,
        telefono: (n.cliente && n.cliente.telefono) || '',
        email: (n.cliente && n.cliente.email) || '',
        direccion: (n.cliente && n.cliente.direccion) || ''
      });
    }
  });
  return Array.from(map.values());
}

function manejarAutocompletarNombre(texto) {
  notaActual.cliente.nombre = texto;
  guardarNotaActual();

  const container = document.getElementById('autocompleteContainer');
  if (!texto || texto.trim().length < 2) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const q = normalizarTexto(texto);
  const sugs = obtenerClientesPrevios()
    .filter(function(c) {
      return normalizarTexto(c.nombre).includes(q);
    })
    .slice(0, 4);

  if (!sugs.length) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  sugs.forEach(function(c) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'autocomplete-item';
    item.innerHTML =
      '<span class="autocomplete-nombre">' + escapeHtml(c.nombre) + '</span>' +
      (c.telefono ? '<span class="autocomplete-meta">📞 ' + escapeHtml(c.telefono) + '</span>' : '');

    item.addEventListener('click', function() {
      seleccionarCliente(c);
    });
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
let filtroHistorialActual = 'todas';

function abrirMenu() {
  actualizarBadgePendientes();
  document.getElementById('overlayMenu').style.display = 'flex';
}

function cerrarMenu() {
  document.getElementById('overlayMenu').style.display = 'none';
}

function mostrarVista(tipo) {
  cerrarMenu();
  const buscador = document.getElementById('busquedaHistorialInput');

  if (tipo === 'historial') {
    filtroHistorialActual = 'todas';
    if (buscador) buscador.value = '';
    renderizarHistorial('todas');
    document.getElementById('historialTitulo').textContent = 'Historial de Ventas';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'pendientes') {
    filtroHistorialActual = 'pendientes';
    if (buscador) buscador.value = '';
    renderizarHistorial('pendientes');
    document.getElementById('historialTitulo').textContent = 'Notas por Cobrar';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'inventario') {
    renderizarInventario();
    document.getElementById('vistaInventario').style.display = 'flex';
  } else if (tipo === 'gastos') {
    actualizarPantallaGastos();
    document.getElementById('vistaGastos').style.display = 'flex';
  } else if (tipo === 'iva') {
    filtroHistorialActual = 'iva';
    if (buscador) buscador.value = '';
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
  else if (tipo === 'inventario') document.getElementById('vistaInventario').style.display = 'none';
  else if (tipo === 'clientes') document.getElementById('vistaClientes').style.display = 'none';
  else if (tipo === 'finanzas') document.getElementById('vistaFinanzas').style.display = 'none';
  else if (tipo === 'config') document.getElementById('vistaConfig').style.display = 'none';
  else if (tipo === 'gastos') document.getElementById('vistaGastos').style.display = 'none';
}

// ─── HISTORIAL ───────────────────────────────
function renderizarHistorial(filtro) {
  if (filtro) filtroHistorialActual = filtro;
  const lista = document.getElementById('historialLista');
  const buscador = document.getElementById('busquedaHistorialInput');
  const q = buscador ? normalizarTexto(buscador.value) : '';

  lista.innerHTML = '';

  let notasFiltradas = notas.slice().sort(function(a, b) {
    return (parseInt(b.numero, 10) || 0) - (parseInt(a.numero, 10) || 0);
  });

  if (filtroHistorialActual === 'pendientes') {
    notasFiltradas = notasFiltradas.filter(function(n) {
      return !n.cobrada;
    });
  } else if (filtroHistorialActual === 'iva') {
    notasFiltradas = notasFiltradas.filter(function(n) {
      return !!n.ivaActivo;
    });
  }

  if (q) {
    notasFiltradas = notasFiltradas.filter(function(n) {
      const folioStr = String(n.numero || '').padStart(4, '0');
      const nombreStr = normalizarTexto(n.cliente && n.cliente.nombre);
      return nombreStr.includes(q) || folioStr.includes(q) || String(n.numero || '').includes(q);
    });
  }

  if (!notasFiltradas.length) {
    lista.innerHTML = '<div class="catalogo-empty">📭<br>No hay notas en esta sección todavía.</div>';
    return;
  }

  notasFiltradas.forEach(function(nota) {
    const tot = calcTotalNota(nota);
    const anticipo = parseFloat(nota.anticipo) || 0;
    const saldo = Math.max(0, tot - anticipo);
    const card = document.createElement('div');
    card.className = 'item-card';

    const badgesHtml =
      '<span class="badge-estado ' + (nota.cobrada ? 'cobrada' : 'pendiente') + '">' +
      (nota.cobrada ? '✓ COBRADA' : '🕒 POR COBRAR') + '</span>' +
      (nota.ivaActivo ? '<span class="badge-estado iva">I.V.A. 16%</span>' : '');

    const saldoSub = (!nota.cobrada && anticipo > 0)
      ? '<div class="item-card-sub" style="color:#e74c3c">Anticipo: ' + formatCurrency(anticipo) + ' · Saldo: ' + formatCurrency(saldo) + '</div>'
      : '';

    card.innerHTML =
      '<div class="item-card-top">' +
      '<div>' +
      '<div class="item-card-title">No. ' + String(nota.numero).padStart(4, '0') + ' · ' + escapeHtml((nota.cliente && nota.cliente.nombre) || 'Cliente sin nombre') + '</div>' +
      '<div class="item-card-sub">' + escapeHtml(formatDate(nota.cliente && nota.cliente.fecha)) + '</div>' +
      saldoSub +
      '<div>' + badgesHtml + '</div>' +
      '</div>' +
      '<div class="item-card-monto">' + formatCurrency(tot) + '</div>' +
      '</div>' +
      '<div class="item-card-actions">' +
      '<button type="button" class="btn-card-action btn-abrir-nota">Abrir</button>' +
      '<button type="button" class="btn-card-action wa btn-wa-nota">WhatsApp</button>' +
      '<button type="button" class="btn-card-action danger btn-del-nota">Borrar</button>' +
      '</div>';

    card.querySelector('.btn-abrir-nota').addEventListener('click', function() {
      const copia = JSON.parse(JSON.stringify(nota));
      cargarNotaEnEditor(copia);
      guardarNotaActual();
      cerrarVista('historial');
      mostrarToast('Nota #' + String(nota.numero).padStart(4, '0') + ' cargada');
    });

    card.querySelector('.btn-wa-nota').addEventListener('click', function() {
      accionWhatsapp(nota);
    });

    card.querySelector('.btn-del-nota').addEventListener('click', function() {
      if (!confirm('¿Eliminar la nota #' + String(nota.numero).padStart(4, '0') + '?')) return;
      notas = notas.filter(function(item) {
        return item.id !== nota.id;
      });
      guardarNotas();
      actualizarBadgePendientes();
      renderizarHistorial(filtroHistorialActual);
      mostrarToast('Nota eliminada');
    });

    lista.appendChild(card);
  });
}

// ─── CLIENTES ────────────────────────────────
function renderizarClientes() {
  const lista = document.getElementById('clientesLista');
  lista.innerHTML = '';

  const map = new Map();
  notas.forEach(function(n) {
    const nombre = (n.cliente && n.cliente.nombre) ? n.cliente.nombre.trim() : '';
    const key = normalizarTexto(nombre);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        nombre: nombre,
        telefono: (n.cliente && n.cliente.telefono) || '',
        notas: [],
        totalVentas: 0
      });
    }
    const entry = map.get(key);
    entry.notas.push(n);
    entry.totalVentas += calcTotalNota(n);
  });

  if (!map.size) {
    lista.innerHTML = '<div class="catalogo-empty">👥<br>Aún no hay clientes registrados.<br>Guarda algunas notas primero.</div>';
    return;
  }

  const clientes = Array.from(map.values()).sort(function(a, b) {
    return b.totalVentas - a.totalVentas;
  });

  clientes.forEach(function(c) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML =
      '<div class="item-card-top">' +
      '<div>' +
      '<div class="item-card-title">' + escapeHtml(c.nombre) + '</div>' +
      '<div class="item-card-sub">' + c.notas.length + ' nota' + (c.notas.length !== 1 ? 's' : '') + (c.telefono ? ' · 📞 ' + escapeHtml(c.telefono) : '') + '</div>' +
      '</div>' +
      '<div class="item-card-monto">' + formatCurrency(c.totalVentas) + '</div>' +
      '</div>';
    lista.appendChild(card);
  });
}

// ─── FINANZAS ─────────────────────────────────
function calcTotalNota(n) {
  const prods = Array.isArray(n.productos) ? n.productos : [];
  const sub = prods.reduce(function(s, p) {
    return s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0);
  }, 0);
  return n.ivaActivo ? sub * 1.16 : sub;
}

function renderizarFinanzas() {
  const body = document.getElementById('finanzasBody');
  body.innerHTML = '';

  const cobradas = notas.filter(function(n) { return n.cobrada; });
  const pendientes = notas.filter(function(n) { return !n.cobrada; });

  const totalCobrado = cobradas.reduce(function(sum, n) { return sum + calcTotalNota(n); }, 0);
  const totalPendiente = pendientes.reduce(function(sum, n) { return sum + calcTotalNota(n); }, 0);
  const totalVentas = totalCobrado + totalPendiente;
  const totalGastosTotal = gastos.reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);
  const utilidadNeta = totalCobrado - totalGastosTotal;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '10px';

  wrapper.innerHTML =
    '<div class="finanzas-resumen">' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">TOTAL VENTAS</span><span class="finanza-kpi-value">' + formatCurrency(totalVentas) + '</span><span class="finanza-kpi-sub">' + notas.length + ' notas</span></div>' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">COBRADO</span><span class="finanza-kpi-value" style="color:#27ae60">' + formatCurrency(totalCobrado) + '</span><span class="finanza-kpi-sub">' + cobradas.length + ' notas</span></div>' +
    '</div>' +
    '<div class="finanzas-resumen">' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">POR COBRAR</span><span class="finanza-kpi-value" style="color:#e74c3c">' + formatCurrency(totalPendiente) + '</span><span class="finanza-kpi-sub">' + pendientes.length + ' notas</span></div>' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">GASTOS TOTAL</span><span class="finanza-kpi-value" style="color:#e67e22">' + formatCurrency(totalGastosTotal) + '</span><span class="finanza-kpi-sub">' + gastos.length + ' registros</span></div>' +
    '</div>' +
    '<div class="card" style="padding:14px"><div class="total-row"><span class="total-label">UTILIDAD (COBRADO - GASTOS)</span><span class="total-value" style="color:' + (utilidadNeta >= 0 ? '#27ae60' : '#e74c3c') + '">' + formatCurrency(utilidadNeta) + '</span></div></div>' +
    '<div id="finanzasGastosCat"></div>';

  body.appendChild(wrapper);

  const catMap = new Map();
  gastos.forEach(function(g) {
    const cat = g.categoria || '📋 Otros';
    catMap.set(cat, (catMap.get(cat) || 0) + (parseFloat(g.monto) || 0));
  });

  if (catMap.size > 0) {
    const catContainer = body.querySelector('#finanzasGastosCat');
    let filasHtml = '';
    catMap.forEach(function(monto, cat) {
      filasHtml +=
        '<div class="total-row" style="padding:10px 14px;border-bottom:1px solid #f0f1f5">' +
        '<span class="total-label">' + escapeHtml(cat) + '</span>' +
        '<span class="total-value">' + formatCurrency(monto) + '</span>' +
        '</div>';
    });
    catContainer.innerHTML =
      '<div class="card">' +
      '<div class="seccion-header" style="background:#e67e22"><span class="seccion-icon">💸</span><span class="seccion-title">GASTOS POR CATEGORÍA</span></div>' +
      '<div>' + filasHtml + '</div>' +
      '</div>';
  }
}

// ─────────────────────────────────────────────
// EVENTOS PRINCIPALES
// ─────────────────────────────────────────────
function inicializarEventos() {
  document.getElementById('btnMenu').addEventListener('click', abrirMenu);

  document.getElementById('overlayMenu').addEventListener('click', function(e) {
    if (e.target === this) cerrarMenu();
  });
  document.getElementById('overlayCatalogo').addEventListener('click', function(e) {
    if (e.target === this) cerrarCatalogo();
  });
  const overlayEscaner = document.getElementById('overlayEscaner');
  if (overlayEscaner) {
    overlayEscaner.addEventListener('click', function(e) {
      if (e.target === this) cerrarEscaner();
    });
  }
  const overlayEtiqueta = document.getElementById('overlayEtiqueta');
  if (overlayEtiqueta) {
    overlayEtiqueta.addEventListener('click', function(e) {
      if (e.target === this) cerrarEtiqueta();
    });
  }

  document.getElementById('btnCerrarCatalogo').addEventListener('click', cerrarCatalogo);

  const btnEscanear = document.getElementById('btnEscanear');
  if (btnEscanear) btnEscanear.addEventListener('click', abrirEscaner);

  const btnCerrarEscaner = document.getElementById('btnCerrarEscaner');
  if (btnCerrarEscaner) btnCerrarEscaner.addEventListener('click', cerrarEscaner);

  const btnListoEscaner = document.getElementById('btnListoEscaner');
  if (btnListoEscaner) btnListoEscaner.addEventListener('click', cerrarEscaner);

  const btnCerrarEtiqueta = document.getElementById('btnCerrarEtiqueta');
  if (btnCerrarEtiqueta) btnCerrarEtiqueta.addEventListener('click', cerrarEtiqueta);

  const btnImprimirEtiqueta = document.getElementById('btnImprimirEtiqueta');
  if (btnImprimirEtiqueta) btnImprimirEtiqueta.addEventListener('click', imprimirEtiquetaActual);

  const btnGenerarCodigoInv = document.getElementById('btnGenerarCodigoInv');
  if (btnGenerarCodigoInv) {
    btnGenerarCodigoInv.addEventListener('click', function() {
      const codEl = document.getElementById('invCodigoInput');
      if (codEl) {
        codEl.value = generarCodigoProducto();
        mostrarToast('Código generado ✓');
      }
    });
  }

  document.getElementById('btnCatalogo').addEventListener('click', abrirCatalogo);
  document.getElementById('btnCatalogoAgregar').addEventListener('click', accionAgregarAlCatalogo);
  document.getElementById('catalogoBusqueda').addEventListener('input', renderizarCatalogo);
  document.getElementById('catalogoNombreInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') accionAgregarAlCatalogo();
  });

  document.getElementById('clienteNombre').addEventListener('input', function(e) {
    manejarAutocompletarNombre(e.target.value);
  });
  document.getElementById('clienteTelefono').addEventListener('input', function(e) {
    notaActual.cliente.telefono = e.target.value.replace(/\D/g, '').slice(0, 10);
    e.target.value = notaActual.cliente.telefono;
    guardarNotaActual();
  });
  document.getElementById('clienteVendedor').addEventListener('input', function(e) {
    notaActual.cliente.vendedor = e.target.value;
    guardarNotaActual();
  });
  document.getElementById('clienteDireccion').addEventListener('input', function(e) {
    notaActual.cliente.direccion = e.target.value;
    guardarNotaActual();
  });
  document.getElementById('clienteEmail').addEventListener('input', function(e) {
    notaActual.cliente.email = e.target.value;
    guardarNotaActual();
  });
  document.getElementById('clienteFecha').addEventListener('change', function(e) {
    notaActual.cliente.fecha = e.target.value || new Date().toISOString().split('T')[0];
    guardarNotaActual();
  });

  document.getElementById('ivaToggle').addEventListener('change', function() {
    if (notaActual.cobrada) {
      mostrarToast('No se puede cambiar el IVA de una nota cobrada');
      this.checked = notaActual.ivaActivo;
      return;
    }
    notaActual.ivaActivo = this.checked;
    if (this.checked) {
      notaActual.datosFactura = notaActual.datosFactura || { rfc: '', regimenFiscal: '', codigoPostal: '' };
    } else {
      notaActual.datosFactura = null;
    }
    actualizarSeccionIva();
    recalcularTotales();
    guardarNotaActual();
  });

  document.getElementById('fiscalRFC').addEventListener('input', function(e) {
    if (!notaActual.datosFactura) notaActual.datosFactura = {};
    notaActual.datosFactura.rfc = e.target.value.toUpperCase();
    e.target.value = notaActual.datosFactura.rfc;
    actualizarFiscalWarning();
    guardarNotaActual();
  });
  document.getElementById('fiscalRegimen').addEventListener('input', function(e) {
    if (!notaActual.datosFactura) notaActual.datosFactura = {};
    notaActual.datosFactura.regimenFiscal = e.target.value;
    actualizarFiscalWarning();
    guardarNotaActual();
  });
  document.getElementById('fiscalCP').addEventListener('input', function(e) {
    if (!notaActual.datosFactura) notaActual.datosFactura = {};
    notaActual.datosFactura.codigoPostal = e.target.value.replace(/\D/g, '').slice(0, 5);
    e.target.value = notaActual.datosFactura.codigoPostal;
    actualizarFiscalWarning();
    guardarNotaActual();
  });

  document.getElementById('facturadaToggle').addEventListener('change', function() {
    notaActual.facturada = this.checked;
    actualizarFacuturadaDisplay();
    const idx = notas.findIndex(function(n) {
      return n.id === notaActual.id;
    });
    if (idx >= 0) {
      notas[idx].facturada = notaActual.facturada;
      guardarNotas();
    }
    guardarNotaActual();
  });

  document.getElementById('btnEfectivo').addEventListener('click', function() {
    notaActual.metodoPago = 'efectivo';
    document.getElementById('btnEfectivo').classList.add('active');
    document.getElementById('btnTransferencia').classList.remove('active');
    guardarNotaActual();
  });
  document.getElementById('btnTransferencia').addEventListener('click', function() {
    notaActual.metodoPago = 'transferencia';
    document.getElementById('btnTransferencia').classList.add('active');
    document.getElementById('btnEfectivo').classList.remove('active');
    guardarNotaActual();
  });

  document.getElementById('anticipoInput').addEventListener('input', function(e) {
    const val = limpiarNumero(e.target.value);
    e.target.value = val;
    notaActual.anticipo = val;
    recalcularTotales();
    guardarNotaActual();
  });

  document.getElementById('observaciones').addEventListener('input', function(e) {
    notaActual.observaciones = e.target.value;
    guardarNotaActual();
  });

  document.getElementById('btnAgregarFila').addEventListener('click', agregarFila);
  document.getElementById('btnGuardarPendiente').addEventListener('click', accionGuardarPendiente);
  document.getElementById('btnCobrar').addEventListener('click', accionCobrar);
  document.getElementById('btnWhatsapp').addEventListener('click', function() {
    accionWhatsapp(notaActual);
  });

  document.getElementById('btnNuevaNota2').addEventListener('click', function() {
    crearNuevaNota();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const buscadorHistorial = document.getElementById('busquedaHistorialInput');
  if (buscadorHistorial) {
    buscadorHistorial.addEventListener('input', function() {
      renderizarHistorial(filtroHistorialActual);
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      cerrarMenu();
      cerrarCatalogo();
      cerrarEscaner();
      cerrarEtiqueta();
    }
  });
}

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
function init() {
  cargarDatos();
  inicializarEventos();

  if (notaActual) {
    cargarNotaEnEditor(notaActual);
  } else {
    crearNuevaNota();
  }

  const gastoFechaEl = document.getElementById('gastoFecha');
  if (gastoFechaEl && !gastoFechaEl.value) {
    gastoFechaEl.value = new Date().toISOString().split('T')[0];
  }
}

document.addEventListener('DOMContentLoaded', init);

// ─────────────────────────────────────────────
// REINICIO TOTAL
// ─────────────────────────────────────────────
function confirmarReinicioTotal() {
  const confirmacion1 = confirm('¿Estás seguro de que quieres borrar TODO? Se perderán notas, clientes, catálogo y gastos guardados.');
  if (!confirmacion1) return;

  const confirmacion2 = confirm('ESTA ACCIÓN NO SE PUEDE DESHACER. ¿Realmente quieres dejar la app como nueva?');
  if (!confirmacion2) return;

  localStorage.removeItem('nr_notas');
  localStorage.removeItem('nr_catalogo');
  localStorage.removeItem('nr_config');
  localStorage.removeItem('nr_notaActual');
  localStorage.removeItem('nr_gastos');

  notas = [];
  catalogo = [];
  gastos = [];
  config = {
    nombre: '',
    mensaje: 'Gracias por su compra.',
    folioInicial: 1,
    logoUrl: ''
  };

  cerrarVista('config');
  crearNuevaNota();
  actualizarBadgePendientes();
  mostrarToast('Todos los datos se reiniciaron ✓');
}

// ─────────────────────────────────────────────
// MÓDULO DE GASTOS
// ─────────────────────────────────────────────
let gastoCategoriaActual = '⛽ Combustible';
let gastoFiltroMes = new Date().toISOString().substring(0, 7);

function setGastoCat(elemento, cat) {
  const botones = elemento.parentElement.querySelectorAll('.cat-btn');
  botones.forEach(function(btn) {
    btn.classList.remove('active');
  });
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

  const nuevoGasto = {
    id: generarId(),
    categoria: gastoCategoriaActual,
    concepto: concepto,
    monto: monto,
    fecha: fecha
  };

  gastos.unshift(nuevoGasto);
  guardarGastos();

  document.getElementById('gastoConcepto').value = '';
  document.getElementById('gastoMonto').value = '';

  actualizarPantallaGastos();
  mostrarToast('Gasto registrado ✓');
}

function eliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  gastos = gastos.filter(function(g) {
    return g.id !== id;
  });
  guardarGastos();
  actualizarPantallaGastos();
  mostrarToast('Gasto eliminado');
}

function cambiarFiltroMesGastos(delta) {
  const partes = gastoFiltroMes.split('-');
  let anio = parseInt(partes[0], 10);
  let mes = parseInt(partes[1], 10) - 1;
  mes += delta;
  if (mes < 0) {
    mes = 11;
    anio--;
  }
  if (mes > 11) {
    mes = 0;
    anio++;
  }
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

  const gastosFiltrados = gastos.filter(function(g) {
    return g.fecha && g.fecha.startsWith(gastoFiltroMes);
  });

  const totalFiltrado = gastosFiltrados.reduce(function(s, g) {
    return s + (parseFloat(g.monto) || 0);
  }, 0);

  const partes = gastoFiltroMes.split('-');
  const nombreMes = MESES[parseInt(partes[1], 10) - 1] + ' ' + partes[0];

  lista.innerHTML =
    '<div class="card" style="margin-bottom:10px">' +
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
    item.className = 'item-card';
    item.innerHTML =
      '<div class="item-card-top">' +
      '<div>' +
      '<div class="item-card-title" style="color:#e67e22">' + escapeHtml(g.categoria || '📋 Otros') + ' · ' + escapeHtml(g.concepto) + '</div>' +
      '<div class="item-card-sub">' + escapeHtml(formatDate(g.fecha)) + '</div>' +
      '</div>' +
      '<div class="item-card-monto" style="color:#e67e22">' + formatCurrency(g.monto) + '</div>' +
      '</div>' +
      '<div class="item-card-actions">' +
      '<button type="button" class="btn-card-action danger" onclick="eliminarGasto(\'' + escapeHtml(g.id) + '\')">Borrar</button>' +
      '</div>';
    lista.appendChild(item);
  });
}
