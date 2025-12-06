// =======================
// app.js — BIDKUB (Full, Clean)
// =======================

// DOM elements
const txnList = document.getElementById("txnList");
const participantsCheckboxes = document.getElementById("participantsCheckboxes");
const customShares = document.getElementById("customShares");
const addPersonBtn = document.getElementById("addPersonBtn");
const personName = document.getElementById("personName");
const addTxnBtn = document.getElementById("addTxnBtn");
const txnDesc = document.getElementById("txnDesc");
const txnAmount = document.getElementById("txnAmount");
const txnPayer = document.getElementById("txnPayer");
const splitMode = document.getElementById("splitMode");
const summaryBalances = document.getElementById("summaryBalances");
const settlementList = document.getElementById("settlementList");
const calcBtn = document.getElementById("calcBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const clearBtn = document.getElementById("clearBtn");

// Load state
let state = JSON.parse(localStorage.getItem("bidkub_state") || '{"people":[],"txns":[]}');

// UID generator
function uid() {
  return Math.random().toString(36).substr(2, 9);
}

// Save state
function save() {
  localStorage.setItem("bidkub_state", JSON.stringify(state));
}

// Render People to dropdown and split UI
function renderPeople() {
  txnPayer.innerHTML = "";
  state.people.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    txnPayer.appendChild(opt);
  });
  renderSplitControls();
}

// Render Transactions List
function renderTxns() {
  txnList.innerHTML = "";
  state.txns.forEach((t) => {
    const li = document.createElement("li");
    li.className = "txn-item";
    const payer = state.people.find((p) => p.id === t.payerId);
    li.innerHTML = `
      <div>
        <strong>${t.desc}</strong>
        <div class='smalltext'>
          ${t.amount.toFixed(2)} THB • Payer: ${payer ? payer.name : "-"}
        </div>
      </div>
      <div><button data-id='${t.id}' class='del'>ลบ</button></div>
    `;
    txnList.appendChild(li);
  });

  // Delete button
  document.querySelectorAll(".txn-item .del").forEach((btn) => {
    btn.onclick = (e) => {
      const id = e.target.dataset.id;
      state.txns = state.txns.filter((x) => x.id !== id);
      save();
      rerenderAll();
    };
  });
}

// Render participant checkboxes and custom inputs
function renderSplitControls() {
  participantsCheckboxes.innerHTML = "";
  customShares.innerHTML = "";
  state.people.forEach((p) => {
    const id = p.id;
    // Checkbox chips
    const chip = document.createElement("label");
    chip.className = "participant-chip";
    chip.innerHTML = `<input type='checkbox' data-id='${id}' checked /> ${p.name}`;
    participantsCheckboxes.appendChild(chip);
    // Custom share input
    const cs = document.createElement("div");
    cs.className = "row";
    cs.innerHTML = `
      <div style='flex:1'>${p.name}</div>
      <input class='custom-share-input' data-id='${id}' placeholder='share (eg 1)' />
    `;
    customShares.appendChild(cs);
  });
}

// Calculate balances
function calculateBalances() {
  const bal = {};
  state.people.forEach((p) => (bal[p.id] = 0));
  state.txns.forEach((t) => {
    const payer = t.payerId;
    const amount = t.amount;
    let shareMap = {};
    if (t.splitMode === "equal") {
      const ids = state.people.map((p) => p.id);
      const cut = amount / ids.length;
      ids.forEach((id) => (shareMap[id] = cut));
    } else if (t.splitMode === "participants") {
      const cut = amount / t.participants.length;
      t.participants.forEach((id) => (shareMap[id] = cut));
    } else if (t.splitMode === "custom") {
      const totalShares = Object.values(t.shares).reduce((a, b) => a + b, 0);
      Object.entries(t.shares).forEach(([id, s]) => {
        shareMap[id] = amount * (s / totalShares);
      });
    }
    Object.entries(shareMap).forEach(([uid, owe]) => {
      bal[uid] -= owe;
    });
    bal[payer] += amount;
  });
  return bal;
}

// Render summary balances
function renderSummary() {
  const bal = calculateBalances();
  summaryBalances.innerHTML = "";
  Object.entries(bal).forEach(([id, v]) => {
    const p = state.people.find((x) => x.id === id);
    const div = document.createElement("div");
    div.textContent = `${p.name}: ${v.toFixed(2)} THB`;
    summaryBalances.appendChild(div);
  });
}

// Settlement algorithm
function generateSettlements() {
  const bal = calculateBalances();
  let debtors = [], creditors = [];
  Object.entries(bal).forEach(([id, v]) => {
    if (v < -0.01) debtors.push({ id, amt: -v });
    if (v > 0.01) creditors.push({ id, amt: v });
  });
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const results = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    results.push({ from: d.id, to: c.id, amount: pay });
    d.amt -= pay;
    c.amt -= pay;
    if (d.amt <= 0.01) i++;
    if (c.amt <= 0.01) j++;
  }
  return results;
}

// Render settlement list
function renderSettlements() {
  const result = generateSettlements();
  settlementList.innerHTML = "";
  result.forEach((r) => {
    const from = state.people.find((p) => p.id === r.from).name;
    const to = state.people.find((p) => p.id === r.to).name;
    const li = document.createElement("li");
    li.textContent = `${from} → ${to}: ${r.amount.toFixed(2)} THB`;
    settlementList.appendChild(li);
  });
}

// Add person
addPersonBtn.onclick = () => {
  const name = personName.value.trim();
  if (!name) return Swal.fire({ icon:"warning", title:"กรุณากรอกชื่อ", confirmButtonText:"ตกลง" });
  state.people.push({ id: uid(), name });
  personName.value = "";
  save();
  rerenderAll();
};

// Add transaction
addTxnBtn.onclick = () => {
  const desc = txnDesc.value.trim() || "Expense";
  const amount = parseFloat(txnAmount.value);
  if (!amount || amount <= 0) return Swal.fire({ icon:"error", title:"ราคาต้องมากกว่า 0", confirmButtonText:"ตกลง" });
  const payerId = txnPayer.value;
  if (!payerId) return Swal.fire({ icon:"warning", title:"กรุณาเลือกผู้จ่าย", confirmButtonText:"ตกลง" });

  const mode = splitMode.value;
  let participants = [];
  document.querySelectorAll('#participantsCheckboxes input[type="checkbox"]').forEach((ch) => {
    if (ch.checked) participants.push(ch.dataset.id);
  });
  let shares = null;
  if (mode === "custom") {
    shares = {};
    document.querySelectorAll("#customShares input.custom-share-input").forEach((inp) => {
      const val = parseFloat(inp.value);
      if (!isNaN(val) && val > 0) shares[inp.dataset.id] = val;
    });
    if (Object.keys(shares).length === 0) return Swal.fire({ icon:"info", title:"ต้องใส่สัดส่วนอย่างน้อย 1 คน", confirmButtonText:"ตกลง" });
    participants = Object.keys(shares);
  }
  if (mode === "participants" && participants.length === 0) return Swal.fire({ icon:"warning", title:"เลือกคนที่หารก่อน", confirmButtonText:"ตกลง" });
  if (participants.length === 0) participants = state.people.map((p) => p.id);

  state.txns.push({ id: uid(), desc, amount, payerId, splitMode: mode, participants, shares });
  txnDesc.value = ""; txnAmount.value = "";
  save();
  rerenderAll();
};

// Export JSON
exportBtn.onclick = () => {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bidkub-data.json";
  a.click();
  URL.revokeObjectURL(url);
  Swal.fire({ icon:"success", title:"ส่งออกข้อมูลเรียบร้อย!", confirmButtonText:"ตกลง" });
};

// Import JSON
importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const json = JSON.parse(ev.target.result);
      if (!json.people || !json.txns) return Swal.fire({ icon:"error", title:"ไฟล์ไม่ถูกต้อง", confirmButtonText:"ตกลง" });
      state = json; save(); rerenderAll();
      Swal.fire({ icon:"success", title:"นำเข้าข้อมูลสำเร็จ!", confirmButtonText:"ตกลง" });
    } catch (err) {
      Swal.fire({ icon:"error", title:"ไม่สามารถอ่านไฟล์ JSON ได้", confirmButtonText:"ตกลง" });
    }
  };
  reader.readAsText(file);
};

// Clear all
clearBtn.onclick = () => {
  Swal.fire({
    title: "ลบข้อมูลทั้งหมด?",
    text: "ข้อมูลทั้งหมดจะหายไปถาวร",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบเลย",
    cancelButtonText: "ยกเลิก"
  }).then((result) => {
    if (result.isConfirmed) {
      state = { people: [], txns: [] };
      save(); rerenderAll();
      Swal.fire({ icon:"success", title:"ลบข้อมูลแล้ว!" });
    }
  });
};

// Calculate (คำนวณยอด + สร้างรายการชำระหนี้อัตโนมัติ)
calcBtn.onclick = () => {
  renderSummary();
  renderSettlements();
  Swal.fire("คำนวณเสร็จแล้ว!", "", "success");
};

// Rerender everything
function rerenderAll() {
  renderPeople();
  renderTxns();
  renderSummary();
  renderSettlements();
}

// Initial
rerenderAll();
