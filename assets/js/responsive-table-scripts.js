(() => {
  const TABLE_SELECTOR = ".table-responsive table";

  const cleanLabel = (value, fallback) => {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[:*]+$/g, "")
      .trim();
    return text || fallback;
  };

  const applyCellLabels = (table) => {
    if (!table || !table.tHead || !table.tBodies.length) return;

    const headers = Array.from(table.tHead.querySelectorAll("th")).map((th, index) =>
      cleanLabel(th.textContent, `Column ${index + 1}`)
    );

    if (!headers.length) return;

    table.classList.add("stack-table");
    const tableWrap = table.closest(".table-responsive");
    if (tableWrap) tableWrap.classList.add("stack-table-wrap");

    const bodyRows = table.tBodies[0].querySelectorAll("tr");
    bodyRows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (!cells.length) return;

      if (cells.length === 1 && cells[0].colSpan > 1) {
        cells[0].removeAttribute("data-label");
        return;
      }

      cells.forEach((cell, index) => {
        cell.setAttribute("data-label", headers[index] || `Column ${index + 1}`);
      });
    });
  };

  const observeTableBody = (table) => {
    if (!table || !table.tBodies.length) return;

    const tbody = table.tBodies[0];
    const observer = new MutationObserver(() => applyCellLabels(table));
    observer.observe(tbody, { childList: true, subtree: true });
  };

  const initResponsiveTables = () => {
    document.querySelectorAll(TABLE_SELECTOR).forEach((table) => {
      applyCellLabels(table);
      observeTableBody(table);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initResponsiveTables);
  } else {
    initResponsiveTables();
  }
})();
