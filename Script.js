// =============================================
// NOTA DE REMISIÓN — script.js (Optimizado 58mm)
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
  return valor.toLocaleString('es-MX', {
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
  return new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function escapeHtml(t) {
  return String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mostrarToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
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
  if (cf) config = { ...config, ...JSON.parse(cf) };
  notaActual = na ? JSON.parse(na) : null;
}

// Generador de texto plano exclusivo para la App de Impresión (Alineado a 32 caracteres)
function generarTextoTicketPlano() {
  const MAX_CARACTERES = 32;

  const centrar = (t) => {
    if (t.length >= MAX_CARACTERES) return t.substring(0, MAX_CARACTERES);
    return " ".repeat(Math.floor((MAX_CARACTERES - t.length) / 2)) + t;
  };

  const alinear = (izq, der) => {
    const disponible = MAX_CARACTERES - der.length;
    if (izq.length >= disponible) return izq.substring(0, disponible - 1) + " " + der;
    return izq + " ".repeat(disponible - izq.length) + der;
  };

  const subtotal = calcSubtotalGeneral();
  const total = calcTotal(subtotal, notaActual.ivaActivo);
  const iva = calcIVA(subtotal, notaActual.ivaActivo);
  const anticipo = parseFloat(notaActual.anticipo) || 0;
  const saldo = calcSaldo(total, notaActual.anticipo);
  const productos = notaActual.productos.filter(p => p.descripcion && p.descripcion.trim());

  let t = "";
  t += centrar(config.nombre || "MEGASERIGRAFICA") + "\n";
  t += centrar("Nota de Remision") + "\n";
  t += centrar("Folio: " + String(notaActual.numero).padStart(4, '0')) + "\n";
  t += centrar("Fecha: " + formatDate(notaActual.cliente.fecha)) + "\n";
  t += "--------------------------------\n";
  t += "Cliente: " + (notaActual.cliente.nombre || "Público en General").toUpperCase() + "\n";
  if (notaActual.cliente.telefono) t += "Tel: " + notaActual.cliente.telefono + "\n";
  t += "--------------------------------\n";

  productos.forEach(p => {
    const cant = parseFloat(p.cantidad) || 1;
    const precio = parseFloat(p.precioUnitario) || 0;
    t += p.descripcion.toUpperCase() + "\n";
    t += alinear(`  ${cant} x $${precio.toFixed(2)}`, `$${(cant * precio).toFixed(2)}`) + "\n";
  });

  t += "--------------------------------\n";
  t += alinear("SUBTOTAL:", `$${subtotal.toFixed(2)}`) + "\n";
  if (notaActual.ivaActivo) t += alinear("I.V.A. (16%):", `$${iva.toFixed(2)}`) + "\n";
  t += alinear("TOTAL:", `$${total.toFixed(2)}`) + "\n";

  if (anticipo > 0) {
    t += alinear("ANTICIPO:", `$${anticipo.toFixed(2)}`) + "\n";
    t += alinear(saldo > 0 ? "SALDO PEND:" : "✓ LIQUIDADO:", `$${saldo.toFixed(2)}`) + "\n";
  }
  t += "--------------------------------\n";
  t += "Pago: " + (notaActual.metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo') + "\n\n";
  t += centrar(config.mensaje || "¡Gracias por su compra!") + "\n\n\n\n";
  return t;
}

// Función auxiliar para construir texto de WhatsApp desde CUALQUIER objeto nota
function construirTextoWhatsapp(n) {
  const sub = n.productos.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0), 0);
  const iva = n.ivaActivo ? sub * 0.16 : 0;
  const tot = sub + iva;
  const ant = parseFloat(n.anticipo) || 0;
  const sal = Math.max(0, tot - ant);
  const prods = n.productos.filter(p => p.descripcion && p.descripcion.trim());

  let txt = '*Nota de Remisión #' + String(n.numero).padStart(4, '0') + '*\n';
  txt += 'Cliente: ' + (n.cliente && n.cliente.nombre ? n.cliente.nombre : 'Público en General') + '\n';
  txt += 'Fecha: ' + formatDate(n.cliente ? n.cliente.fecha : new Date()) + '\n';

  if (prods.length) {
    txt += '\n*Detalle:*\n';
    prods.forEach(p => {
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
  config.nombre = document.getElementById('configNombre').value;
  config.mensaje = document.getElementById('configMensaje').value;
  config.folioInicial = parseInt(document.getElementById('configFolio').value) || 1;
  config.logoUrl = document.getElementById('configLogoUrl').value;
  localStorage.setItem('nr_config', JSON.stringify(config));

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
  const maxFolio = notas.reduce((max, n) => Math.max(max, n.numero || 0), config.folioInicial - 1);
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

// ─────────────────────────────────────────────
// CARGAR NOTA EN EL EDITOR
// ─────────────────────────────────────────────

function cargarNotaEnEditor(nota) {
  notaActual = nota;

  if (!notaActual.cliente) {
    notaActual.cliente = { nombre: '', telefono: '', vendedor: '', direccion: '', email: '', fecha: new Date().toISOString() };
  }

  document.getElementById('notaNumBadge').textContent = 'No. ' + String(nota.numero).padStart(4, '0');
  document.getElementById('cobradaBadge').style.display = nota.cobrada ? 'flex' : 'none';
  document.getElementById('cobradaBanner').style.display = nota.cobrada ? 'flex' : 'none';

  document.getElementById('clienteNombre').value = notaActual.cliente.nombre || '';
  document.getElementById('clienteTelefono').value = notaActual.cliente.telefono || '';
  document.getElementById('clienteVendedor').value = notaActual.cliente.vendedor || '';

  const dirInput = document.getElementById('clienteDireccion');
  if (dirInput) dirInput.value = notaActual.cliente.direccion || '';

  const emailInput = document.getElementById('clienteEmail');
  if (emailInput) emailInput.value = notaActual.cliente.email || '';

  document.getElementById('fechaTexto').textContent = formatDate(notaActual.cliente.fecha);

  const ivaToggle = document.getElementById('ivaToggle');
  ivaToggle.checked = nota.ivaActivo;
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

  document.getElementById('facturadaToggle').checked = nota.facturada;
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

  notaActual.productos.forEach(function(prod, idx) {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.dataset.id = prod.id;

    const subtotal = calcSubtotalFila(prod);

    div.innerHTML =
      '<div class="fila-top-row">' +
        '<input type="text" class="celda-cantidad" value="' + escapeHtml(prod.cantidad) + '" placeholder="0" inputmode="decimal" data-field="cantidad">' +
        '<input type="text" class="celda-precio" value="' + escapeHtml(prod.precioUnitario) + '" placeholder="0.00" inputmode="decimal" data-field="precioUnitario">' +
        '<span class="celda-subtotal">' + formatCurrency(subtotal) + '</span>' +
        '<button class="btn-star" title="Guardar en catálogo" data-id="' + prod.id + '">⭐</button>' +
        '<button class="btn-delete-fila" title="Eliminar fila" data-id="' + prod.id + '">🗑</button>' +
      '</div>' +
      '<div class="sugerencias-wrapper"></div>' +
      '<input type="text" class="celda-descripcion" value="' + escapeHtml(prod.descripcion) + '" placeholder="Descripción del producto o servicio" data-field="descripcion">';

    div.querySelector('[data-field="cantidad"]').addEventListener('input', function(e) {
      cambiarCampoProd(prod.id, 'cantidad', limpiarNumero(e.target.value));
    });

    div.querySelector('[data-field="precioUnitario"]').addEventListener('input', function(e) {
      cambiarCampoProd(prod.id, 'precioUnitario', limpiarNumero(e.target.value));
    });

    div.querySelector('[data-field="descripcion"]').addEventListener('input', function(e) {
      cambiarCampoProd(prod.id, 'descripcion', e.target.value);
      mostrarSugerencias(prod.id, e.target.value, div.querySelector('.sugerencias-wrapper'));
    });

    div.querySelector('.btn-star').addEventListener('click', function() {
      const p = obtenerFila(prod.id);
      if (!p || !p.descripcion.trim()) return;
      agregarAlCatalogo(p.descripcion.trim(), p.precioUnitario);
      mostrarToast('"' + p.descripcion + '" guardado en catálogo ⭐');
    });

    div.querySelector('.btn-delete-fila').addEventListener('click', function() {
      eliminarFila(prod.id);
    });

    contenedor.appendChild(div);
  });
}

function limpiarNumero(t) {
  const clean = t.replace(/[^0-9.]/g, '');
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
  if (notaActual.productos.length <= 1) return;
  notaActual.productos = notaActual.productos.filter(function(p) { return p.id !== id; });
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
  if (texto.trim().length < 2) return;

  const q = texto.trim().toLowerCase();
  const filtrados = catalogo
    .filter(function(p) { return p.nombre.toLowerCase().includes(q); })
    .sort(function(a, b) { return b.vecesUsado - a.vecesUsado; })
    .slice(0, 5);

  if (!filtrados.length) return;

  const cont = document.createElement('div');
  cont.className = 'sugerencias-container';

  filtrados.forEach(function(p) {
    const btn = document.createElement('button');
    btn.className = 'sugerencia-item';
    btn.innerHTML =
      '<span>⭐</span>' +
      '<span class="sugerencia-nombre">' + escapeHtml(p.nombre) + '</span>' +
      (p.precioUnitario ? '<span class="sugerencia-precio">$' + parseFloat(p.precioUnitario).toFixed(2) + '</span>' : '');

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
  return !!(df.rfc && df.rfc.trim() && df.regimenFiscal && df.regimenFiscal.trim() && df.codigoPostal && df.codigoPostal.trim());
}

// ─────────────────────────────────────────────
// SECCIÓN IVA Y CONFIGURACIÓN FISCAL
// ─────────────────────────────────────────────

function actualizarSeccionIva() {
  const activo = notaActual.ivaActivo;
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

function actualizarEstadoCobrada() {
  const cobrada = notaActual.cobrada;
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
  const btnCobrar = document.getElementById('btnCobrar');
  btnCobrar.innerHTML = cobrada ? '🔄 REIMPRIMIR / IMPRIMIR TICKET' : '🖨️ COBRAR E IMPRIMIR';
}

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
// GUARDAR COMO PENDIENTE / COBRAR
// ─────────────────────────────────────────────

function accionGuardarPendiente() {
  const tieneNombre = notaActual.cliente && notaActual.cliente.nombre && notaActual.cliente.nombre.trim().length > 0;
  const tieneProducto = notaActual.productos.some(function(p) { return p.descripcion && p.descripcion.trim().length > 0; });

  if (!tieneNombre && !tieneProducto) {
    mostrarToast('Agrega el nombre del cliente o un producto primero');
    return;
  }

  const copia = JSON.parse(JSON.stringify(notaActual));
  copia.cobrada = false;

  const idx = notas.findIndex(function(n) { return n.id === copia.id; });
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

function accionCobrar() {
  if (!verificarIvaOk()) {
    mostrarToast('⚠️ Completa los datos fiscales');
    return;
  }

  const esReimpresion = notaActual.cobrada;

  if (!esReimpresion) {
    notaActual.cobrada = true;
    const copia = JSON.parse(JSON.stringify(notaActual));
    const idx = notas.findIndex(function(n) { return n.id === copia.id; });
    if (idx >= 0) {
      notas[idx] = copia;
    } else {
      notas.push(copia);
    }
    guardarNotas();

    document.getElementById('cobradaBadge').style.display = 'flex';
    document.getElementById('cobradaBanner').style.display = 'flex';
    actualizarEstadoCobrada();
    actualizarBadgePendientes();
    recalcularTotales();

    const num = String(notaActual.numero).padStart(4, '0');
    mostrarToast('Nota #' + num + ' cobrada ✓');
  }

  const textoParaTicketera = generarTextoTicketPlano();

  navigator.clipboard.writeText(textoParaTicketera).then(() => {
    alert("¡Nota copiada con éxito!\n\nAl darle 'Aceptar', se abrirá tu app de impresión. Deja presionado el cuadro blanco del centro, dale 'Pegar' y presiona el botón 'Print Text' para sacar el ticket.");
    window.location.href = "posprinter://";
  }).catch(() => {
    imprimirTicket58mm();
  });

  compartirNota();

  if (!esReimpresion) {
    setTimeout(function() {
      crearNuevaNota();
    }, 1200);
  }
}

// ─────────────────────────────────────────────
// MÓDULO DE IMPRESIÓN EXCLUSIVO DE 58MM
// ─────────────────────────────────────────────

function imprimirTicket58mm() {
  const subtotal = calcSubtotalGeneral();
  const total = calcTotal(subtotal, notaActual.ivaActivo);
  const iva = calcIVA(subtotal, notaActual.ivaActivo);
  const anticipo = parseFloat(notaActual.anticipo) || 0;
  const saldo = calcSaldo(total, notaActual.anticipo);
  const productos = notaActual.productos.filter(function(p) { return p.descripcion && p.descripcion.trim(); });

  let iframe = document.getElementById('ticketPrintIframe');
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
    '.center { text-align: center; }' +
    '.right { text-align: right; }' +
    '.bold { font-weight: bold; }' +
    '.linea { border-top: 1px dashed #000; margin: 8px 0; }' +
    '.flex-row { display: flex; justify-content: space-between; }' +
    '</style></head><body>';

  html += '<div class="center bold" style="font-size:14px;">' + (config.nombre || 'MEGASERIGRAFICA') + '</div>';
  html += '<div class="center">Nota de Remision</div>';
  html += '<div class="center">Folio: ' + String(notaActual.numero).padStart(4, '0') + '</div>';
  html += '<div class="center">Fecha: ' + formatDate(notaActual.cliente.fecha) + '</div>';

  html += '<div class="linea"></div>';
  html += '<div><span class="bold">Cliente:</span> ' + (notaActual.cliente.nombre || 'Público en General') + '</div>';
  if (notaActual.cliente.telefono) html += '<div><span class="bold">Tel:</span> ' + notaActual.cliente.telefono + '</div>';
  if (notaActual.cliente.vendedor) html += '<div><span class="bold">Vend:</span> ' + notaActual.cliente.vendedor + '</div>';

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
  if (notaActual.ivaActivo) {
    html += '<div class="flex-row"><span>I.V.A. (16%):</span><span class="right">' + iva.toFixed(2) + '</span></div>';
  }
  html += '<div class="flex-row bold" style="font-size:13px;"><span>TOTAL:</span><span class="right">' + total.toFixed(2) + '</span></div>';

  if (anticipo > 0) {
    html += '<div class="flex-row"><span>ANTICIPO:</span><span class="right">' + anticipo.toFixed(2) + '</span></div>';
    html += '<div class="flex-row bold"><span>SALDO PEND:</span><span class="right">' + saldo.toFixed(2) + '</span></div>';
  }

  html += '<div class="linea"></div>';
  html += '<div><span class="bold">Método Pago:</span> ' + (notaActual.metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo') + '</div>';

  html += '<br><div class="center bold">' + (config.mensaje || '¡Gracias por su compra!') + '</div>';
  html += '<br><br><br></body></html>';

  doc.write(html);
  doc.close();

  setTimeout(function() {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 350);
}

// ─────────────────────────────────────────────
// COMPARTIR Y WHATSAPP TEXTUAL
// ─────────────────────────────────────────────

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
  const url = 'https://wa.me/?text=' + encodeURIComponent(texto);
  window.open(url, '_blank');
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
  const dia = parseInt(document.getElementById('fechaDia').value) || 1;
  const mes = parseInt(document.getElementById('fechaMes').value) || 1;
  const anio = parseInt(document.getElementById('fechaAnio').value) || new Date().getFullYear();
  const fecha = construirFecha(dia, mes, anio);
  notaActual.cliente.fecha = fecha.toISOString();
  document.getElementById('fechaTexto').textContent = formatDate(fecha);
  guardarNotaActual();
  cerrarSelectorFecha();
}

function actualizarMesPreview() {
  const mes = parseInt(document.getElementById('fechaMes').value);
  const anio = document.getElementById('fechaAnio').value;
  const el = document.getElementById('fechaMesPreview');
  if (mes >= 1 && mes <= 12) {
    el.textContent = MESES[mes - 1] + ' ' + anio;
  } else {
    el.textContent = '';
  }
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
  const busqueda = document.getElementById('catalogoBusqueda').value.trim().toLowerCase();
  const lista = document.getElementById('catalogoLista');

  let items = catalogo.slice().sort(function(a, b) { return b.vecesUsado - a.vecesUsado; });
  if (busqueda) {
    items = items.filter(function(p) { return p.nombre.toLowerCase().includes(busqueda); });
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

    div.innerHTML =
      '<div class="catalogo-item-info">' +
        '<div class="catalogo-item-nombre">' + escapeHtml(prod.nombre) + '</div>' +
        '<div class="catalogo-item-meta">' +
          (prod.vecesUsado > 1 ? 'Usado ' + prod.vecesUsado + ' veces' : 'Nuevo') +
          (prod.precioUnitario ? ' · $' + parseFloat(prod.precioUnitario).toFixed(2) : '') +
        '</div>' +
      '</div>' +
      '<button class="btn-cat-add" title="Agregar a la nota">+</button>' +
      '<button class="btn-cat-delete" title="Eliminar del catálogo">🗑</button>';

    div.querySelector('.btn-cat-add').addEventListener('click', function() {
      seleccionarDeCatalogo(prod.nombre, prod.precioUnitario);
      cerrarCatalogo();
    });

    div.querySelector('.btn-cat-delete').addEventListener('click', function() {
      if (confirm('¿Eliminar "' + prod.nombre + '" del catálogo?')) {
        catalogo = catalogo.filter(function(c) { return c.id !== prod.id; });
        guardarCatalogo();
        renderizarCatalogo();
      }
    });

    lista.appendChild(div);
  });
}

function agregarAlCatalogo(nombre, precio) {
  const existe = catalogo.find(function(c) { return c.nombre.toLowerCase() === nombre.toLowerCase(); });
  if (existe) {
    existe.vecesUsado = (existe.vecesUsado || 0) + 1;
    if (precio) existe.precioUnitario = precio;
  } else {
    catalogo.push({ id: generarId(), nombre: nombre, precioUnitario: precio || '', vecesUsado: 1 });
  }
  guardarCatalogo();
}

function accionAgregarAlCatalogo() {
  const nombre = document.getElementById('catalogoNombreInput').value.trim();
  const precio = document.getElementById('catalogoPrecioInput').value.trim();
  if (!nombre) return;
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

  const enCat = catalogo.find(function(c) { return c.nombre.toLowerCase() === nombre.toLowerCase(); });
  if (enCat) {
    enCat.vecesUsado = (enCat.vecesUsado || 0) + 1;
    guardarCatalogo();
  }
}

// ─────────────────────────────────────────────
// AUTOCOMPLETAR CLIENTES
// ─────────────────────────────────────────────

function obtenerClientesPrevios() {
  const map = new Map();
  notas.forEach(function(n) {
    if (n.cliente && n.cliente.nombre) {
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

    item.addEventListener('click', function() {
      seleccionarCliente(c);
    });

    container.appendChild(item);
  });

  const cerrar = document.createElement('button');
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

  document.getElementById('clienteNombre').value = c.nombre;
  document.getElementById('clienteTelefono').value = c.telefono || '';

  const dirInput = document.getElementById('clienteDireccion');
  if (dirInput) dirInput.value = c.direccion || '';

  const emailInput = document.getElementById('clienteEmail');
  if (emailInput) emailInput.value = c.email || '';

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

function mostrarVista(tipo) {
  // Limpia el buscador cada vez que abres una vista del historial
  const inputBusqueda = document.getElementById('busquedaHistorialInput');
  if (inputBusqueda && (tipo === 'historial' || tipo === 'pendientes' || tipo === 'iva')) {
    inputBusqueda.value = '';
  }

  if (tipo === 'historial') {
    renderizarHistorial('todas');
    document.getElementById('historialTitulo').textContent = 'Historial de Ventas';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'pendientes') {
    renderizarHistorial('pendientes');
    document.getElementById('historialTitulo').textContent = 'Notas por Cobrar';
    document.getElementById('vistaHistorial').style.display = 'flex';
  } else if (tipo === 'gastos') {
    actualizarPantallaGastos();
    document.getElementById('vistaGastos').style.display = 'flex';
  } else if (tipo === 'iva') {
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
    document.getElementById('configNombre').value = config.nombre;
    document.getElementById('configMensaje').value = config.mensaje;
    document.getElementById('configFolio').value = config.folioInicial;
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

function renderizarHistorial(filtro) {
  const lista = document.getElementById('historialLista');
  if (!lista) return;
  lista.innerHTML = '';

  // 1. Leer lo que se escribe en el buscador
  const inputBusqueda = document.getElementById('busquedaHistorialInput');
  const textoBusqueda = inputBusqueda ? inputBusqueda.value.trim().toLowerCase() : '';

  let notasFiltradas = notas.slice().sort(function(a, b) { return (b.numero || 0) - (a.numero || 0); });

  // 2. Filtrar por la pestaña seleccionada
  if (filtro === 'pendientes') {
    notasFiltradas = notasFiltradas.filter(function(n) { return !n.cobrada; });
  } else if (filtro === 'iva') {
    notasFiltradas = notasFiltradas.filter(function(n) { return n.ivaActivo; });
  }

  // 3. Filtrar por nombre de cliente o número de nota
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

  // 4. Renderizar tarjetas de notas
  notasFiltradas.forEach(function(nota) {
    const sub = nota.productos.reduce(function(s, p) {
      return s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0);
    }, 0);
    const tot = nota.ivaActivo ? sub * 1.16 : sub;
    const clienteNombreOriginal = (nota.cliente && nota.cliente.nombre) ? nota.cliente.nombre : 'Sin nombre';

    const card = document.createElement('div');
    card.className = 'nota-card';

    card.innerHTML =
      '<div class="nota-card-header">' +
        '<span class="nota-card-num">No. ' + String(nota.numero).padStart(4, '0') + '</span>' +
        '<span class="nota-card-fecha">' + formatDate(nota.cliente ? nota.cliente.fecha : new Date()) + '</span>' +
      '</div>' +
      '<div class="nota-card-cliente">' + escapeHtml(clienteNombreOriginal) + '</div>' +
      '<div class="nota-card-total">' + formatCurrency(tot) + '</div>' +
      '<div class="nota-card-badges">' +
        (nota.cobrada ? '<span class="badge-cobrada">COBRADA</span>' : '<span class="badge-pendiente">POR COBRAR</span>') +
        (nota.ivaActivo ? '<span class="badge-iva">IVA</span>' : '') +
      '</div>' +
      '<div class="nota-card-actions">' +
        '<button class="btn-card-action" data-action="abrir" data-id="' + nota.id + '">📝 Abrir</button>' +
        '<button class="btn-card-action" data-action="whatsapp" data-id="' + nota.id + '">💬 WhatsApp</button>' +
        '<button class="btn-card-action danger" data-action="eliminar" data-id="' + nota.id + '">🗑 Eliminar</button>' +
      '</div>';

    card.querySelector('[data-action="abrir"]').addEventListener('click', function() {
      const n = notas.find(function(x) { return x.id === nota.id; });
      if (n) {
        cargarNotaEnEditor(n);
        guardarNotaActual();
        document.getElementById('vistaHistorial').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    card.querySelector('[data-action="whatsapp"]').addEventListener('click', function() {
      const n = notas.find(function(x) { return x.id === nota.id; });
      if (!n) return;

      const textoHistorial = construirTextoWhatsapp(n);
      window.open('https://wa.me/?text=' + encodeURIComponent(textoHistorial), '_blank');
    });

    card.querySelector('[data-action="eliminar"]').addEventListener('click', function() {
      if (confirm('¿Eliminar la nota #' + String(nota.numero).padStart(4, '0') + '?')) {
        notas = notas.filter(function(n) { return n.id !== nota.id; });
        guardarNotas();
        renderizarHistorial(filtro);
        actualizarBadgePendientes();
      }
    });

    lista.appendChild(card);
  });
}

function renderizarClientes() {
  const lista = document.getElementById('clientesLista');
  lista.innerHTML = '';

  const map = new Map();
  notas.forEach(function(n) {
    if (!n.cliente || !n.cliente.nombre) return;
    const key = n.cliente.nombre.trim().toLowerCase();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { nombre: n.cliente.nombre.trim(), telefono: n.cliente.telefono, notas: [], totalVentas: 0 });
    }
    const entry = map.get(key);
    const sub = n.productos.reduce(function(s, p) {
      return s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioUnitario) || 0);
    }, 0);
    entry.notas.push(n);
    entry.totalVentas += n.ivaActivo ? sub * 1.16 : sub;
  });

  if (!map.size) {
    lista.innerHTML = '<div class="historial-empty">👥<br>Aún no hay clientes registrados.<br>Guarda algunas notas primero.</div>';
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

// ─────────────────────────────────────────────
// FINANZAS Y CONTROL DE BALANCE
// ─────────────────────────────────────────────

function calcTotalNota(n) {
  const sub = n.productos.reduce(function(s, p) {
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
  wrapper.style.padding = '12px';
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

    '<div class="card" style="overflow:hidden">' +
      '<div class="seccion-header" style="background:' + (utilidadNeta >= 0 ? '#27ae60' : '#e74c3c') + '">' +
        '<span class="seccion-icon">' + (utilidadNeta >= 0 ? '📈' : '📉') + '</span>' +
        '<span class="seccion-title">UTILIDAD NETA (COBRADO − GASTOS)</span>' +
      '</div>' +
      '<div style="padding:20px; text-align:center">' +
        '<div style="font-size:32px; font-weight:700; color:' + (utilidadNeta >= 0 ? '#27ae60' : '#e74c3c') + '">' + formatCurrency(utilidadNeta) + '</div>' +
        '<div style="font-size:12px; color:#aaa; margin-top:4px">' + formatCurrency(totalCobrado) + ' cobrado  −  ' + formatCurrency(totalGastosTotal) + ' gastos</div>' +
      '</div>' +
    '</div>' +

    '<div id="finanzasGastosCat"></div>';

  body.appendChild(wrapper);

  const catMap = new Map();
  gastos.forEach(function(g) {
    const cat = g.categoria || 'Otros';
    catMap.set(cat, (catMap.get(cat) || 0) + (parseFloat(g.monto) || 0));
  });

  if (catMap.size > 0) {
    const catContainer = body.querySelector('#finanzasGastosCat');
    let catHtml = '<div class="card" style="overflow:hidden">' +
      '<div class="seccion-header"><span class="seccion-icon">💸</span><span class="seccion-title">GASTOS POR CATEGORÍA</span></div>' +
      '<div style="padding:0">';

    const cats = Array.from(catMap.entries()).sort(function(a, b) { return b[1] - a[1]; });
    cats.forEach(function(entry, i) {
      const pct = totalGastosTotal > 0 ? Math.round((entry[1] / totalGastosTotal) * 100) : 0;
      catHtml +=
        '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;' + (i < cats.length - 1 ? 'border-bottom:1px solid #eee' : '') + '">' +
          '<span style="font-size:1.1rem">' + entry[0].split(' ')[0] + '</span>' +
          '<div style="flex:1">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
              '<span style="font-size:12px;font-weight:600;color:#333">' + escapeHtml(entry[0]) + '</span>' +
              '<span style="font-size:12px;font-weight:700;color:#e74c3c">' + formatCurrency(entry[1]) + '</span>' +
            '</div>' +
            '<div style="height:5px;background:#f0f0f0;border-radius:3px">' +
              '<div style="height:5px;background:#e67e22;border-radius:3px;width:' + pct + '%"></div>' +
            '</div>' +
          '</div>' +
          '<span style="font-size:11px;color:#aaa;width:30px;text-align:right">' + pct + '%</span>' +
        '</div>';
    });

    catHtml += '</div></div>';
    catContainer.innerHTML = catHtml;
  }
}

// ─────────────────────────────────────────────
// INICIALIZACIÓN DE COMPONENTES Y EVENTOS
// ─────────────────────────────────────────────

function inicializarEventos() {
  document.getElementById('btnMenu').addEventListener('click', abrirMenu);

  document.getElementById('overlayMenu').addEventListener('click', function(e) {
    if (e.target === this) cerrarMenu();
  });
  document.getElementById('overlayCatalogo').addEventListener('click', function(e) {
    if (e.target === this) cerrarCatalogo();
  });
  document.getElementById('overlayFecha').addEventListener('click', function(e) {
    if (e.target === this) cerrarSelectorFecha();
  });

  document.getElementById('btnCerrarCatalogo').addEventListener('click', cerrarCatalogo);

  document.getElementById('fechaBtn').addEventListener('click', abrirSelectorFecha);
  document.getElementById('btnFechaCancelar').addEventListener('click', cerrarSelectorFecha);
  document.getElementById('btnFechaConfirmar').addEventListener('click', confirmarFecha);
  document.getElementById('fechaMes').addEventListener('input', actualizarMesPreview);
  document.getElementById('fechaAnio').addEventListener('input', actualizarMesPreview);

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
    if (!notaActual.cliente) notaActual.cliente = {};
    notaActual.cliente.telefono = e.target.value.replace(/\D/g, '').slice(0, 10);
    e.target.value = notaActual.cliente.telefono;
    guardarNotaActual();
  });
  document.getElementById('clienteVendedor').addEventListener('input', function(e) {
    if (!notaActual.cliente) notaActual.cliente = {};
    notaActual.cliente.vendedor = e.target.value;
    guardarNotaActual();
  });
  document.getElementById('clienteDireccion').addEventListener('input', function(e) {
    if (!notaActual.cliente) notaActual.cliente = {};
    notaActual.cliente.direccion = e.target.value;
    guardarNotaActual();
  });
  document.getElementById('clienteEmail').addEventListener('input', function(e) {
    if (!notaActual.cliente) notaActual.cliente = {};
    notaActual.cliente.email = e.target.value;
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
    const idx = notas.findIndex(function(n) { return n.id === notaActual.id; });
    if (idx >= 0) { notas[idx].facturada = notaActual.facturada; guardarNotas(); }
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
    notaActual.anticipo = limpiarNumero(e.target.value);
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
  document.getElementById('btnWhatsapp').addEventListener('click', accionWhatsapp);

  document.getElementById('btnNuevaNota2').addEventListener('click', function() {
    crearNuevaNota();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Listener para la barra de búsqueda del Historial
  const inputBusquedaHistorial = document.getElementById('busquedaHistorialInput');
  if (inputBusquedaHistorial) {
    inputBusquedaHistorial.addEventListener('input', function() {
      const titulo = document.getElementById('historialTitulo') ? document.getElementById('historialTitulo').textContent : '';
      let tipoFiltro = 'todas';

      if (titulo.includes('Cobrar') || titulo.includes('Pendientes')) {
        tipoFiltro = 'pendientes';
      } else if (titulo.includes('I.V.A.') || titulo.includes('IVA')) {
        tipoFiltro = 'iva';
      }

      renderizarHistorial(tipoFiltro);
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      cerrarMenu();
      cerrarCatalogo();
      cerrarSelectorFecha();
    }
  });
}

function init() {
  cargarDatos();
  inicializarEventos();

  if (notaActual) {
    cargarNotaEnEditor(notaActual);
  } else {
    crearNuevaNota();
  }

  const gastoFechaInput = document.getElementById('gastoFecha');
  if (gastoFechaInput) {
    gastoFechaInput.value = new Date().toISOString().split('T')[0];
  }
}

document.addEventListener('DOMContentLoaded', init);

function confirmarReinicioTotal() {
  const confirmacion1 = confirm("¿Estás seguro de que quieres borrar TODO? Se perderán notas, clientes, catálogo y configuración.");
  if (confirmacion1) {
    const confirmacion2 = confirm("ESTA ACCIÓN NO SE PUEDE DESHACER. ¿Realmente quieres dejar la app como nueva?");
    if (confirmacion2) {
      localStorage.clear();
      alert("Aplicación restaurada con éxito. La página se recargará ahora.");
      window.location.reload();
    }
  }
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
  gastos = gastos.filter(function(g) { return g.id !== id; });
  guardarGastos();
  actualizarPantallaGastos();
  mostrarToast('Gasto eliminado');
}

function cambiarFiltroMesGastos(delta) {
  const partes = gastoFiltroMes.split('-');
  let anio = parseInt(partes[0]);
  let mes = parseInt(partes[1]) - 1;
  mes += delta;
  if (mes < 0) { mes = 11; anio--; }
  if (mes > 11) { mes = 0; anio++; }
  gastoFiltroMes = anio + '-' + String(mes + 1).padStart(2, '0');
  actualizarPantallaGastos();
}

function actualizarPantallaGastos() {
  const lista = document.getElementById('listaGastos');
  if (!lista) return;

  const hoy = new Date().toISOString().split('T')[0];
  const esteMesReal = hoy.substring(0, 7);

  const totalHoy = gastos
    .filter(function(g) { return g.fecha === hoy; })
    .reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);

  const totalMes = gastos
    .filter(function(g) { return g.fecha && g.fecha.startsWith(esteMesReal); })
    .reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);

  const gastoHoyEl = document.getElementById('gastoHoy');
  const gastoMesEl = document.getElementById('gastoMes');
  if (gastoHoyEl) gastoHoyEl.textContent = formatCurrency(totalHoy);
  if (gastoMesEl) gastoMesEl.textContent = formatCurrency(totalMes);

  const gastosFiltrados = gastos.filter(function(g) {
    return g.fecha && g.fecha.startsWith(gastoFiltroMes);
  });

  const totalFiltrado = gastosFiltrados.reduce(function(s, g) { return s + (parseFloat(g.monto) || 0); }, 0);
  const partes = gastoFiltroMes.split('-');
  const nombreMes = MESES[parseInt(partes[1]) - 1] + ' ' + partes[0];

  lista.innerHTML =
    '<div class="card" style="overflow:hidden; margin-bottom:10px">' +
      '<div class="seccion-header" style="background:#e67e22">' +
        '<button onclick="cambiarFiltroMesGastos(-1)" style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 6px">‹</button>' +
        '<span class="seccion-title" style="text-align:center">' + nombreMes.toUpperCase() + '</span>' +
        '<button onclick="cambiarFiltroMesGastos(1)" style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 6px">›</button>' +
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

    const fechaD = new Date(g.fecha + 'T12:00:00');
    const fechaTexto = fechaD.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

    item.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:40px;height:40px;border-radius:10px;background:#FFF3E0;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">' +
          (g.categoria ? g.categoria.split(' ')[0] : '💸') +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;font-weight:700;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(g.concepto) + '</div>' +
          '<div style="font-size:11px;color:#888;margin-top:2px">' + escapeHtml(g.categoria || '') + ' · ' + fechaTexto + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">' +
          '<span style="font-size:15px;font-weight:700;color:#e74c3c">−' + formatCurrency(parseFloat(g.monto) || 0) + '</span>' +
          '<button onclick="eliminarGasto(\'' + g.id + '\')" style="background:none;border:1px solid #e74c3c;color:#e74c3c;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:inherit">🗑 Borrar</button>' +
        '</div>' +
      '</div>';

    lista.appendChild(item);
  });
}
