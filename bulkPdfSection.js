
let pdfOrders = [];
let pdfAllTests = {};

document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('bulkPdfSection')) {
        loadPdfDepartments();
        loadPdfBranches();
        window.clearPdfFilters = clearPdfFilters;
        window.loadPdfOrders = loadPdfOrders;
        window.exportPdfOrdersData = exportPdfOrdersData;
        window.exportPdfOrdersResults = exportPdfOrdersResults;
    }
});

async function loadPdfDepartments() {
    const select = document.getElementById('pdfDepartment');
    const testsDoc = await db.collection('tests_list').doc('Tests.html').get();
    if (testsDoc.exists) {
        pdfAllTests = testsDoc.data();
        const departments = new Set();
        Object.values(pdfAllTests).forEach(test => {
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

async function loadPdfBranches() {
    const select = document.getElementById('pdfBranch');
    const snapshot = await db.collection('branches').get();
    snapshot.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = doc.id;
        select.appendChild(opt);
    });
}

function clearPdfFilters() {
    document.getElementById('pdfDateFrom').value = '';
    document.getElementById('pdfDateTo').value = '';
    document.getElementById('pdfTimeFrom').value = '';
    document.getElementById('pdfTimeTo').value = '';
    document.getElementById('pdfDepartment').value = '';
    document.getElementById('pdfTestStatus').value = '';
    document.getElementById('pdfPatientType').value = '';
    document.getElementById('pdfBranch').value = '';
    document.getElementById('pdfTestStatus2').value = '';
    document.getElementById('pdfSearch').value = '';
    document.getElementById('pdfOrdersTable').innerHTML = `
        <tr>
            <td colspan="10" class="text-center py-4">
                <div class="text-muted">
                    <i class="fas fa-search fa-2x mb-3"></i><br>
                    Use the filters above to search for orders
                </div>
            </td>
        </tr>
    `;
    document.getElementById('pdfFilteredOrdersCount').textContent = '0';
    document.getElementById('bulkPdfDataBtn').disabled = true;
    document.getElementById('bulkPdfResultsBtn').disabled = true;
    pdfOrders = [];
}

async function loadPdfOrders() {
    // Get filter values
    const dateFrom = document.getElementById('pdfDateFrom').value;
    const dateTo = document.getElementById('pdfDateTo').value;
    const timeFrom = document.getElementById('pdfTimeFrom').value || '00:00';
    const timeTo = document.getElementById('pdfTimeTo').value || '23:59';
    const department = document.getElementById('pdfDepartment').value;
    const testStatus = document.getElementById('pdfTestStatus').value;
    const patientType = document.getElementById('pdfPatientType').value;
    const branch = document.getElementById('pdfBranch').value;
    const testStatus2 = document.getElementById('pdfTestStatus2').value;
    const search = document.getElementById('pdfSearch').value.trim().toLowerCase();

    let startDate = dateFrom ? new Date(`${dateFrom}T${timeFrom}`) : null;
    let endDate = dateTo ? new Date(`${dateTo}T${timeTo}`) : null;

    const partsSnapshot = await db.collection('new_record').get();
    pdfOrders = [];

    for (const doc of partsSnapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.patients)) {
            for (const patientObj of data.patients) {
                for (const key in patientObj) {
                    const patient = patientObj[key];
                    if (Array.isArray(patient.orders)) {
                        for (const order of patient.orders) {
                            let orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
                            if (startDate && orderDate < startDate) continue;
                            if (endDate && orderDate > endDate) continue;
                            if (patientType && order.patient_type !== patientType) continue;
                            if (branch && order.branch !== branch) continue;
                            if (department && order.tests && !order.tests.some(t => pdfAllTests[t.test_id]?.department === department)) continue;
                            if (testStatus && order.tests && !order.tests.some(t => t.status === testStatus)) continue;
                            if (testStatus2 && order.tests && !order.tests.some(t => t.status === testStatus2)) continue;
                            if (search) {
                                const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.toLowerCase();
                                const patientId = (patient.details?.patient_id || '').toLowerCase();
                                const mobile = (patient.details?.mobile || '').toLowerCase();
                                const orderId = (order.order_id || '').toLowerCase();
                                if (!patientName.includes(search) && !patientId.includes(search) && !mobile.includes(search) && !orderId.includes(search)) continue;
                            }
                            pdfOrders.push({ patient, order });
                        }
                    }
                }
            }
        }
    }

    renderPdfOrdersTable();
}

function renderPdfOrdersTable() {
    const tbody = document.getElementById('pdfOrdersTable');
    if (!tbody) return;
    if (pdfOrders.length === 0) {
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
        document.getElementById('pdfFilteredOrdersCount').textContent = '0';
        document.getElementById('bulkPdfDataBtn').disabled = true;
        document.getElementById('bulkPdfResultsBtn').disabled = true;
        return;
    }
    let html = '';
    pdfOrders.forEach(({ patient, order }) => {
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
    document.getElementById('pdfFilteredOrdersCount').textContent = pdfOrders.length;
    document.getElementById('bulkPdfDataBtn').disabled = false;
    document.getElementById('bulkPdfResultsBtn').disabled = false;
}

// Export PDF Data (Orders + Payments)
function exportPdfOrdersData() {
    if (pdfOrders.length === 0) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text('Bulk Orders Data', 10, 10);
    let y = 20;
    doc.autoTable({
        head: [[
            'Order ID', 'Patient Name', 'Patient ID', 'Status', 'Order Date', 'Tests Count',
            'Total Amount', 'Total Paid', 'Total Discount', 'Total Remaining'
        ]],
        body: pdfOrders.map(({ patient, order }) => {
            const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.trim();
            const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
            const totalAmount = Number(order.total_amount || 0);
            const totalPaid = Number(order.total_paid || 0);
            const totalDiscount = Number(order.total_discount || 0);
            const totalRemaining = totalAmount - totalPaid - totalDiscount;
            return [
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
            ];
        }),
        startY: y,
        styles: { fontSize: 9 }
    });
    doc.save('Bulk_Orders_Data.pdf');
}

// Export PDF Results (Test Results)
function exportPdfOrdersResults() {
    if (pdfOrders.length === 0) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text('Bulk Orders Results', 10, 10);
    let y = 20;
    let rows = [];
    pdfOrders.forEach(({ patient, order }) => {
        if (!order.tests) return;
        const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.trim();
        order.tests.forEach(test => {
            const testDetails = pdfAllTests[test.test_id] || {};
            const refRange = testDetails.reference_range || test.reference_range || '';
            const result = test.result || '';
            let flag = '';
            let color = [0, 0, 0];
            if (result && refRange && typeof result === 'number') {
                const [low, high] = parseRefRange(refRange);
                if (low !== null && high !== null) {
                    if (result < low) { flag = 'L'; color = [0, 0, 255]; }
                    else if (result > high) { flag = 'H'; color = [255, 0, 0]; }
                    else { flag = 'N'; color = [0, 170, 0]; }
                }
            }
            rows.push({
                data: [
                    patient.details?.patient_id || '',
                    patientName,
                    order.order_id,
                    test.test_name || '',
                    result,
                    refRange,
                    flag
                ],
                color
            });
        });
    });
    // Draw table with colored rows
    doc.autoTable({
        head: [['Patient ID', 'Patient Name', 'Order ID', 'Test Name', 'Test Result', 'Reference Range', 'Flag']],
        body: rows.map(r => r.data),
        startY: y,
        styles: { fontSize: 9 },
        didParseCell: function (data) {
            if (data.row.index >= 0 && rows[data.row.index].color) {
                data.cell.styles.textColor = rows[data.row.index].color;
            }
        }
    });
    doc.save('Bulk_Orders_Results.pdf');
}

function parseRefRange(refRange) {
    const match = refRange.match(/(-?\d+(\.\d+)?)\s*-\s*(-?\d+(\.\d+)?)/);
    if (match) {
        return [parseFloat(match[1]), parseFloat(match[3])];
    }
    return [null, null];
}




