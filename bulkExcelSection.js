// bulkExcelSection.js

let excelOrders = [];
let excelAllTests = {};

document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('bulkExcelSection')) {
        loadExcelDepartments();
        loadExcelBranches();
        window.clearExcelFilters = clearExcelFilters;
        window.loadExcelOrders = loadExcelOrders;
        window.exportExcelOrdersData = exportExcelOrdersData;
        window.exportExcelOrdersResults = exportExcelOrdersResults;
    }
});

async function loadExcelDepartments() {
    // Populate department dropdown
    const select = document.getElementById('excelDepartment');
    const testsDoc = await db.collection('tests_list').doc('Tests.html').get();
    if (testsDoc.exists) {
        excelAllTests = testsDoc.data();
        const departments = new Set();
        Object.values(excelAllTests).forEach(test => {
            if (test.department) departments.add(test.department);
        });
        Array.from(departments).sort().forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            opt.textContent = dept;
            select.appendChild(opt);
        });
    }
}

async function loadExcelBranches() {
    const select = document.getElementById('excelBranch');
    const snapshot = await db.collection('branches').get();
    snapshot.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = doc.id;
        select.appendChild(opt);
    });
}

function clearExcelFilters() {
    document.getElementById('excelDateFrom').value = '';
    document.getElementById('excelDateTo').value = '';
    document.getElementById('excelTimeFrom').value = '';
    document.getElementById('excelTimeTo').value = '';
    document.getElementById('excelDepartment').value = '';
    document.getElementById('excelTestStatus').value = '';
    document.getElementById('excelPatientType').value = '';
    document.getElementById('excelBranch').value = '';
    document.getElementById('excelTestStatus2').value = '';
    document.getElementById('excelSearch').value = '';
    document.getElementById('excelOrdersTable').innerHTML = `
        <tr>
            <td colspan="10" class="text-center py-4">
                <div class="text-muted">
                    <i class="fas fa-search fa-2x mb-3"></i><br>
                    Use the filters above to search for orders
                </div>
            </td>
        </tr>
    `;
    document.getElementById('excelFilteredOrdersCount').textContent = '0';
    document.getElementById('bulkExcelDataBtn').disabled = true;
    document.getElementById('bulkExcelResultsBtn').disabled = true;
    excelOrders = [];
}

async function loadExcelOrders() {
    // Get filter values
    const dateFrom = document.getElementById('excelDateFrom').value;
    const dateTo = document.getElementById('excelDateTo').value;
    const timeFrom = document.getElementById('excelTimeFrom').value || '00:00';
    const timeTo = document.getElementById('excelTimeTo').value || '23:59';
    const department = document.getElementById('excelDepartment').value;
    const testStatus = document.getElementById('excelTestStatus').value;
    const patientType = document.getElementById('excelPatientType').value;
    const branch = document.getElementById('excelBranch').value;
    const testStatus2 = document.getElementById('excelTestStatus2').value;
    const search = document.getElementById('excelSearch').value.trim().toLowerCase();

    // Convert dates to JS Date
    let startDate = dateFrom ? new Date(`${dateFrom}T${timeFrom}`) : null;
    let endDate = dateTo ? new Date(`${dateTo}T${timeTo}`) : null;

    // Load all orders from new_record
    const partsSnapshot = await db.collection('new_record').get();
    excelOrders = [];

    for (const doc of partsSnapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.patients)) {
            for (const patientObj of data.patients) {
                for (const key in patientObj) {
                    const patient = patientObj[key];
                    if (Array.isArray(patient.orders)) {
                        for (const order of patient.orders) {
                            // Filter logic
                            let orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
                            if (startDate && orderDate < startDate) continue;
                            if (endDate && orderDate > endDate) continue;
                            if (patientType && order.patient_type !== patientType) continue;
                            if (branch && order.branch !== branch) continue;
                            if (department && order.tests && !order.tests.some(t => excelAllTests[t.test_id]?.department === department)) continue;
                            if (testStatus && order.tests && !order.tests.some(t => t.status === testStatus)) continue;
                            if (testStatus2 && order.tests && !order.tests.some(t => t.status === testStatus2)) continue;
                            if (search) {
                                const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.toLowerCase();
                                const patientId = (patient.details?.patient_id || '').toLowerCase();
                                const mobile = (patient.details?.mobile || '').toLowerCase();
                                const orderId = (order.order_id || '').toLowerCase();
                                if (!patientName.includes(search) && !patientId.includes(search) && !mobile.includes(search) && !orderId.includes(search)) continue;
                            }
                            excelOrders.push({ patient, order });
                        }
                    }
                }
            }
        }
    }

    // Render preview table
    renderExcelOrdersTable();
}

function renderExcelOrdersTable() {
    const tbody = document.getElementById('excelOrdersTable');
    if (!tbody) return;
    if (excelOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4">
                    <div class="text-muted">
                        <i class="fas fa-exclamation-circle fa-2x mb-3"></i><br>
                        No orders found matching the filters
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('excelFilteredOrdersCount').textContent = '0';
        document.getElementById('bulkExcelDataBtn').disabled = true;
        document.getElementById('bulkExcelResultsBtn').disabled = true;
        return;
    }
    let html = '';
    excelOrders.forEach(({ patient, order }) => {
        const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.trim();
        const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
        html += `
            <tr>
                <td>${order.order_id}</td>
                <td>${patientName}</td>
                <td>${patient.details?.patient_id || ''}</td>
                <td>${order.status || ''}</td>
                <td>${orderDate.toLocaleString()}</td>
                <td>${order.tests?.length || 0}</td>
                <td>${order.total_amount?.toFixed ? order.total_amount.toFixed(2) : (order.total_amount || 0)}</td>
                <td>${order.total_paid?.toFixed ? order.total_paid.toFixed(2) : (order.total_paid || 0)}</td>
                <td>${order.total_discount?.toFixed ? order.total_discount.toFixed(2) : (order.total_discount || 0)}</td>
                <td>${((order.total_amount || 0) - (order.total_paid || 0) - (order.total_discount || 0)).toFixed(2)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    document.getElementById('excelFilteredOrdersCount').textContent = excelOrders.length;
    document.getElementById('bulkExcelDataBtn').disabled = false;
    document.getElementById('bulkExcelResultsBtn').disabled = false;
}

// Export Excel Data (Orders + Payments)
function exportExcelOrdersData() {
    if (excelOrders.length === 0) return;
    const rows = [];
    rows.push([
        'Order ID', 'Patient Name', 'Patient ID', 'Status', 'Order Date', 'Tests Count',
        'Total Amount', 'Total Paid', 'Total Discount', 'Total Remaining'
    ]);
    let sumAmount = 0, sumPaid = 0, sumDiscount = 0, sumRemaining = 0;
    excelOrders.forEach(({ patient, order }) => {
        const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.trim();
        const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
        const totalAmount = Number(order.total_amount || 0);
        const totalPaid = Number(order.total_paid || 0);
        const totalDiscount = Number(order.total_discount || 0);
        const totalRemaining = totalAmount - totalPaid - totalDiscount;
        sumAmount += totalAmount;
        sumPaid += totalPaid;
        sumDiscount += totalDiscount;
        sumRemaining += totalRemaining;
        rows.push([
            order.order_id,
            patientName,
            patient.details?.patient_id || '',
            order.status || '',
            orderDate.toLocaleString(),
            order.tests?.length || 0,
            totalAmount,
            totalPaid,
            totalDiscount,
            totalRemaining
        ]);
    });
    // Add totals row
    rows.push([
        'TOTAL', '', '', '', '', '',
        sumAmount, sumPaid, sumDiscount, sumRemaining
    ]);
    // Export using XLSX
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'Bulk_Orders_Data.xlsx');
}

// Export Excel Results (Test Results)
function exportExcelOrdersResults() {
    if (excelOrders.length === 0) return;
    const rows = [];
    rows.push([
        'Patient ID', 'Patient Name', 'Order ID', 'Test Name', 'Test Result', 'Reference Range', 'Flag'
    ]);
    excelOrders.forEach(({ patient, order }) => {
        if (!order.tests) return;
        const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.trim();
        order.tests.forEach(test => {
            const testDetails = excelAllTests[test.test_id] || {};
            const refRange = testDetails.reference_range || test.reference_range || '';
            const result = test.result || '';
            let flag = '';
            let color = '';
            // Simple flag logic
            if (result && refRange && typeof result === 'number') {
                const [low, high] = parseRefRange(refRange);
                if (low !== null && high !== null) {
                    if (result < low) { flag = 'L'; color = 'blue'; }
                    else if (result > high) { flag = 'H'; color = 'red'; }
                    else { flag = 'N'; color = 'green'; }
                }
            }
            rows.push([
                patient.details?.patient_id || '',
                patientName,
                order.order_id,
                test.test_name || '',
                result,
                refRange,
                flag
            ]);
        });
    });
    // Export using XLSX
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Color rows by flag
    let rowIdx = 2;
    excelOrders.forEach(({ patient, order }) => {
        if (!order.tests) return;
        order.tests.forEach(test => {
            const result = test.result || '';
            const testDetails = excelAllTests[test.test_id] || {};
            const refRange = testDetails.reference_range || test.reference_range || '';
            let flag = '';
            let color = '';
            if (result && refRange && typeof result === 'number') {
                const [low, high] = parseRefRange(refRange);
                if (low !== null && high !== null) {
                    if (result < low) { flag = 'L'; color = '0000FF'; }
                    else if (result > high) { flag = 'H'; color = 'FF0000'; }
                    else { flag = 'N'; color = '00AA00'; }
                }
            }
            if (color) {
                for (let col = 0; col < 6; col++) {
                    const cell = XLSX.utils.encode_cell({ r: rowIdx - 1, c: col });
                    if (!ws[cell]) continue;
                    ws[cell].s = { fill: { fgColor: { rgb: color } } };
                }
            }
            rowIdx++;
        });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results.html');
    XLSX.writeFile(wb, 'Bulk_Orders_Results.xlsx');
}

function parseRefRange(refRange) {
    // Try to parse "4-10" or "4.5 - 10.2"
    const match = refRange.match(/(-?\d+(\.\d+)?)\s*-\s*(-?\d+(\.\d+)?)/);
    if (match) {
        return [parseFloat(match[1]), parseFloat(match[3])];
    }
    return [null, null];
}




