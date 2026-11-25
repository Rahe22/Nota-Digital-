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

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function normalizarTexto(t) {
  return String(t || '').trim().toLowerCase();
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
    return Object.assign({ stock: 0, vecesUsado: 0 }, item);
  }) : [];
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
      return normalizarTexto(p.nombre).includes(q);
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
  const yaEstabaCobrada = !!notaActual.cobrada;

  if (!yaEstabaCobrada) {
    descontarInventarioPorNota(notaActual);
  }

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

  document.getElementById('cobradaBadge').style.display = 'flex';
  document.getElementById('cobradaBanner').style.display = 'flex';
  actualizarEstadoCobrada();
  actualizarBadgePendientes();
  recalcularTotales();

  const num = String(notaActual.numero).padStart(4, '0');
  mostrarToast(yaEstabaCobrada ? 'Reimprimiendo nota #' + num : 'Nota #' + num + ' cobrada y stock actualizado ✓');

  setTimeout(function() {
    window.print();
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
      return normalizarTexto(p.nombre).includes(busqueda);
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
    const usosTxt = (prod.vecesUsado || 0) + ' uso' + ((prod.vecesUsado || 0) !== 1 ? 's' : '');
    meta.textContent = precioTxt + ' · ' + stockTxt + ' · ' + usosTxt;

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

function agregarAlCatalogo(nombre, precio, stockInicial) {
  const existe = catalogo.find(function(c) {
    return normalizarTexto(c.nombre) === normalizarTexto(nombre);
  });
  if (existe) {
    existe.vecesUsado = (existe.vecesUsado || 0) + 1;
    if (precio !== undefined && precio !== '') existe.precioUnitario = precio;
    if (stockInicial !== undefined && stockInicial !== '') {
      existe.stock = Math.max(0, parseFloat(stockInicial) || 0);
    }
  } else {
    catalogo.push({
      id: generarId(),
      nombre: nombre,
      precioUnitario: precio || '',
      stock: stockInicial !== undefined && stockInicial !== '' ? Math.max(0, parseFloat(stockInicial) || 0) : 0,
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
// INVENTARIO UNIDO AL CATÁLOGO
// ─────────────────────────────────────────────
function sincronizarStockEnCatalogo(nombre, stockValor, precioOpcional) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return;
  const stockNum = Math.max(0, parseFloat(stockValor) || 0);
  const precioNum = precioOpcional !== undefined && precioOpcional !== ''
    ? limpiarNumero(precioOpcional)
    : '';

  const existe = catalogo.find(function(c) {
    return normalizarTexto(c.nombre) === normalizarTexto(limpio);
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
  const nombre = document.getElementById('invNombreInput').value.trim();
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

  sincronizarStockEnCatalogo(nombre, parseFloat(stockRaw), precio);

  document.getElementById('invNombreInput').value = '';
  document.getElementById('invStockInput').value = '';
  document.getElementById('invPrecioInput').value = '';

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
    const precioTxt = item.precioUnitario ? formatCurrency(item.precioUnitario) : 'Sin precio';
    let cardClass = 'inv-card';
    let pillClass = 'inv-stock-pill ok';
    if (stock <= 0) {
      cardClass += ' stock-agotado';
      pillClass = 'inv-stock-pill agotado';
    } else if (stock <= 5) {
      cardClass += ' stock-bajo';
      pillClass = 'inv-stock-pill bajo';
    }

    const card = document.createElement('div');
    card.className = cardClass;

    card.innerHTML =
      '<div class="inv-top">' +
      '<div>' +
      '<div class="inv-nombre">' + escapeHtml(item.nombre) + '</div>' +
      '<div class="inv-meta">Precio catálogo: ' + precioTxt + '</div>' +
      '</div>' +
      '<span class="' + pillClass + '">' + stock + ' pzs</span>' +
      '</div>' +
      '<div class="inv-controles">' +
      '<button type="button" class="inv-btn salida">-1</button>' +
      '<button type="button" class="inv-btn entrada">+1</button>' +
      '<button type="button" class="inv-btn entrada">+10</button>' +
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
      document.getElementById('invNombreInput').value = item.nombre;
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
  catalogo = catalogo.map(function(item) {
    const key = normalizarTexto(item.nombre);
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
// AUTOCOMPLETAR NOMBRE DEL CLIENTE
// ─────────────────────────────────────────────
function obtenerClientesPrevios() {
  const map = new
