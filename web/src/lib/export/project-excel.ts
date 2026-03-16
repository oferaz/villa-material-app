import { getObjectWorkflowStage, getWorkflowStageLabel, House, Project, ProjectBudget, RoomObject } from "@/types";
import type { Row, Worksheet } from "exceljs";

interface FlatObjectRow {
  houseName: string;
  roomName: string;
  roomType: string;
  objectName: string;
  objectCategory: string;
  quantity: number;
  workflowStage: string;
  materialAssigned: string;
  supplier: string;
  budgetCategory: string;
  unitPrice: number;
  totalPrice: number;
  sourceType: string;
  sourceUrl: string;
  poApproved: string;
  ordered: string;
  installed: string;
}

function toRowObject(house: House, roomName: string, roomType: string, objectItem: RoomObject): FlatObjectRow {
  const selectedOption =
    objectItem.productOptions.find((option) => option.id === objectItem.selectedProductId) ?? objectItem.productOptions[0];
  const quantity = Math.max(1, objectItem.quantity || 1);
  const unitPrice = selectedOption?.price ?? 0;

  return {
    houseName: house.name,
    roomName,
    roomType,
    objectName: objectItem.name,
    objectCategory: objectItem.category,
    quantity,
    workflowStage: getWorkflowStageLabel(getObjectWorkflowStage(objectItem)),
    materialAssigned: selectedOption ? "Yes" : "No",
    supplier: selectedOption?.supplier || "Unassigned",
    budgetCategory: selectedOption?.budgetCategory || "Unassigned",
    unitPrice,
    totalPrice: unitPrice * quantity,
    sourceType: selectedOption?.sourceType || "",
    sourceUrl: selectedOption?.sourceUrl || "",
    poApproved: objectItem.poApproved ? "Yes" : "No",
    ordered: objectItem.ordered ? "Yes" : "No",
    installed: objectItem.installed ? "Yes" : "No",
  };
}

function flattenProject(project: Project): FlatObjectRow[] {
  const rows: FlatObjectRow[] = [];
  for (const house of project.houses) {
    for (const room of house.rooms) {
      for (const objectItem of room.objects) {
        rows.push(toRowObject(house, room.name, room.type, objectItem));
      }
    }
  }
  return rows;
}

function styleHeaderRow(row: Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.font = {
      color: { argb: "FFFFFFFF" },
      bold: true,
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };
  });
}

function autoFitColumns(worksheet: Worksheet) {
  if (!worksheet.columns) {
    return;
  }
  worksheet.columns.forEach((column) => {
    let max = 12;
    if (typeof column.eachCell !== "function") {
      column.width = max;
      return;
    }
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      max = Math.max(max, Math.min(50, value.length + 2));
    });
    column.width = max;
  });
}

async function loadLogoAsDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch("/materia-logo.png");
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to load logo."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportProjectToExcel(project: Project, budget: ProjectBudget): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Excel export is available in browser only.");
  }

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Materia";
  workbook.lastModifiedBy = "Materia";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Project export for ${project.name}`;
  workbook.title = "Materia Project Export";

  const rows = flattenProject(project);
  const exportDate = new Date();

  const overviewSheet = workbook.addWorksheet("Project Overview");
  overviewSheet.getCell("C1").value = "Materia Project Export";
  overviewSheet.getCell("C1").font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  overviewSheet.getCell("C2").value = project.name;
  overviewSheet.getCell("C2").font = { bold: true, size: 12, color: { argb: "FF334155" } };

  const logo = await loadLogoAsDataUrl();
  if (logo) {
    const imageId = workbook.addImage({
      base64: logo,
      extension: "png",
    });
    overviewSheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.2 },
      ext: { width: 58, height: 58 },
    });
  }

  const summaryStart = 4;
  const summaryRows: Array<[string, string | number]> = [
    ["Exported at", exportDate.toLocaleString()],
    ["Project", project.name],
    ["Client", project.customer],
    ["Location", project.location],
    ["Houses", project.houses.length],
    [
      "Rooms",
      project.houses.reduce((acc, house) => acc + house.rooms.length, 0),
    ],
    ["Object rows", rows.length],
    ["Object quantity total", rows.reduce((acc, row) => acc + row.quantity, 0)],
    ["Allocated amount", budget.allocatedAmount],
    ["Total budget", budget.totalBudget],
    ["Remaining budget", budget.remainingAmount],
  ];

  summaryRows.forEach((item, index) => {
    const rowIndex = summaryStart + index;
    overviewSheet.getCell(`A${rowIndex}`).value = item[0];
    overviewSheet.getCell(`A${rowIndex}`).font = { bold: true, color: { argb: "FF334155" } };
    overviewSheet.getCell(`B${rowIndex}`).value = item[1];
  });

  overviewSheet.getColumn("A").width = 24;
  overviewSheet.getColumn("B").width = 32;
  overviewSheet.getColumn("C").width = 36;
  overviewSheet.getCell(`B${summaryStart + 8}`).numFmt = "#,##0.00";
  overviewSheet.getCell(`B${summaryStart + 9}`).numFmt = "#,##0.00";
  overviewSheet.getCell(`B${summaryStart + 10}`).numFmt = "#,##0.00";

  const detailsSheet = workbook.addWorksheet("Objects Detail");
  detailsSheet.columns = [
    { header: "House", key: "houseName" },
    { header: "Room", key: "roomName" },
    { header: "Room Type", key: "roomType" },
    { header: "Object", key: "objectName" },
    { header: "Type", key: "objectCategory" },
    { header: "Quantity", key: "quantity" },
    { header: "Workflow Stage", key: "workflowStage" },
    { header: "Material Assigned", key: "materialAssigned" },
    { header: "Supplier", key: "supplier" },
    { header: "Budget Category", key: "budgetCategory" },
    { header: "Unit Price", key: "unitPrice" },
    { header: "Total Price", key: "totalPrice" },
    { header: "Source Type", key: "sourceType" },
    { header: "Source URL", key: "sourceUrl" },
    { header: "PO Approved", key: "poApproved" },
    { header: "Ordered", key: "ordered" },
    { header: "Installed", key: "installed" },
  ];
  detailsSheet.addRows(rows);
  styleHeaderRow(detailsSheet.getRow(1));
  detailsSheet.views = [{ state: "frozen", ySplit: 1 }];
  detailsSheet.getColumn("unitPrice").numFmt = "#,##0.00";
  detailsSheet.getColumn("totalPrice").numFmt = "#,##0.00";
  autoFitColumns(detailsSheet);

  const supplierSheet = workbook.addWorksheet("By Supplier");
  const supplierMap = new Map<string, { lines: number; quantity: number; totalValue: number; withMaterial: number }>();
  rows.forEach((row) => {
    const key = row.supplier || "Unassigned";
    const current = supplierMap.get(key) ?? { lines: 0, quantity: 0, totalValue: 0, withMaterial: 0 };
    current.lines += 1;
    current.quantity += row.quantity;
    current.totalValue += row.totalPrice;
    if (row.materialAssigned === "Yes") {
      current.withMaterial += row.quantity;
    }
    supplierMap.set(key, current);
  });
  const supplierRows = Array.from(supplierMap.entries())
    .map(([supplier, value]) => ({
      supplier,
      lines: value.lines,
      quantity: value.quantity,
      assignedQty: value.withMaterial,
      totalValue: value.totalValue,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  supplierSheet.columns = [
    { header: "Supplier", key: "supplier" },
    { header: "Object Rows", key: "lines" },
    { header: "Quantity", key: "quantity" },
    { header: "Assigned Qty", key: "assignedQty" },
    { header: "Total Value", key: "totalValue" },
  ];
  supplierSheet.addRows(supplierRows);
  styleHeaderRow(supplierSheet.getRow(1));
  supplierSheet.getColumn("totalValue").numFmt = "#,##0.00";
  supplierSheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(supplierSheet);

  const houseSheet = workbook.addWorksheet("By House");
  const houseRows = project.houses.map((house) => {
    const houseObjects = rows.filter((row) => row.houseName === house.name);
    const quantity = houseObjects.reduce((acc, row) => acc + row.quantity, 0);
    const assigned = houseObjects.reduce((acc, row) => acc + (row.materialAssigned === "Yes" ? row.quantity : 0), 0);
    return {
      house: house.name,
      sizeSqm: house.sizeSqm ?? "",
      rooms: house.rooms.length,
      objectRows: houseObjects.length,
      quantity,
      assigned,
      pending: quantity - assigned,
      totalValue: houseObjects.reduce((acc, row) => acc + row.totalPrice, 0),
    };
  });
  houseSheet.columns = [
    { header: "House", key: "house" },
    { header: "Size (m2)", key: "sizeSqm" },
    { header: "Rooms", key: "rooms" },
    { header: "Object Rows", key: "objectRows" },
    { header: "Quantity", key: "quantity" },
    { header: "Assigned Qty", key: "assigned" },
    { header: "Pending Qty", key: "pending" },
    { header: "Total Value", key: "totalValue" },
  ];
  houseSheet.addRows(houseRows);
  styleHeaderRow(houseSheet.getRow(1));
  houseSheet.getColumn("totalValue").numFmt = "#,##0.00";
  houseSheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(houseSheet);

  const typeSheet = workbook.addWorksheet("By Type");
  const typeMap = new Map<string, { quantity: number; totalValue: number; assigned: number }>();
  rows.forEach((row) => {
    const key = row.objectCategory || "Unknown";
    const current = typeMap.get(key) ?? { quantity: 0, totalValue: 0, assigned: 0 };
    current.quantity += row.quantity;
    current.totalValue += row.totalPrice;
    if (row.materialAssigned === "Yes") {
      current.assigned += row.quantity;
    }
    typeMap.set(key, current);
  });
  const typeRows = Array.from(typeMap.entries())
    .map(([type, value]) => ({
      type,
      quantity: value.quantity,
      assignedQty: value.assigned,
      pendingQty: value.quantity - value.assigned,
      totalValue: value.totalValue,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  typeSheet.columns = [
    { header: "Object Type", key: "type" },
    { header: "Quantity", key: "quantity" },
    { header: "Assigned Qty", key: "assignedQty" },
    { header: "Pending Qty", key: "pendingQty" },
    { header: "Total Value", key: "totalValue" },
  ];
  typeSheet.addRows(typeRows);
  styleHeaderRow(typeSheet.getRow(1));
  typeSheet.getColumn("totalValue").numFmt = "#,##0.00";
  typeSheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(typeSheet);

  const workflowSheet = workbook.addWorksheet("Workflow");
  const stageOrder = ["Material missing", "Material assigned", "PO approved", "Ordered", "Installed"];
  const stageMap = new Map<string, number>();
  stageOrder.forEach((stage) => stageMap.set(stage, 0));
  rows.forEach((row) => {
    stageMap.set(row.workflowStage, (stageMap.get(row.workflowStage) ?? 0) + row.quantity);
  });

  workflowSheet.columns = [
    { header: "Scope", key: "scope" },
    { header: "House", key: "house" },
    { header: "Room", key: "room" },
    { header: "Total Qty", key: "totalQty" },
    { header: "Material Assigned", key: "assignedQty" },
    { header: "PO Approved", key: "poQty" },
    { header: "Ordered", key: "orderedQty" },
    { header: "Installed", key: "installedQty" },
    { header: "Completion %", key: "completionPercent" },
  ];

  const workflowRows: Array<Record<string, string | number>> = [];
  const projectTotal = rows.reduce((acc, row) => acc + row.quantity, 0);
  const projectInstalled = rows.reduce((acc, row) => acc + (row.installed === "Yes" ? row.quantity : 0), 0);
  workflowRows.push({
    scope: "Project",
    house: "",
    room: "",
    totalQty: projectTotal,
    assignedQty: rows.reduce((acc, row) => acc + (row.materialAssigned === "Yes" ? row.quantity : 0), 0),
    poQty: rows.reduce((acc, row) => acc + (row.poApproved === "Yes" ? row.quantity : 0), 0),
    orderedQty: rows.reduce((acc, row) => acc + (row.ordered === "Yes" ? row.quantity : 0), 0),
    installedQty: projectInstalled,
    completionPercent: projectTotal > 0 ? projectInstalled / projectTotal : 0,
  });

  for (const house of project.houses) {
    const houseObjects = rows.filter((row) => row.houseName === house.name);
    const houseTotal = houseObjects.reduce((acc, row) => acc + row.quantity, 0);
    const houseInstalled = houseObjects.reduce((acc, row) => acc + (row.installed === "Yes" ? row.quantity : 0), 0);
    workflowRows.push({
      scope: "House",
      house: house.name,
      room: "",
      totalQty: houseTotal,
      assignedQty: houseObjects.reduce((acc, row) => acc + (row.materialAssigned === "Yes" ? row.quantity : 0), 0),
      poQty: houseObjects.reduce((acc, row) => acc + (row.poApproved === "Yes" ? row.quantity : 0), 0),
      orderedQty: houseObjects.reduce((acc, row) => acc + (row.ordered === "Yes" ? row.quantity : 0), 0),
      installedQty: houseInstalled,
      completionPercent: houseTotal > 0 ? houseInstalled / houseTotal : 0,
    });

    for (const room of house.rooms) {
      const roomObjects = houseObjects.filter((row) => row.roomName === room.name);
      const roomTotal = roomObjects.reduce((acc, row) => acc + row.quantity, 0);
      const roomInstalled = roomObjects.reduce((acc, row) => acc + (row.installed === "Yes" ? row.quantity : 0), 0);
      workflowRows.push({
        scope: "Room",
        house: house.name,
        room: room.name,
        totalQty: roomTotal,
        assignedQty: roomObjects.reduce((acc, row) => acc + (row.materialAssigned === "Yes" ? row.quantity : 0), 0),
        poQty: roomObjects.reduce((acc, row) => acc + (row.poApproved === "Yes" ? row.quantity : 0), 0),
        orderedQty: roomObjects.reduce((acc, row) => acc + (row.ordered === "Yes" ? row.quantity : 0), 0),
        installedQty: roomInstalled,
        completionPercent: roomTotal > 0 ? roomInstalled / roomTotal : 0,
      });
    }
  }

  workflowSheet.addRows(workflowRows);
  styleHeaderRow(workflowSheet.getRow(1));
  workflowSheet.getColumn("completionPercent").numFmt = "0.00%";
  workflowSheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(workflowSheet);

  const stageStartRow = workflowRows.length + 4;
  workflowSheet.getCell(`A${stageStartRow}`).value = "Stage Distribution";
  workflowSheet.getCell(`A${stageStartRow}`).font = { bold: true, color: { argb: "FF0F172A" } };
  workflowSheet.getCell(`A${stageStartRow + 1}`).value = "Stage";
  workflowSheet.getCell(`B${stageStartRow + 1}`).value = "Quantity";
  styleHeaderRow(workflowSheet.getRow(stageStartRow + 1));
  stageOrder.forEach((stage, index) => {
    workflowSheet.getCell(`A${stageStartRow + 2 + index}`).value = stage;
    workflowSheet.getCell(`B${stageStartRow + 2 + index}`).value = stageMap.get(stage) ?? 0;
  });

  const budgetSheet = workbook.addWorksheet("Budget");
  budgetSheet.columns = [
    { header: "Budget Scope", key: "scope" },
    { header: "Category", key: "category" },
    { header: "Total Budget", key: "totalBudget" },
    { header: "Allocated", key: "allocated" },
    { header: "Remaining", key: "remaining" },
    { header: "Utilization %", key: "utilization" },
  ];
  budgetSheet.addRow({
    scope: "Project",
    category: "All",
    totalBudget: budget.totalBudget,
    allocated: budget.allocatedAmount,
    remaining: budget.remainingAmount,
    utilization: budget.totalBudget > 0 ? budget.allocatedAmount / budget.totalBudget : 0,
  });
  budget.categories.forEach((category) => {
    budgetSheet.addRow({
      scope: "Category",
      category: category.name,
      totalBudget: category.totalBudget,
      allocated: category.allocatedAmount,
      remaining: category.remainingAmount,
      utilization: category.totalBudget > 0 ? category.allocatedAmount / category.totalBudget : 0,
    });
  });
  styleHeaderRow(budgetSheet.getRow(1));
  budgetSheet.getColumn("totalBudget").numFmt = "#,##0.00";
  budgetSheet.getColumn("allocated").numFmt = "#,##0.00";
  budgetSheet.getColumn("remaining").numFmt = "#,##0.00";
  budgetSheet.getColumn("utilization").numFmt = "0.00%";
  budgetSheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(budgetSheet);

  const output = await workbook.xlsx.writeBuffer();
  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeProjectName = project.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Project";
  const dateStamp = exportDate.toISOString().slice(0, 10);
  const fileName = `Materia_${safeProjectName}_${dateStamp}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
