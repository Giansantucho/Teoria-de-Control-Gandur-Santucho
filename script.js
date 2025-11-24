// script.js
// Simulador PI en browser con Chart.js
// - 5 gráficos: P, e, u, leak, f
// - parámetros editables: Kp, Ki, setpoint, ruido σ, Δ banda, dt, tiempo
// - Kplant and tau fixed: Kplant=40, tau=5 (fijos)
// - leak applied as event (button)
// - PI includes anti-windup by clamp (internal, hidden)
// - inputs are read inside the sim loop so changes take effect immediately

// -------------------------------
// helpers
// -------------------------------
function randn_bm(sd = 1.0) {
  // Box-Muller normal(0, sd)
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * sd;
}

function sat(x, a, b) {
  return Math.min(b, Math.max(a, x));
}

const el = id => document.getElementById(id);

// -------------------------------
// DOM references
// -------------------------------
const setpointInput = el('setpoint');
const KpInput = el('Kp');
const KiInput = el('Ki');
const sigmaInput = el('sigma');
const deltaInput = el('delta');
const tTotalInput = el('tTotal');
const dtInput = el('dt');
const leakValueInput = el('leakValue');
const applyLeakBtn = el('applyLeak');
const clearLeakBtn = el('clearLeak');
const P0Input = el('P0');
const startBtn = el('startBtn');
const stopBtn = el('stopBtn');
const resetBtn = el('resetBtn');
const KplantRead = el('Kplant');
const tauRead = el('tau');

const st_t = el('st_t');
const st_P = el('st_P');
const st_f = el('st_f');
const st_e = el('st_e');
const st_u = el('st_u');
const st_leak = el('st_leak');
const st_ref = el("st_ref");

// -------------------------------
// fixed model parameters
// -------------------------------
const Kplant = parseFloat(KplantRead.value); 
const tau = parseFloat(tauRead.value);       

// -------------------------------
// runtime state
// -------------------------------
let running = false;
let timer = null;
let t = 0;
let dt = parseFloat(dtInput.value);

let P = parseFloat(P0Input.value); // pressure state
let integral = 0;
let u = 0;

let currentLeak = 0; // active leak PSI/s (user event)
let leakTimer = 0;
let leakDuration = 0;
let sigma = parseFloat(sigmaInput.value);

// arrays for plotting
const maxPoints = 20000;

// -------------------------------
// prepare charts (Chart.js)
// -------------------------------
Chart.defaults.font.size = 12;

function createLineChart(ctx, label, yLabel, yMin = null, yMax = null, color = 'rgba(45,108,223,0.9)') {
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: label,
        data: [],
        borderColor: color,
        backgroundColor: color,
        tension: 0.15,
        pointRadius: 0
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      normalized: true,
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Tiempo (s)' } },
        y: {
          title: { display: true, text: yLabel },
          min: yMin,
          max: yMax
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

const chartP = createLineChart(document.getElementById('chartP'), 'Presión P(t)', 'PSI', 90, 140, 'rgba(45,108,223,1)');
chartP.data.datasets[0].borderColor = [];
chartP.data.datasets[0].backgroundColor = 'rgba(0,0,0,0)';
const chartE = createLineChart(document.getElementById('chartE'), 'Error e(t)', 'PSI', -20, 20, 'rgba(255,99,71,1)');
const chartU = createLineChart(document.getElementById('chartU'), 'u(t)', 'u', 0, 1.05, 'rgba(34,197,94,1)');
const chartLeak = createLineChart(document.getElementById('chartLeak'), 'leak(t)', 'PSI/s', 0, 20, 'rgba(200,100,0,1)');
const chartF = createLineChart(document.getElementById('chartF'), 'f(t)', 'PSI', 90, 140, 'rgba(123,97,255,1)');
const chartRef = createLineChart(document.getElementById('chartRef'),'Referencia (θᵢ)','PSI',90, 140,'rgba(0,0,0,0.8)');


// plugin: banda fija 115–120 PSI + colorear linea de presión
const bandPlugin = {
  id: 'bandPlugin',
  beforeDatasetsDraw(chart, args, opts) {
    if (chart !== chartP) return;

    const ctx = chart.ctx;
    const yScale = chart.scales.y;
    const xScale = chart.scales.x;

    const yTop = yScale.getPixelForValue(130);
    const yBottom = yScale.getPixelForValue(115);

    // DIBUJA LA BANDA 115–130 PSI
    ctx.save();
    ctx.fillStyle = 'rgba(100, 149, 237, 0.12)';
    ctx.fillRect(xScale.left, yTop, xScale.width, yBottom - yTop);
    ctx.restore();

    // COLOREA LA LINEA SEGÚN SI ESTÁ DENTRO DE LA BANDA
    const dataset = chart.data.datasets[0];

    dataset.borderColor = dataset.data.map(punto =>
     (punto.y >= 115 && punto.y <= 130)
    ? 'rgba(0,150,0,1)'  // dentro de banda
    : 'rgba(200,0,0,1)'  // fuera de banda
    );
  }
};

Chart.register(bandPlugin);



function pushPoint(chart, x, y) {
  const ds = chart.data.datasets[0];
  ds.data.push({ x: x, y: y });
  if (ds.data.length > maxPoints) ds.data.shift();
  chart.update('none');
}

// -------------------------------
// simulation step (reads inputs each step)
// -------------------------------
function simStep() {
  // read dynamic parameters from UI each step
  dt = parseFloat(dtInput.value);
  const setpoint = parseFloat(setpointInput.value);
  const Kp = parseFloat(KpInput.value);
  const Ki = parseFloat(KiInput.value);
  sigma = parseFloat(sigmaInput.value);

  // sensor reading f = P + noise
  const noise = randn_bm(sigma);
  const f = P + noise;

  // error using sensor reading
  const error = setpoint - f;

  // compute control using current integral (before or after integration depending clamp)
  let u_unsat = Kp * error + Ki * integral;
  let u_sat = sat(u_unsat, 0, 1);

  // anti-windup by clamp (internal): block integration when actuator saturated and error pushes into saturation
  const blockIntegrator = (u_sat === 1 && error > 0) || (u_sat === 0 && error < 0);

  // additionally limit integral growth per step (rate limit) to improve numerical stability
  const maxDeltaI = 0.5 * dt; // small limit proportional to dt
  if (!blockIntegrator) {
    const dI = error * dt;
    // clamp dI
    const dIclamped = Math.max(-maxDeltaI, Math.min(maxDeltaI, dI));
    integral += dIclamped;
  }

  // recompute control after possible integral update
  u_unsat = Kp * error + Ki * integral;
  u = sat(u_unsat, 0, 1);

  // process dynamics (Euler)
  // dP/dt = (-P + Kplant*u - currentLeak) / tau
  const dPdt = ( -P + Kplant * u - currentLeak ) / tau;
  P = P + dPdt * dt;

  t += dt;

  // update status numerics
  st_t.textContent = t.toFixed(2);
  st_P.textContent = P.toFixed(3);
  st_f.textContent = f.toFixed(3);
  st_e.textContent = error.toFixed(3);
  st_u.textContent = u.toFixed(3);
  st_leak.textContent = currentLeak.toFixed(3);
  st_ref.textContent = setpoint.toFixed(3);


  // push to charts
  pushPoint(chartP, t, P);
  pushPoint(chartE, t, error);
  pushPoint(chartU, t, u);
  pushPoint(chartLeak, t, currentLeak);
  pushPoint(chartF, t, f);
  pushPoint(chartRef, t, setpoint);

  // stop condition
  const Ttotal = parseFloat(tTotalInput.value);
  if (t >= Ttotal) {
    stopSim();
  }

  if (currentLeak > 0) {
  leakTimer += dt;
  if (leakTimer >= leakDuration) {
    currentLeak = 0;
    leakTimer = 0;
  }
}

}

// -------------------------------
// control loop handlers
// -------------------------------
function startSim() {
  if (running) return;
  // initialize values from inputs
  dt = parseFloat(dtInput.value);
  t = 0;
  P = parseFloat(P0Input.value);
  integral = 0;
  u = 0;
  currentLeak = 0;

  // clear charts
  [chartP, chartE, chartU, chartLeak, chartF, chartRef].forEach(c => {
    c.data.datasets[0].data = [];
    c.update('none');
  });

  // initialize status
  st_t.textContent = '0.00';
  st_P.textContent = P.toFixed(3);
  st_f.textContent = P.toFixed(3);
  st_e.textContent = '0.000';
  st_u.textContent = '0.000';
  st_leak.textContent = currentLeak.toFixed(3);
  st_ref.textContent = parseFloat(setpointInput.value).toFixed(3);

  // start interval
  running = true;
  const intervalMs = Math.max(5, Math.round(dt * 1000));
  timer = setInterval(simStep, intervalMs);
}

function stopSim() {
  if (!running) return;
  clearInterval(timer);
  running = false;
}

function resetSim() {
  stopSim();
  t = 0;
  P = parseFloat(P0Input.value);
  integral = 0;
  u = 0;
  currentLeak = 0;
  [chartP, chartE, chartU, chartLeak, chartF, chartRef].forEach(c => {
    c.data.datasets[0].data = [];
    c.update('none');
  });
  st_t.textContent = '0.00';
  st_P.textContent = P.toFixed(3);
  st_f.textContent = P.toFixed(3);
  st_e.textContent = '0.000';
  st_u.textContent = '0.000';
  st_leak.textContent = currentLeak.toFixed(3);
  st_ref.textContent = parseFloat(setpointInput.value).toFixed(3);

}

// -------------------------------
// events
// -------------------------------
startBtn.addEventListener('click', () => {
  if (!running) startSim();
});
stopBtn.addEventListener('click', () => {
  stopSim();
});
resetBtn.addEventListener('click', () => {
  resetSim();
});
applyLeakBtn.addEventListener('click', () => {
  const v = parseFloat(leakValueInput.value);
  const d = parseFloat(document.getElementById('leakDuration').value);

  if (isNaN(v) || v < 0) return;

  currentLeak = v;
  leakDuration = d;
  leakTimer = 0;
});
clearLeakBtn.addEventListener('click', () => {
  currentLeak = 0;
  st_leak.textContent = currentLeak.toFixed(3);
});

// initialize
resetSim();
