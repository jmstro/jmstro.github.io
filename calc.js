/* SetAside Sheets – quarterly estimated tax calculator engine. Estimates only, not tax advice. */
var KEEPER_URL = "https://keepertax.go2cloud.org/aff_c?offer_id=25&aff_id=2174";
var YEARS = {
  2026: { br: [[0.10,0,0,0,0],[0.12,12400,24800,12400,17700],[0.22,50400,100800,50400,67450],[0.24,105700,211400,105700,105700],[0.32,201775,403550,201775,201750],[0.35,256225,512450,256225,256200],[0.37,640600,768700,384350,640600]],
          std: [16100,32200,16100,24150], wb: 184500, m1: 0.725, m2: 0.76,
          due: ["April 15, 2026","June 15, 2026","September 15, 2026","January 15, 2027"],
          mileNote: "72.5¢/mile Jan–Jun and 76¢/mile from July 1, 2026 (IRS)." },
  2027: { br: [[0.10,0,0,0,0],[0.12,12800,25600,12800,18250],[0.22,52025,104050,52025,69650],[0.24,109125,218250,109125,109100],[0.32,208325,416650,208325,208300],[0.35,264550,529100,264550,264550],[0.37,661375,793650,396825,661350]],
          std: [16600,33200,16600,24925], wb: 192300, m1: 0.76, m2: 0.76,
          due: ["April 15, 2027","June 15, 2027","September 15, 2027","January 18, 2028"],
          mileNote: "Uses 76¢/mile (the latest 2026 rate) until the IRS announces the 2027 rate." }
};
var STATUS = { single: 0, mfj: 1, mfs: 2, hoh: 3 };

function incomeTax(taxable, y, s) {
  var b = YEARS[y].br, t = 0;
  for (var i = 0; i < b.length; i++) {
    var lo = b[i][1 + s], hi = i + 1 < b.length ? b[i + 1][1 + s] : Infinity;
    if (taxable > lo) t += (Math.min(taxable, hi) - lo) * b[i][0];
  }
  return t;
}

/* p: {year, status, profit, w2, withheld, paid, lastYearTax, highIncome, stateRate} */
function estimate(p) {
  var Y = YEARS[p.year], s = STATUS[p.status] || 0;
  var profit = p.profit, w2 = Math.max(0, p.w2 || 0);
  var ne = Math.max(0, profit) * 0.9235, ss = 0, med = 0;
  if (ne >= 400) { ss = 0.124 * Math.min(ne, Math.max(0, Y.wb - w2)); med = 0.029 * ne; }
  var se = ss + med, halfSe = se / 2;
  var agi = Math.max(0, w2 + profit - halfSe);
  var beforeQbi = Math.max(0, agi - Y.std[s]);
  var qbi = 0.2 * Math.min(Math.max(0, profit - halfSe), beforeQbi);
  var taxable = Math.max(0, beforeQbi - qbi);
  var taxAll = incomeTax(taxable, p.year, s);
  var taxW2 = incomeTax(Math.max(0, w2 - Y.std[s]), p.year, s);
  var fedShare = Math.max(0, taxAll - taxW2);
  var state = Math.max(0, profit) * (p.stateRate || 0);
  var total = se + fedShare + state;
  var thisYearTotal = se + taxAll;
  var sh90 = 0.9 * thisYearTotal;
  var shLast = p.lastYearTax > 0 ? p.lastYearTax * (p.highIncome ? 1.1 : 1) : null;
  var required = shLast === null ? sh90 : Math.min(sh90, shLast);
  var stillMin = Math.max(0, required - (p.withheld || 0) - (p.paid || 0));
  var stillFull = Math.max(0, se + taxAll - (p.withheld || 0) - (p.paid || 0));
  return { se: se, fedShare: fedShare, state: state, total: total, rate: profit > 0 ? total / profit : 0,
           quarter: (se + fedShare) / 4, required: required, stillMin: stillMin, stillFull: stillFull,
           taxable: taxable, qbi: qbi, due: Y.due };
}

/* ---------- page wiring ---------- */
function $(id) { return document.getElementById(id); }
function num(id) { var e = $(id); if (!e) return 0; var v = parseFloat(String(e.value).replace(/[$,\s]/g, "")); return isNaN(v) ? 0 : v; }
function usd(x) { return "$" + Math.round(x).toLocaleString("en-US"); }

function run() {
  var y = parseInt($("year").value, 10), Y = YEARS[y];
  var cfg = window.PAGE || { income: [], expense: [], miles: false };
  var inc = 0, exp = 0, i;
  for (i = 0; i < cfg.income.length; i++) inc += num(cfg.income[i]);
  for (i = 0; i < cfg.expense.length; i++) exp += num(cfg.expense[i]) * (cfg.half && cfg.half.indexOf(cfg.expense[i]) >= 0 ? 0.5 : 1);
  var milesDed = 0;
  if (cfg.miles) milesDed = num("miles1") * Y.m1 + num("miles2") * Y.m2;
  var profit = inc - exp - milesDed;
  var r = estimate({ year: y, status: $("status").value, profit: profit, w2: num("w2"), withheld: num("withheld"),
    paid: num("paid"), lastYearTax: num("lastyear"), highIncome: $("high") && $("high").checked, stateRate: num("staterate") / 100 });
  $("r-profit").textContent = usd(profit);
  if ($("r-miles")) $("r-miles").textContent = usd(milesDed);
  $("r-se").textContent = usd(r.se);
  $("r-fed").textContent = usd(r.fedShare);
  $("r-state").textContent = usd(r.state);
  $("r-total").textContent = usd(r.total);
  $("r-rate").textContent = Math.round(r.rate * 100) + "%";
  $("r-quarter").textContent = usd(r.quarter);
  $("r-min").textContent = usd(r.stillMin);
  $("r-full").textContent = usd(r.stillFull);
  $("r-due").textContent = r.due.join(" · ");
  $("r-q4").textContent = r.due[3];
  var mn = $("mile-note"); if (mn) mn.textContent = Y.mileNote;
  var h1 = $("miles1-label"), h2 = $("miles2-label");
  if (h1 && h2) { if (y === 2026) { h1.textContent = "Business miles, Jan–Jun"; h2.parentNode.style.display = ""; } else { h1.textContent = "Business miles for the year"; h2.parentNode.style.display = "none"; $("miles2").value = ""; } }
  $("results").hidden = false;
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  var form = $("calc");
  form.addEventListener("input", run);
  form.addEventListener("submit", function (e) { e.preventDefault(); run(); $("results").scrollIntoView({ behavior: "smooth" }); });
  var k = document.querySelectorAll(".keeper");
  for (var i = 0; i < k.length; i++) { if (KEEPER_URL) { var pg = (location.pathname.split("/").pop() || "index").replace(".html", ""); k[i].querySelector("a").href = KEEPER_URL + "&aff_sub=" + encodeURIComponent(pg); } else { k[i].style.display = "none"; } }
  run();
});
if (typeof module !== "undefined") module.exports = { estimate: estimate, incomeTax: incomeTax };
