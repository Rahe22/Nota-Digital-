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
  catalogo = c ? JSON.parse(c) : [];
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
    notaActual.cliente = { nombre: '', telefono: '', vendedor: '', direccion: '', email: '', fecha: new Date().toISOString().split('T')[0] };
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
    sugWrap.className = 'sugerencias-wrap';

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

  const q = texto.trim().toLowerCase();
  const filtrados = catalogo
    .filter(function(p) {
      return p.nombre.toLowerCase().includes(q);
    })
    .sort(function(a, b) {
      return (b.vecesUsado || 0) - (a.vecesUsado || 0);
    })
    .slice(0, 5);

  if (!filtrados.length) return;

  const cont = document.createElement('div');
  cont.className = 'sugerencias-container';

  filtrados.forEach(function(p) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sugerencia-item';
    btn.innerHTML =
      '<span>⭐</span>' +
      '<span class="sugerencia-nombre">' + escapeHtml(p.nombre) + '</span>' +
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
    return c.nombre === nombre
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
  return !!(
    df.rfc && df.rfc.trim() &&
    df.regimenFiscal && df.regimenFiscal.trim() &&
    df.codigoPostal && df.codigoPostal.trim()
  );
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
  if (notaActual.ivaActivo && !verificarIvaOk()) {
    warning.style.display = 'flex';
  } else {
    warning.style.display = 'none';
  }
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
// COBRAR, COMPARTIR E IMPRIMIR
// ─────────────────────────────────────────────
function accionCobrar() {
  if (!verificarIvaOk()) {
    mostrarToast('⚠️ Completa los datos fiscales');
    return;
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
  mostrarToast('Nota #' + num + ' cobrada ✓');

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
// CATÁLOGO DE PRODUCTOS
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
  const busqueda = busquedaEl ? busquedaEl.value.trim().toLowerCase() : '';
  const lista = document.getElementById('catalogoLista');

  let items = catalogo.slice().sort(function(a, b) {
    return (b.vecesUsado || 0) - (a.vecesUsado || 0);
  });

  if (busqueda) {
    items = items.filter(function(p) {
      return p.nombre.toLowerCase().includes(busqueda);
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

    const nombre = document.createElement('span');
    nombre.className = 'catalogo-item-nombre';
    nombre.textContent = prod.nombre;

    const meta = document.createElement('span');
    meta.className = 'catalogo-item-meta';
    const precioTxt = prod.precioUnitario ? formatCurrency(prod.precioUnitario) : 'Sin precio';
    const usosTxt = (prod.vecesUsado || 0) + ' uso' + ((prod.vecesUsado || 0) !== 1 ? 's' : '');
    meta.textContent = precioTxt + ' · ' + usosTxt;

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

function agregarAlCatalogo(nombre, precio) {
  const existe = catalogo.find(function(c) {
    return c.nombre.toLowerCase() === nombre.toLowerCase();
  });
  if (existe) {
    existe.vecesUsado = (existe.vecesUsado || 0) + 1;
    if (precio) existe.precioUnitario = precio;
  } else {
    catalogo.push({
      id: generarId(),
      nombre: nombre,
      precioUnitario: precio || '',
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
    return c.nombre.toLowerCase() === nombre.toLowerCase();
  });
  if (enCat) {
    enCat.vecesUsado = (enCat.vecesUsado || 0) + 1;
    guardarCatalogo();
  }
}

// ─────────────────────────────────────────────
// AUTOCOMPLETAR NOMBRE DEL CLIENTE
// ─────────────────────────────────────────────
function obtenerClientesPrevios() {
  const map = new Map();
  notas.forEach(function(n) {
    const nombre = (n.cliente && n.cliente.nombre) ? n.cliente.nombre.trim() : '';
    const key = nombre.toLowerCase();
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

  const q = texto.trim().toLowerCase();
  const sugs = obtenerClientesPrevios()
    .filter(function(c) {
      return c.nombre.toLowerCase().includes(q);
    })
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
  if (tipo === 'historial') {
    filtroHistorialActual = 'todas';
    document.getElementById('buscadorHistorial').value = '';
    renderizarHistorial('todas');
    document.getElementById('historialTitulo').textContent = 'Historial de Ventas';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'pendientes') {
    filtroHistorialActual = 'pendientes';
    document.getElementById('buscadorHistorial').value = '';
    renderizarHistorial('pendientes');
    document.getElementById('historialTitulo').textContent = 'Notas por Cobrar';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'gastos') {
    actualizarPantallaGastos();
    document.getElementById('vistaGastos').style.display = 'flex';
  } else if (tipo === 'iva') {
    filtroHistorialActual = 'iva';
    document.getElementById('buscadorHistorial').value = '';
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
  const buscador = document.getElementById('buscadorHistorial');
  const q = buscador ? buscador.value.trim().toLowerCase() : '';

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
      const nombreStr = ((n.cliente && n.cliente.nombre) || '').toLowerCase();
      return nombreStr.includes(q) || folioStr.includes(q) || String(n.numero || '').includes(q);
    });
  }

  if (!notasFiltradas.length) {
    lista.innerHTML = '<div class="historial-empty">📭<br>No hay notas en esta sección todavía.</div>';
    return;
  }

  notasFiltradas.forEach(function(nota) {
    const tot = calcTotalNota(nota);
    const card = document.createElement('div');
    card.className = 'nota-card';

    const badgesHtml =
      '<span class="' + (nota.cobrada ? 'badge-cobrada' : 'badge-pendiente') + '">' +
      (nota.cobrada ? '✓ COBRADA' : '🕒 POR COBRAR') + '</span>' +
      (nota.ivaActivo ? '<span class="badge-iva">I.V.A. 16%</span>' : '');

    card.innerHTML =
      '<div class="nota-card-header">' +
      '<span class="nota-card-num">No. ' + String(nota.numero).padStart(4, '0') + '</span>' +
      '<span class="nota-card-fecha">' + escapeHtml(formatDate(nota.cliente && nota.cliente.fecha)) + '</span>' +
      '</div>' +
      '<div class="nota-card-cliente">' + escapeHtml((nota.cliente && nota.cliente.nombre) || 'Cliente sin nombre') + '</div>' +
      '<div class="nota-card-total">' + formatCurrency(tot) + '</div>' +
      '<div class="nota-card-badges">' + badgesHtml + '</div>' +
      '<div class="nota-card-actions">' +
      '<button type="button" class="btn-card-action btn-abrir-nota">Abrir</button>' +
      '<button type="button" class="btn-card-action btn-wa-nota">WhatsApp</button>' +
      '<button type="button" class="btn-card-action danger btn-del-nota">Borrar</button>' +
      '</div>';

    card.querySelector('.btn-abrir-nota').addEventListener('click', function() {
      const copia = JSON.parse(JSON.stringify(nota));
      guardarNotaActual();
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
    const key = nombre.toLowerCase();
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
    lista.innerHTML = '<div class="historial-empty">👥<br>Aún no hay clientes registrados.<br>Guarda algunas notas primero.</div>';
    return;
  }

  const clientes = Array.from(map.values()).sort(function(a, b) {
    return b.totalVentas - a.totalVentas;
  });

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
  wrapper.style.gap = '12px';

  wrapper.innerHTML =
    '<div class="finanzas-resumen">' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">TOTAL VENTAS</span><span class="finanza-kpi-value">' + formatCurrency(totalVentas) + '</span><span class="finanza-kpi-sub">' + notas.length + ' notas</span></div>' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">COBRADO</span><span class="finanza-kpi-value" style="color:#27ae60">' + formatCurrency(totalCobrado) + '</span><span class="finanza-kpi-sub">' + cobradas.length + ' notas</span></div>' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">POR COBRAR</span><span class="finanza-kpi-value" style="color:#e74c3c">' + formatCurrency(totalPendiente) + '</span><span class="finanza-kpi-sub">' + pendientes.length + ' notas</span></div>' +
    '<div class="finanza-kpi"><span class="finanza-kpi-label">GASTOS TOTAL</span><span class="finanza-kpi-value" style="color:#e67e22">' + formatCurrency(totalGastosTotal) + '</span><span class="finanza-kpi-sub">' + gastos.length + ' registros</span></div>' +
    '</div>' +
    '<div class="card"><div class="total-row"><span class="total-label">UTILIDAD (COBRADO - GASTOS)</span><span class="total-value" style="color:' + (utilidadNeta >= 0 ? '#27ae60' : '#e74c3c') + '">' + formatCurrency(utilidadNeta) + '</span></div></div>' +
    '<div id="finanzasGastosCat"></div>';

  body.appendChild(wrapper);

  const catMap = new Map();
  gastos.forEach(function(g) {
    const cat = g.categoria || '💼 Otros';
    catMap.set(cat, (catMap.get(cat) || 0) + (parseFloat(g.monto) || 0));
  });

  if (catMap.size > 0) {
    const catContainer = body.querySelector('#finanzasGastosCat');
    let filasHtml = '';
    catMap.forEach(function(monto, cat) {
      filasHtml +=
        '<div class="total-row">' +
        '<span class="total-label">' + escapeHtml(cat) + '</span>' +
        '<span class="total-value">' + formatCurrency(monto) + '</span>' +
        '</div>';
    });
    catContainer.innerHTML =
      '<div class="card" style="overflow:hidden">' +
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

  document.getElementById('btnCerrarCatalogo').addEventListener('click', cerrarCatalogo);

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

  document.getElementById('buscadorHistorial').addEventListener('input', function() {
    renderizarHistorial(filtroHistorialActual);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      cerrarMenu();
      cerrarCatalogo();
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
      '<span class="nota-card-num" style="color:#e67e22">' + escapeHtml(g.categoria || '💼 Otros') + '</span>' +
      '<span class="nota-card-fecha">' + escapeHtml(formatDate(g.fecha)) + '</span>' +
      '</div>' +
      '<div class="nota-card-cliente">' + escapeHtml(g.concepto) + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span class="nota-card-total">' + formatCurrency(g.monto) + '</span>' +
      '<button type="button" class="btn-card-action danger" style="flex:0 0 auto;padding:6px 12px" onclick="eliminarGasto(\'' + escapeHtml(g.id) + '\')">Borrar</button>' +
      '</div>';
    lista.appendChild(item);
  });
}
