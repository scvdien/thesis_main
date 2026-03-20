(() => {
  const STORAGE = {
    inventory: "mss_inventory_records_v1",
    movements: "mss_inventory_movements_v1",
    requests: "mss_cho_requests_v1"
  };

  const text = (value) => String(value ?? "").trim();
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const readList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const writeList = (key, items) => {
    localStorage.setItem(key, JSON.stringify(Array.isArray(items) ? items : []));
  };

  const todayInputValue = () => {
    const current = new Date();
    const offset = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - offset).toISOString().slice(0, 10);
  };

  const addDays = (dateValue, days) => {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return todayInputValue();
    parsed.setDate(parsed.getDate() + days);
    return parsed.toISOString().slice(0, 10);
  };

  const normalizeInputDate = (value, fallback = todayInputValue()) => {
    const parsed = new Date(text(value) || fallback);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toISOString().slice(0, 10);
  };

  const toDateKey = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    parsed.setHours(0, 0, 0, 0);
    return parsed.toISOString().slice(0, 10);
  };

  const toDateTimestamp = (value) => {
    const dateKey = normalizeInputDate(value);
    return new Date(`${dateKey}T00:00:00`).getTime();
  };

  const diffDays = (startValue, endValue) => {
    const start = toDateTimestamp(startValue);
    const end = toDateTimestamp(endValue);
    return Math.max(0, Math.round((end - start) / 86400000));
  };

  const average = (values) => {
    const safeValues = values.map(numeric).filter((value) => Number.isFinite(value));
    if (!safeValues.length) return 0;
    return safeValues.reduce((total, value) => total + value, 0) / safeValues.length;
  };

  const requestCodeNumber = (value) => {
    const match = text(value).match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  };

  const normalizeRequest = (entry = {}) => {
    const requestDate = normalizeInputDate(entry.requestDate || entry.createdAt || todayInputValue());
    const expectedDate = normalizeInputDate(entry.expectedDate || addDays(requestDate, 5), addDays(requestDate, 5));
    const requestCode = text(entry.requestCode);
    const requestGroupId = text(entry.requestGroupId || entry.groupId || requestCode || entry.id) || uid();

    return {
      id: text(entry.id) || uid(),
      requestGroupId,
      requestCode,
      medicineId: text(entry.medicineId),
      medicineName: text(entry.medicineName),
      genericName: text(entry.genericName),
      strength: text(entry.strength),
      unit: text(entry.unit) || "units",
      quantityRequested: Math.max(1, Math.round(numeric(entry.quantityRequested) || 1)),
      requestDate,
      expectedDate,
      source: text(entry.source) || "City Health Office (CHO)",
      requestedBy: text(entry.requestedBy) || "Nurse-in-Charge",
      notes: text(entry.notes),
      createdAt: text(entry.createdAt) || `${requestDate}T08:00:00`,
      updatedAt: text(entry.updatedAt) || nowIso()
    };
  };

  const nextRequestCode = (requests = readList(STORAGE.requests).map(normalizeRequest)) => {
    const year = new Date().getFullYear();
    const maxCode = requests
      .filter((request) => text(request.requestCode).startsWith(`CHO-${year}-`))
      .reduce((highest, request) => Math.max(highest, requestCodeNumber(request.requestCode)), 0);
    return `CHO-${year}-${String(maxCode + 1).padStart(3, "0")}`;
  };

  const readRequests = () => {
    const rawRequests = readList(STORAGE.requests);
    const normalizedUnsorted = rawRequests.map(normalizeRequest);
    const normalized = normalizedUnsorted
      .slice()
      .sort((left, right) => new Date(right.requestDate).getTime() - new Date(left.requestDate).getTime());

    const needsBackfill = rawRequests.length === normalizedUnsorted.length && rawRequests.some((entry, index) => {
      const normalizedEntry = normalizedUnsorted[index];
      return text(entry.id) !== text(normalizedEntry.id)
        || text(entry.requestGroupId || entry.groupId) !== text(normalizedEntry.requestGroupId)
        || text(entry.requestCode) !== text(normalizedEntry.requestCode);
    });

    if (needsBackfill) {
      return writeRequests(normalized)
        .map(normalizeRequest)
        .sort((left, right) => new Date(right.requestDate).getTime() - new Date(left.requestDate).getTime());
    }

    return normalized;
  };

  const writeRequests = (requests = []) => {
    const normalized = requests.map(normalizeRequest);
    const year = new Date().getFullYear();
    let nextCodeValue = normalized
      .filter((request) => text(request.requestCode).startsWith(`CHO-${year}-`))
      .reduce((highest, request) => Math.max(highest, requestCodeNumber(request.requestCode)), 0);

    const groupCodes = new Map();
    normalized.forEach((request) => {
      if (request.requestCode) {
        groupCodes.set(text(request.requestGroupId || request.id), request.requestCode);
      }
    });

    const withCodes = normalized.map((request) => {
      const groupId = text(request.requestGroupId || request.id);
      if (request.requestCode) return request;

      const existingCode = groupCodes.get(groupId);
      if (existingCode) {
        return {
          ...request,
          requestCode: existingCode
        };
      }

      nextCodeValue += 1;
      const requestCode = `CHO-${year}-${String(nextCodeValue).padStart(3, "0")}`;
      groupCodes.set(groupId, requestCode);
      return {
        ...request,
        requestCode
      };
    });

    writeList(STORAGE.requests, withCodes);
    return withCodes;
  };

  const normalizeMovementLink = (entry = {}) => ({
    id: text(entry.id) || uid(),
    medicineId: text(entry.medicineId),
    medicineName: text(entry.medicineName),
    actionType: text(entry.actionType).toLowerCase(),
    quantity: Math.max(0, Math.round(numeric(entry.quantity))),
    createdAt: text(entry.createdAt) || nowIso(),
    note: text(entry.note),
    linkedRequestId: text(entry.linkedRequestId || entry.requestId || entry.linkedRequestItemId),
    linkedRequestItemId: text(entry.linkedRequestItemId || entry.linkedRequestId || entry.requestId),
    linkedRequestGroupId: text(entry.linkedRequestGroupId || entry.requestGroupId),
    linkedRequestCode: text(entry.linkedRequestCode || entry.requestCode)
  });

  const readMovements = () => readList(STORAGE.movements).map(normalizeMovementLink);

  const getRequestDeliveries = (request, movements = readMovements()) => {
    const requestId = text(request?.id);
    const requestGroupId = text(request?.requestGroupId);
    const requestCode = text(request?.requestCode);
    const medicineId = text(request?.medicineId);
    const medicineName = text(request?.medicineName).toLowerCase();

    return movements
      .map(normalizeMovementLink)
      .filter((movement) => movement.actionType === "restock" && (
        (requestId && text(movement.linkedRequestItemId) === requestId)
        || (requestId && !text(movement.linkedRequestItemId) && text(movement.linkedRequestId) === requestId)
        || (
          !requestId
          && (
            (requestGroupId && text(movement.linkedRequestGroupId) === requestGroupId)
            || (requestCode && text(movement.linkedRequestCode) === requestCode)
          )
          && (
            (medicineId && text(movement.medicineId) === medicineId)
            || (!medicineId && medicineName && text(movement.medicineName).toLowerCase() === medicineName)
          )
        )
        || (
          requestId
          && text(movement.linkedRequestItemId) !== requestId
          && (
            (requestGroupId && text(movement.linkedRequestGroupId) === requestGroupId)
            || (requestCode && text(movement.linkedRequestCode) === requestCode)
          )
          && (
            (medicineId && text(movement.medicineId) === medicineId)
            || (!medicineId && medicineName && text(movement.medicineName).toLowerCase() === medicineName)
          )
        )
      ))
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  };

  const computeRequestProgress = (request, movements = readMovements(), today = todayInputValue()) => {
    const normalizedRequest = normalizeRequest(request);
    const deliveries = getRequestDeliveries(normalizedRequest, movements);
    const quantityRequested = normalizedRequest.quantityRequested;
    let receivedQuantity = 0;
    let completionDate = "";

    deliveries.forEach((delivery) => {
      receivedQuantity += delivery.quantity;
      if (!completionDate && receivedQuantity >= quantityRequested) {
        completionDate = toDateKey(delivery.createdAt);
      }
    });

    const remainingQuantity = Math.max(0, quantityRequested - receivedQuantity);
    const lastReceivedAt = deliveries.length ? deliveries[deliveries.length - 1].createdAt : "";
    const lastReceivedDate = lastReceivedAt ? toDateKey(lastReceivedAt) : "";
    const isComplete = receivedQuantity >= quantityRequested;
    const hasDelivery = receivedQuantity > 0;
    const isOverdue = !isComplete && toDateTimestamp(today) > toDateTimestamp(normalizedRequest.expectedDate);
    const delayed = isComplete && toDateTimestamp(completionDate) > toDateTimestamp(normalizedRequest.expectedDate);
    const onTime = isComplete && !delayed;
    const incomplete = hasDelivery && !isComplete;
    const pending = !hasDelivery;

    let statusKey = "pending";
    let statusLabel = isOverdue ? "Overdue Request" : "Pending Request";
    let tone = isOverdue ? "danger" : "olive";

    if (onTime) {
      statusKey = "on-time";
      statusLabel = "On Time Delivery";
      tone = "success";
    } else if (delayed) {
      statusKey = "delayed";
      statusLabel = "Delayed Delivery";
      tone = "danger";
    } else if (incomplete) {
      statusKey = "partial";
      statusLabel = "Incomplete Delivery";
      tone = isOverdue ? "danger" : "warning";
    }

    const leadTimeDays = isComplete ? diffDays(normalizedRequest.requestDate, completionDate) : null;
    const elapsedDays = hasDelivery
      ? diffDays(normalizedRequest.requestDate, lastReceivedDate)
      : diffDays(normalizedRequest.requestDate, today);

    return {
      ...normalizedRequest,
      deliveries,
      receivedQuantity,
      remainingQuantity,
      completionDate,
      lastReceivedAt,
      lastReceivedDate,
      leadTimeDays,
      elapsedDays,
      progressPercent: Math.min(100, Math.round((receivedQuantity / quantityRequested) * 100)),
      isComplete,
      hasDelivery,
      isOverdue,
      onTime,
      delayed,
      incomplete,
      pending,
      overdueDays: (isOverdue || delayed) ? diffDays(normalizedRequest.expectedDate, isComplete ? completionDate : today) : 0,
      statusKey,
      statusLabel,
      tone
    };
  };

  const hydrateRequests = (requests = readRequests(), movements = readMovements(), today = todayInputValue()) => requests
    .map((request) => computeRequestProgress(request, movements, today))
    .sort((left, right) => new Date(right.requestDate).getTime() - new Date(left.requestDate).getTime());

  const summarizeMedicineNames = (items = []) => {
    const labels = items.map((item) => text(item.medicineName)).filter(Boolean);
    if (!labels.length) return "No medicines listed";
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
  };

  const summarizeQuantities = (items = [], key = "quantityRequested") => {
    const parts = items
      .slice(0, 2)
      .map((item) => `${Math.max(0, Math.round(numeric(item[key])))} ${text(item.unit) || "units"}`)
      .filter(Boolean);

    if (!parts.length) return "-";
    return `${parts.join(" | ")}${items.length > 2 ? ` +${items.length - 2} more` : ""}`;
  };

  const hydrateRequestGroups = (requests = readRequests(), movements = readMovements(), today = todayInputValue()) => {
    const itemRows = hydrateRequests(requests, movements, today);
    const grouped = itemRows.reduce((map, itemRow) => {
      const groupId = text(itemRow.requestGroupId || itemRow.requestCode || itemRow.id);
      const bucket = map.get(groupId) || [];
      bucket.push(itemRow);
      map.set(groupId, bucket);
      return map;
    }, new Map());

    return Array.from(grouped.entries()).map(([groupId, items]) => {
      const sortedItems = [...items].sort((left, right) => left.medicineName.localeCompare(right.medicineName));
      const base = sortedItems[0] || {};
      const itemCount = sortedItems.length;
      const completedItems = sortedItems.filter((item) => item.isComplete).length;
      const deliveredItems = sortedItems.filter((item) => item.hasDelivery).length;
      const pendingItems = sortedItems.filter((item) => item.pending).length;
      const incompleteItems = sortedItems.filter((item) => item.incomplete || item.statusKey === "partial").length;
      const delayedItems = sortedItems.filter((item) => item.delayed).length;
      const onTimeItems = sortedItems.filter((item) => item.onTime).length;
      const totalRequestedQuantity = sortedItems.reduce((total, item) => total + numeric(item.quantityRequested), 0);
      const totalReceivedQuantity = sortedItems.reduce((total, item) => total + numeric(item.receivedQuantity), 0);
      const totalRemainingQuantity = sortedItems.reduce((total, item) => total + numeric(item.remainingQuantity), 0);
      const hasDelivery = deliveredItems > 0;
      const isComplete = itemCount > 0 && completedItems === itemCount;
      const completionDates = sortedItems.map((item) => item.completionDate).filter(Boolean).sort();
      const receivedDates = sortedItems.map((item) => item.lastReceivedDate).filter(Boolean).sort();
      const completionDate = completionDates.length ? completionDates[completionDates.length - 1] : "";
      const lastReceivedDate = receivedDates.length ? receivedDates[receivedDates.length - 1] : "";
      const requestDate = base.requestDate || today;
      const expectedDate = base.expectedDate || today;
      const isOverdue = !isComplete && toDateTimestamp(today) > toDateTimestamp(expectedDate);
      const delayed = isComplete && delayedItems > 0;
      const onTime = isComplete && delayedItems === 0;
      const incomplete = hasDelivery && !isComplete;
      const pending = !hasDelivery;
      const leadTimeDays = isComplete ? diffDays(requestDate, completionDate) : null;
      const elapsedDays = hasDelivery ? diffDays(requestDate, lastReceivedDate) : diffDays(requestDate, today);

      let statusKey = "pending";
      let statusLabel = isOverdue ? "Overdue Request" : "Pending Request";
      let tone = isOverdue ? "danger" : "olive";

      if (onTime) {
        statusKey = "on-time";
        statusLabel = "On Time Delivery";
        tone = "success";
      } else if (delayed) {
        statusKey = "delayed";
        statusLabel = "Delayed Delivery";
        tone = "danger";
      } else if (incomplete) {
        statusKey = "incomplete";
        statusLabel = "Incomplete Delivery";
        tone = isOverdue ? "danger" : "warning";
      }

      return {
        id: groupId,
        requestGroupId: groupId,
        requestCode: base.requestCode,
        requestDate,
        expectedDate,
        source: base.source,
        requestedBy: base.requestedBy,
        notes: base.notes,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
        items: sortedItems,
        itemCount,
        totalRequestedQuantity,
        totalReceivedQuantity,
        totalRemainingQuantity,
        completedItems,
        deliveredItems,
        pendingItems,
        incompleteItems,
        delayedItems,
        onTimeItems,
        hasDelivery,
        isComplete,
        isOverdue,
        delayed,
        onTime,
        incomplete,
        pending,
        completionDate,
        lastReceivedDate,
        leadTimeDays,
        elapsedDays,
        overdueDays: (isOverdue || delayed) ? diffDays(expectedDate, isComplete ? completionDate : today) : 0,
        statusKey,
        statusLabel,
        tone,
        medicineSummary: summarizeMedicineNames(sortedItems),
        requestedSummary: summarizeQuantities(sortedItems, "quantityRequested"),
        receivedSummary: summarizeQuantities(sortedItems, "receivedQuantity")
      };
    }).sort((left, right) => new Date(right.requestDate).getTime() - new Date(left.requestDate).getTime());
  };

  const buildMonthlyLeadTimeSeries = (rows, year = new Date().getFullYear()) => Array.from({ length: 12 }, (_, monthIndex) => {
    const monthRows = rows.filter((row) => {
      if (!row.isComplete || !row.completionDate) return false;
      const completion = new Date(`${row.completionDate}T00:00:00`);
      return completion.getFullYear() === year && completion.getMonth() === monthIndex;
    });

    if (!monthRows.length) return 0;
    return Number(average(monthRows.map((row) => row.leadTimeDays)).toFixed(1));
  });

  const buildSupplyAnalytics = ({
    requests = readRequests(),
    movements = readMovements(),
    today = todayInputValue(),
    year = new Date().getFullYear()
  } = {}) => {
    const itemRows = hydrateRequests(requests, movements, today);
    const rows = hydrateRequestGroups(requests, movements, today);
    const completedRows = rows.filter((row) => row.isComplete);
    const onTimeRows = rows.filter((row) => row.onTime);
    const delayedRows = rows.filter((row) => row.delayed);
    const incompleteRows = rows.filter((row) => row.incomplete);
    const pendingRows = rows.filter((row) => row.pending);
    const allDeliveries = itemRows.flatMap((row) => row.deliveries);
    const latestDelivery = [...allDeliveries]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null;

    const averageLeadTime = Number(average(completedRows.map((row) => row.leadTimeDays)).toFixed(1));
    const onTimeRate = completedRows.length ? Number(((onTimeRows.length / completedRows.length) * 100).toFixed(1)) : 0;

    return {
      itemRows,
      rows,
      completedRows,
      summary: {
        totalRequests: rows.length,
        averageLeadTime,
        onTimeCount: onTimeRows.length,
        delayedCount: delayedRows.length,
        incompleteCount: incompleteRows.length,
        pendingCount: pendingRows.length,
        completedCount: completedRows.length,
        onTimeRate,
        latestDeliveryDate: latestDelivery ? toDateKey(latestDelivery.createdAt) : "",
        latestDeliveryAt: latestDelivery?.createdAt || ""
      },
      monthlyLeadTimes: buildMonthlyLeadTimeSeries(rows, year),
      recentRows: rows.slice(0, 5)
    };
  };

  const getLinkableRequestsForMedicine = ({
    medicineId = "",
    medicineName = "",
    requests = readRequests(),
    movements = readMovements(),
    today = todayInputValue()
  } = {}) => hydrateRequests(requests, movements, today).filter((row) => {
    const sameMedicine = (text(row.medicineId) && text(row.medicineId) === text(medicineId))
      || (!text(row.medicineId) && text(row.medicineName).toLowerCase() === text(medicineName).toLowerCase());
    return sameMedicine && !row.isComplete;
  });

  window.MSSSupplyMonitoring = {
    STORAGE,
    text,
    numeric,
    nowIso,
    uid,
    readList,
    writeList,
    todayInputValue,
    addDays,
    normalizeInputDate,
    diffDays,
    normalizeRequest,
    nextRequestCode,
    readRequests,
    writeRequests,
    readMovements,
    getRequestDeliveries,
    computeRequestProgress,
    hydrateRequests,
    hydrateRequestGroups,
    buildSupplyAnalytics,
    getLinkableRequestsForMedicine
  };
})();
