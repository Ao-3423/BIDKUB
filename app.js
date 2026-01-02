// ================= DOM =================
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
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const clearBtn = document.getElementById("clearBtn");
const participantsBox = document.getElementById("participantsBox");
const customSharesBox = document.getElementById("customSharesBox");

splitMode.addEventListener("change", () => {
  participantsBox.style.display =
    splitMode.value === "participants" ? "block" : "none";
  customSharesBox.style.display =
    splitMode.value === "custom" ? "block" : "none";
});

// ================= Utils =================
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const uid = () => Math.random().toString(36).slice(2, 10);

// ================= State =================
let state = normalizeState(
  JSON.parse(localStorage.getItem("bidkub_state") || '{"people":[],"txns":[]}')
);
let editTxnId = null;
const save = () =>
  localStorage.setItem("bidkub_state", JSON.stringify(state));

// ================= Normalize =================
function normalizeState(state) {
  state.people = state.people || [];
  state.txns = state.txns || [];

  state.txns.forEach((t) => {
    if (!t.splitMode) t.splitMode = "equal";
    if (!t.participants) t.participants = [];
    if (!t.shares) t.shares = {};

    if (t.splitMode === "equal") {
      t.participants = state.people.map((p) => p.id);
      t.shares = {};
    }

    if (t.splitMode === "participants") {
      t.participants = t.participants || [];
      t.shares = {};
    }

    if (t.splitMode === "custom") {
      Object.keys(t.shares).forEach((id) => {
        if (!t.participants.includes(id)) delete t.shares[id];
      });
    }
  });

  return state;
}

// ================= Render People =================
function renderPeople() {
  txnPayer.innerHTML = `<option value="">ผู้จ่าย</option>`;
  state.people.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    txnPayer.appendChild(opt);
  });
  renderSplitControls();
}

// ================= Split Controls =================
function renderSplitControls() {
  participantsCheckboxes.innerHTML = "";
  customShares.innerHTML = "";

  state.people.forEach((p) => {
    const chip = document.createElement("label");
    chip.innerHTML = `<input type="checkbox" data-id="${p.id}" checked> ${p.name}`;
    participantsCheckboxes.appendChild(chip);

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div style="flex:1">${p.name}</div>
      <input class="custom-share-input" data-id="${p.id}" placeholder="กำหนด (เว้นว่าง = อัตโนมัติ)">
    `;
    customShares.appendChild(row);
  });
}

// ================= Render Transactions =================
function renderTxns() {
  txnList.innerHTML = "";

  state.txns.forEach((t) => {
    const payer = state.people.find((p) => p.id === t.payerId);
    const detail = buildShareDetails(t);

    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${t.desc}</strong>
        <div class="smalltext">
          ${t.amount.toLocaleString()} THB • ผู้จ่าย: ${payer?.name || "-"}
        </div>
        <div class="muted small">${detail}</div>
      </div>
      <div>
        <button class="edit" data-id="${t.id}">แก้ไข</button>
        <button class="del" data-id="${t.id}">ลบ</button>
      </div>
    `;
    txnList.appendChild(li);
  });

  document.querySelectorAll(".del").forEach((b) => {
    b.onclick = () => {
      state.txns = state.txns.filter((x) => x.id !== b.dataset.id);
      save();
      rerenderAll();
    };
  });

  document.querySelectorAll(".edit").forEach((b) => {
    b.onclick = () => loadEditTxn(b.dataset.id);
  });
}

// ================= Load Edit =================
function loadEditTxn(id) {
  const t = state.txns.find((x) => x.id === id);
  if (!t) return;

  editTxnId = id;
  txnDesc.value = t.desc;
  txnAmount.value = t.amount;
  txnPayer.value = t.payerId;
  splitMode.value = t.splitMode;
  splitMode.dispatchEvent(new Event("change"));

  document
    .querySelectorAll("#participantsCheckboxes input")
    .forEach((c) => {
      c.checked =
        t.splitMode === "equal" || t.participants.includes(c.dataset.id);
    });

  if (t.splitMode === "custom") {
    document.querySelectorAll(".custom-share-input").forEach((i) => {
      i.value = t.shares[i.dataset.id] ?? "";
    });
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ================= Calculate =================
function calculateBalances() {
  const bal = {};
  state.people.forEach((p) => (bal[p.id] = 0));

  state.txns.forEach((t) => {
    const shares = {};
    t.participants = t.participants || [];
    t.shares = t.shares || {};

    if (t.splitMode === "equal") {
      const base = Math.floor((t.amount / state.people.length) * 100) / 100;
      let acc = 0;
      state.people.forEach((p, i) => {
        shares[p.id] =
          i === state.people.length - 1 ? round2(t.amount - acc) : base;
        acc += shares[p.id];
      });
    }

    if (t.splitMode === "participants") {
      const base = Math.floor((t.amount / t.participants.length) * 100) / 100;
      let acc = 0;
      t.participants.forEach((id, i) => {
        shares[id] =
          i === t.participants.length - 1 ? round2(t.amount - acc) : base;
        acc += shares[id];
      });
    }

    if (t.splitMode === "custom") {
      let used = 0;
      const auto = [];

      t.participants.forEach((id) => {
        if (t.shares[id] !== "" && t.shares[id] != null) {
          shares[id] = round2(+t.shares[id]);
          used += shares[id];
        } else auto.push(id);
      });

      const remain = round2(t.amount - used);
      const base =
        auto.length > 0 ? Math.floor((remain / auto.length) * 100) / 100 : 0;
      let acc = 0;

      auto.forEach((id, i) => {
        shares[id] =
          i === auto.length - 1 ? round2(remain - acc) : base;
        acc += shares[id];
      });
    }

    Object.entries(shares).forEach(
      ([id, amt]) => (bal[id] = round2(bal[id] - amt))
    );
    bal[t.payerId] = round2(bal[t.payerId] + t.amount);
  });

  return bal;
}

// ================= Summary =================
function renderSummary() {
  summaryBalances.innerHTML = "";
  const bal = calculateBalances();
  Object.entries(bal).forEach(([id, v]) => {
    const p = state.people.find((x) => x.id === id);
    const div = document.createElement("div");
    div.textContent = `${p.name}: ${v.toLocaleString()} THB`;
    summaryBalances.appendChild(div);
  });
}

// ================= Settlement =================
function renderSettlements() {
  settlementList.innerHTML = "";
  const bal = calculateBalances();
  const debt = [],
    credit = [];

  Object.entries(bal).forEach(([id, v]) => {
    if (v < 0) debt.push({ id, amt: -v });
    if (v > 0) credit.push({ id, amt: v });
  });

  let i = 0,
    j = 0;
  while (i < debt.length && j < credit.length) {
    const pay = round2(Math.min(debt[i].amt, credit[j].amt));
    const li = document.createElement("li");
    li.textContent = `${state.people.find((p) => p.id === debt[i].id).name} → ${
      state.people.find((p) => p.id === credit[j].id).name
    }: ${pay.toLocaleString()} THB`;
    settlementList.appendChild(li);

    debt[i].amt -= pay;
    credit[j].amt -= pay;
    if (debt[i].amt <= 0) i++;
    if (credit[j].amt <= 0) j++;
  }
}

// ================= Share Detail =================
function buildShareDetails(t) {
  const nameOf = (id) => state.people.find((p) => p.id === id)?.name || "-";
  t.participants = t.participants || [];
  t.shares = t.shares || {};
  const shares = {};

  if (t.splitMode === "equal") {
    const base = Math.floor((t.amount / state.people.length) * 100) / 100;
    let acc = 0;
    state.people.forEach((p, i) => {
      shares[p.id] =
        i === state.people.length - 1 ? round2(t.amount - acc) : base;
      acc += shares[p.id];
    });
    return (
      "ทุกคนหาร: " +
      Object.entries(shares)
        .map(([id, v]) => `${nameOf(id)} ${v}`)
        .join(", ")
    );
  }

  if (t.splitMode === "participants") {
    const base = Math.floor((t.amount / t.participants.length) * 100) / 100;
    let acc = 0;
    t.participants.forEach((id, i) => {
      shares[id] =
        i === t.participants.length - 1 ? round2(t.amount - acc) : base;
      acc += shares[id];
    });
    return (
      "เฉพาะคนที่เลือก: " +
      Object.entries(shares)
        .map(([id, v]) => `${nameOf(id)} ${v}`)
        .join(", ")
    );
  }

  if (t.splitMode === "custom") {
    let used = 0;
    const auto = [];

    t.participants.forEach((id) => {
      if (t.shares[id] !== "" && t.shares[id] != null) {
        shares[id] = round2(+t.shares[id]);
        used += shares[id];
      } else auto.push(id);
    });

    const remain = round2(t.amount - used);
    const base =
      auto.length > 0 ? Math.floor((remain / auto.length) * 100) / 100 : 0;
    let acc = 0;

    auto.forEach((id, i) => {
      shares[id] =
        i === auto.length - 1 ? round2(remain - acc) : base;
      acc += shares[id];
    });

    return (
      "กำหนดเอง: " +
      Object.entries(shares)
        .map(([id, v]) => `${nameOf(id)} ${v}`)
        .join(", ")
    );
  }

  return "-";
}

// ================= Init =================
function rerenderAll() {
  renderPeople();
  renderTxns();
  renderSummary();
  renderSettlements();
}

rerenderAll();
