// Bulk Print Results Section

let bulkPrintOrders = [];
let bulkPrintSelectedOrders = [];

document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('bulkPrintSection')) {
        setupBulkPrintSection();
    }
});

function setupBulkPrintSection() {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bulkPrintDateFrom').value = '';
    document.getElementById('bulkPrintDateTo').value = '';

    // Load branches
    db.collection('branches').get().then(snapshot => {
        const select = document.getElementById('bulkPrintBranch');
        snapshot.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.id;
            select.appendChild(opt);
        });
    });

    // Select all checkbox
    document.getElementById('bulkPrintSelectAll').addEventListener('change', function () {
        const checked = this.checked;
        document.querySelectorAll('.bulk-print-order-checkbox').forEach(cb => cb.checked = checked);
        updateBulkPrintSelectedOrders();
    });

    // Search on Enter
    document.getElementById('bulkPrintSearch').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') loadBulkPrintOrders();
    });
}

async function loadBulkPrintOrders() {
    const dateFrom = document.getElementById('bulkPrintDateFrom').value;
    const dateTo = document.getElementById('bulkPrintDateTo').value;
    const status = document.getElementById('bulkPrintStatus').value;
    const branch = document.getElementById('bulkPrintBranch').value;
    const search = document.getElementById('bulkPrintSearch').value.trim().toLowerCase();

    // Convert to Date objects
    const startDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const endDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

    // Show loading
    const tableBody = document.getElementById('bulkPrintOrdersTable');
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2">Loading orders...</p>
    </td></tr>`;

    // Load orders from new_record
    const partsSnapshot = await db.collection('new_record').get();
    bulkPrintOrders = [];

    for (const doc of partsSnapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.patients)) {
            for (const patientObj of data.patients) {
                for (const key in patientObj) {
                    const patient = patientObj[key];
                    if (Array.isArray(patient.orders)) {
                        for (const order of patient.orders) {
                            // Filter by date
                            const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
                            if (startDate && orderDate < startDate) continue;
                            if (endDate && orderDate > endDate) continue;
                            // Filter by status
                            if (status && order.status !== status) continue;
                            // Filter by branch
                            if (branch && order.branch !== branch) continue;
                            // Filter by search
                            const patientName = `${patient.details?.firstName || ''} ${patient.details?.secondName || ''} ${patient.details?.thirdName || ''}`.toLowerCase();
                            const patientId = (patient.details?.patient_id || '').toLowerCase();
                            const orderId = (order.order_id || '').toLowerCase();
                            if (search && !(
                                patientName.includes(search) ||
                                patientId.includes(search) ||
                                orderId.includes(search)
                            )) continue;

                            bulkPrintOrders.push({
                                patient: patient.details,
                                order: order
                            });
                        }
                    }
                }
            }
        }
    }

    displayBulkPrintOrders();
}

function displayBulkPrintOrders() {
    const tableBody = document.getElementById('bulkPrintOrdersTable');
    if (bulkPrintOrders.length === 0) {
        tableBody.innerHTML = `<tr>
            <td colspan="7" class="text-center py-4 text-muted">
                <i class="fas fa-exclamation-circle fa-2x mb-3"></i><br>
                No orders found matching the filters
            </td>
        </tr>`;
        document.getElementById('bulkPrintFilteredOrdersCount').textContent = '0';
        document.getElementById('bulkPrintResultsBtn').disabled = true;
        return;
    }

    let html = '';
    bulkPrintOrders.forEach((item, idx) => {
        const patient = item.patient || {};
        const order = item.order || {};
        const patientName = `${patient.firstName || ''} ${patient.secondName || ''} ${patient.thirdName || ''}`.trim();
        const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
        const formattedDate = orderDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const tests = (order.tests || []).map(t => t.test_name || t.test_id).join(', ');

        html += `<tr>
            <td><input type="checkbox" class="bulk-print-order-checkbox" data-index="${idx}" onchange="updateBulkPrintSelectedOrders()"></td>
            <td><span class="badge bg-primary">${getOrderDigitalNumber(order.order_id)}</span></td>
            <td>${patientName}</td>
            <td>${patient.patient_id || ''}</td>
            <td><span class="badge bg-${getStatusClass(order.status)}">${order.status || ''}</span></td>
            <td>${formattedDate}</td>
            <td>${tests}</td>
        </tr>`;
    });

    tableBody.innerHTML = html;
    document.getElementById('bulkPrintFilteredOrdersCount').textContent = bulkPrintOrders.length;
    updateBulkPrintSelectedOrders();
}

function updateBulkPrintSelectedOrders() {
    bulkPrintSelectedOrders = [];
    document.querySelectorAll('.bulk-print-order-checkbox:checked').forEach(cb => {
        const idx = parseInt(cb.getAttribute('data-index'));
        if (!isNaN(idx)) bulkPrintSelectedOrders.push(idx);
    });
    document.getElementById('bulkPrintResultsBtn').disabled = bulkPrintSelectedOrders.length === 0;
}

function clearBulkPrintFilters() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bulkPrintDateFrom').value = '';
    document.getElementById('bulkPrintDateTo').value = '';
    document.getElementById('bulkPrintStatus').value = '';
    document.getElementById('bulkPrintBranch').value = '';
    document.getElementById('bulkPrintSearch').value = '';
    loadBulkPrintOrders();
}

function getOrderDigitalNumber(orderId) {
    const match = orderId ? orderId.match(/\d+$/) : null;
    return match ? match[0] : orderId || '';
}

function getStatusClass(status) {
    switch (status) {
        case 'registered': return 'warning text-dark';
        case 'Collected.html': return 'success';
        case 'completed': return 'info text-dark';
        case 'authenticated': return 'warning text-dark';
        case 'reported': return 'secondary';
        case 'sent': return 'primary';
        default: return 'light text-dark';
    }
}

function printBulkResults() {
    if (bulkPrintSelectedOrders.length === 0) {
        alert('No orders selected.');
        return;
    }
    // Gather patientIds and orderIds
    const patientIds = [];
    const orderIds = [];
    bulkPrintSelectedOrders.forEach(idx => {
        const item = bulkPrintOrders[idx];
        if (item && item.patient && item.order) {
            patientIds.push(item.patient.patient_id);
            orderIds.push(item.order.order_id);
        }
    });
    if (patientIds.length === 0 || orderIds.length === 0) {
        alert('No valid orders selected.');
        return;
    }
    // Build URL for print_result_all.html
    const url = `print_results/print_result_all.html?bulk=1&orderIds=${encodeURIComponent(orderIds.join(','))}&patientIds=${encodeURIComponent(patientIds.join(','))}`;
    window.open(url, '_blank');
}

// Export for HTML
window.loadBulkPrintOrders = loadBulkPrintOrders;
window.clearBulkPrintFilters = clearBulkPrintFilters;
window.updateBulkPrintSelectedOrders = updateBulkPrintSelectedOrders;
window.printBulkResults = printBulkResults;




