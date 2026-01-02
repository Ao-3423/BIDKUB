// ===== Build Share Detail (SAFE - ไม่กระทบของเดิม) =====
function buildShareDetails(t) {
  const nameOf = (id) =>
    state.people.find((p) => p.id === id)?.name || "-";

  const shares = {};

  // ----- custom -----
  if (t.splitMode === "custom") {
    let used = 0;
    const fixed = {};
    const auto = [];

    t.participants.forEach((id) => {
      if (t.shares?.[id] != null && t.shares[id] !== "") {
        fixed[id] = round2(+t.shares[id]);
        used += fixed[id];
      } else {
        auto.push(id);
      }
    });

    const remain = round2(t.amount - used);
    const base =
      auto.length > 0
        ? Math.floor((remain / auto.length) * 100) / 100
        : 0;

    let acc = 0;
    auto.forEach((id, idx) => {
      shares[id] =
        idx === auto.length - 1 ? round2(remain - acc) : base;
      acc += shares[id];
    });

    Object.entries(fixed).forEach(([id, v]) => (shares[id] = v));

    return (
      "กำหนดเอง: " +
      Object.entries(shares)
        .map(([id, amt]) => `${nameOf(id)} ${amt.toLocaleString()}`)
        .join(", ")
    );
  }

  // ----- equal -----
  if (t.splitMode === "equal") {
    const base =
      Math.floor((t.amount / state.people.length) * 100) / 100;
    let acc = 0;

    state.people.forEach((p, idx) => {
      shares[p.id] =
        idx === state.people.length - 1
          ? round2(t.amount - acc)
          : base;
      acc += shares[p.id];
    });

    return (
      "ทุกคนหาร: " +
      Object.entries(shares)
        .map(([id, amt]) => `${nameOf(id)} ${amt.toLocaleString()}`)
        .join(", ")
    );
  }

  // ----- participants -----
  if (t.splitMode === "participants") {
    const base =
      Math.floor((t.amount / t.participants.length) * 100) / 100;
    let acc = 0;

    t.participants.forEach((id, idx) => {
      shares[id] =
        idx === t.participants.length - 1
          ? round2(t.amount - acc)
          : base;
      acc += shares[id];
    });

    return (
      "เฉพาะคนที่เลือก: " +
      Object.entries(shares)
        .map(([id, amt]) => `${nameOf(id)} ${amt.toLocaleString()}`)
        .join(", ")
    );
  }

  return "-";
}
