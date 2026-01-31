// bulkBarcodeSection.js
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('bulkBarcodeSection')) {
        initializeBulkBarcodeSection();
    }
});

let bulkBarcodeOrders = [];
let bulkBarcodeSelectedOrders = [];
let bulkBarcodeIsGenerating = false;
let bulkBarcodeCancelled = false;
let bulkBarcodeStyles = null;
let bulkBarcodeSingleTests = [];
let bulkBarcodeDepartments = [];
let bulkBarcodeContracts = [];
let bulkBarcodeBranches = [];

async function initializeBulkBarcodeSection() {
    // Fix: assign global email from bulk_entry.html if available
    if (window.currentUserEmail) currentUserEmail = window.currentUserEmail;
    await loadBarcodeSettings();
    await loadDepartments();
    await loadContracts();
    await loadBranches();
    setupEventListeners();
}

async function loadBarcodeSettings() {
    try {
        // Load global barcode styles
        const stylesDoc = await db.collection('settings').doc('barcode_Settings').get();
        if (stylesDoc.exists) {
            bulkBarcodeStyles = stylesDoc.data();
            updateBarcodeStylesDisplay();
        }

        // Load single barcode tests
        const singleDoc = await db.collection('settings').doc('single_barcode_tests').get();
        if (singleDoc.exists) {
            bulkBarcodeSingleTests = singleDoc.data().testIds || [];
        }
        if (bulkBarcodeStyles && bulkBarcodeStyles.globalStyle) {
            const style = bulkBarcodeStyles.globalStyle;
            let css = `
        .barcode-label, .barcode-label * {
            font-family: ${style.fontFamily || 'Arial'} !important;
            font-size: ${style.fontSize || 6}pt !important;
            text-align: ${style.align || 'center'} !important;
            ${style.bold ? 'font-weight: bold !important;' : ''}
        }
    `;
            let el = document.getElementById('barcodeGlobalStyle');
            if (el) el.remove();
            el = document.createElement('style');
            el.id = 'barcodeGlobalStyle';
            el.innerHTML = css;
            document.head.appendChild(el);
        }
        // Show styles summary
        document.getElementById('bulkBarcodeStylesSummary').style.display = 'block';
    } catch (error) {
        console.error('Error loading barcode settings:', error);
    }
}

function updateBarcodeStylesDisplay() {
    if (!bulkBarcodeStyles || !bulkBarcodeStyles.globalStyle) return;

    const style = bulkBarcodeStyles.globalStyle;
    const info = `
        Font: ${style.fontFamily || 'Arial'}, Size: ${style.fontSize || 6}pt, 
        Tests per barcode: ${style.testsPerBarcode || 5}, 
        Group by dept: ${style.groupByDept ? 'Yes' : 'No'}
    `;
    document.getElementById('bulkStylesInfo').textContent = info;
}

async function loadDepartments() {
    try {
        const testsDoc = await db.collection('tests_list').doc('Tests.html').get();
        if (testsDoc.exists) {
            const tests = testsDoc.data();
            const departments = new Set();

            Object.values(tests).forEach(test => {
                if (test.department) departments.add(test.department);
            });

            bulkBarcodeDepartments = Array.from(departments).sort();
            const select = document.getElementById('bulkBarcodeDepartment');
            bulkBarcodeDepartments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

async function loadContracts() {
    try {
        const snapshot = await db.collection('contracts').get();
        bulkBarcodeContracts = [];
        snapshot.forEach(doc => {
            bulkBarcodeContracts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        const select = document.getElementById('bulkBarcodePatientType');
        bulkBarcodeContracts.forEach(contract => {
            const option = document.createElement('option');
            option.value = contract.id;
            option.textContent = `Contract: ${contract.contract_name}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading contracts:', error);
    }
}

async function loadBranches() {
    try {
        const snapshot = await db.collection('branches').get();
        bulkBarcodeBranches = [];
        snapshot.forEach(doc => {
            bulkBarcodeBranches.push(doc.id);
        });

        const select = document.getElementById('bulkBarcodeBranch');
        bulkBarcodeBranches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch;
            option.textContent = branch;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

function setupEventListeners() {
    // Select all orders checkbox
    document.getElementById('selectAllBulkOrders').addEventListener('change', function (e) {
        const checkboxes = document.querySelectorAll('.bulk-order-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateSelectedOrders();
    });

    // Auto-refresh when filter changes
    ['bulkBarcodeDateFrom', 'bulkBarcodeDateTo', 'bulkBarcodeTimeFrom', 'bulkBarcodeTimeTo',
        'bulkBarcodeDepartment', 'bulkBarcodeStatus', 'bulkBarcodePatientType',
        'bulkBarcodeBranch', 'bulkBarcodeTestStatus'].forEach(id => {
            document.getElementById(id).addEventListener('change', function () {
                // Optional: auto-refresh after delay
                // clearTimeout(window.filterTimeout);
                // window.filterTimeout = setTimeout(loadBulkBarcodeOrders, 500);
            });
        });
}

async function loadBulkBarcodeOrders() {
    try {
        showLoading('bulkBarcodeOrdersTable', 'Searching for orders...');

        const dateFrom = document.getElementById('bulkBarcodeDateFrom')?.value || '';
        const dateTo = document.getElementById('bulkBarcodeDateTo')?.value || '';
        const timeFrom = document.getElementById('bulkBarcodeTimeFrom')?.value || '';
        const timeTo = document.getElementById('bulkBarcodeTimeTo')?.value || '';
        const department = document.getElementById('bulkBarcodeDepartment')?.value || '';
        const status = document.getElementById('bulkBarcodeStatus')?.value || '';
        const patientType = document.getElementById('bulkBarcodePatientType')?.value || '';
        const branch = document.getElementById('bulkBarcodeBranch')?.value || '';
        const testStatus = document.getElementById('bulkBarcodeTestStatus')?.value || '';
        const search = document.getElementById('bulkBarcodeSearch')?.value.trim() || '';

        // Convert dates to timestamps
        const startDate = new Date(`${dateFrom}T${timeFrom}`);
        const endDate = new Date(`${dateTo}T${timeTo}`);

        // Get all new_record documents
        const partsSnapshot = await db.collection('new_record').get();
        bulkBarcodeOrders = [];

        // Load all tests for department filtering
        const testsDoc = await db.collection('tests_list').doc('Tests.html').get();
        const allTests = testsDoc.exists ? testsDoc.data() : {};

        for (const doc of partsSnapshot.docs) {
            const data = doc.data();
            if (Array.isArray(data.patients)) {
                for (const patientObj of data.patients) {
                    for (const key in patientObj) {
                        const patient = patientObj[key];
                        if (Array.isArray(patient.orders)) {
                            for (const order of patient.orders) {
                                // Apply filters
                                if (!passesFilters(order, patient, startDate, endDate,
                                    department, status, patientType, branch, testStatus, search, allTests)) {
                                    continue;
                                }

                                // Calculate order statistics
                                const stats = calculateOrderStats(order, allTests);

                                bulkBarcodeOrders.push({
                                    patient: patient.details,
                                    order: order,
                                    stats: stats,
                                    partId: doc.id,
                                    patientKey: key
                                });
                            }
                        }
                    }
                }
            }
        }

        displayBulkBarcodeOrders();
        updateOrdersSummary();

    } catch (error) {
        console.error('Error loading bulk barcode orders:', error);
        showError('bulkBarcodeOrdersTable', 'Error loading orders. Please try again.');
    }
}

function passesFilters(order, patient, startDate, endDate, department, status,
    patientType, branch, testStatus, search, allTests) {
    // Date filter
    const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
    if (orderDate < startDate || orderDate > endDate) return false;

    // Status filter
    if (status && order.status !== status) return false;

    // Patient type filter
    if (patientType) {
        if (patientType === 'normal' && order.patient_type !== 'normal') return false;
        if (patientType === 'packages' && order.patient_type !== 'packages') return false;
        if (patientType !== 'normal' && patientType !== 'packages' && order.patient_type !== patientType) return false;
    }

    // Branch filter
    if (branch && order.branch !== branch) return false;

    // Department filter
    if (department && order.tests) {
        const hasDeptTest = order.tests.some(test => {
            const testDetails = allTests[test.test_id];
            return testDetails && testDetails.department === department;
        });
        if (!hasDeptTest) return false;
    }

    // Test status filter
    if (testStatus && order.tests) {
        if (testStatus === 'registered' && !order.tests.some(t => t.status === 'registered')) return false;
        if (testStatus === 'Collected.html' && !order.tests.some(t => t.status === 'Collected.html')) return false;
        if (testStatus === 'not_collected' && !order.tests.some(t => t.status !== 'Collected.html' && t.status !== 'completed')) return false;
    }

    // Search filter
    if (search) {
        const searchLower = search.toLowerCase();
        const patientName = `${patient.details.firstName || ''} ${patient.details.secondName || ''} ${patient.details.thirdName || ''}`.toLowerCase();
        const patientId = patient.details.patient_id?.toLowerCase() || '';
        const mobile = patient.details.mobile?.toLowerCase() || '';

        if (!patientName.includes(searchLower) &&
            !patientId.includes(searchLower) &&
            !mobile.includes(searchLower) &&
            !order.order_id?.toLowerCase().includes(searchLower)) {
            return false;
        }
    }

    return true;
}

function calculateOrderStats(order, allTests) {
    const stats = {
        totalTests: order.tests?.length || 0,
        registeredTests: 0,
        collectedTests: 0,
        completedTests: 0,
        departments: new Set(),
        estimatedBarcodes: 0
    };

    if (order.tests) {
        order.tests.forEach(test => {
            // Count by status

            if (test.status === 'registered') stats.registeredTests++;
            if (test.status === 'Collected.html') stats.collectedTests++;
            if (test.status === 'completed') stats.completedTests++;

            // Get department
            const testDetails = allTests[test.test_id];
            if (testDetails && testDetails.department) {
                stats.departments.add(testDetails.department);
            }

            // Check if single barcode test
            if (bulkBarcodeSingleTests.includes(test.test_id)) {
                stats.estimatedBarcodes++;
            }
        });

        // Estimate grouped barcodes
        const groupedTests = stats.totalTests - stats.estimatedBarcodes;
        const testsPerBarcode = bulkBarcodeStyles?.globalStyle?.testsPerBarcode || 5;
        stats.estimatedBarcodes += Math.ceil(groupedTests / testsPerBarcode);
    }

    stats.departments = Array.from(stats.departments);
    return stats;
}

function displayBulkBarcodeOrders() {
    const tableBody = document.getElementById('bulkBarcodeOrdersTable');
    if (!tableBody) return;

    if (bulkBarcodeOrders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="text-muted">
                        <i class="fas fa-exclamation-circle fa-2x mb-3"></i><br>
                        No orders found matching the filters
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('bulkFilteredOrdersCount').textContent = '0';
        updateActionButtons();
        return;
    }

    let html = '';
    bulkBarcodeOrders.forEach((item, index) => {
        const patient = item.patient;
        const order = item.order;
        const stats = item.stats;

        const patientName = `${patient.title || ''} ${patient.firstName || ''} ${patient.secondName || ''} ${patient.thirdName || ''}`.trim();
        const orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
        const formattedDate = orderDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Calculate tests status summary
        const testsSummary = `
            <span class="badge bg-secondary" title="Total">${stats.totalTests}</span>
            <span class="badge bg-warning text-dark" title="Registered">${stats.registeredTests}</span>
            <span class="badge bg-success" title="Collected.html">${stats.collectedTests}</span>
            <span class="badge bg-info text-dark" title="Completed">${stats.completedTests}</span>
        `;

        html += `
            <tr data-order-index="${index}">
                <td>
                    <input type="checkbox" class="bulk-order-checkbox" 
                           data-index="${index}" onchange="updateSelectedOrders()">
                </td>
                <td>
                    <span class="badge bg-primary">${getOrderDigitalNumber(order.order_id)}</span>
                </td>
                <td>
                    <div class="fw-bold">${patientName}</div>
                    <small class="text-muted">${patient.gender || ''}, ${patient.age_years || 0}y</small>
                </td>
                <td>${patient.patient_id}</td>
                <td>
                    <span class="badge bg-${getStatusClass(order.status)}">
                        ${order.status || 'registered'}
                    </span>
                </td>
                <td>${stats.totalTests}</td>
                <td>${formattedDate}</td>
                <td>${testsSummary}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" 
                            onclick="previewOrderBarcodes(${index})" title="Preview Barcodes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info me-1" 
                            onclick="viewOrderDetails(${index})" title="View Details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="recollectSingleOrder(${index})" title="Recollect">
                        <i class="fas fa-redo"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
    document.getElementById('bulkFilteredOrdersCount').textContent = bulkBarcodeOrders.length;
    updateActionButtons();
}

function updateSelectedOrders() {
    bulkBarcodeSelectedOrders = [];
    document.querySelectorAll('.bulk-order-checkbox:checked').forEach(cb => {
        const index = parseInt(cb.getAttribute('data-index'));
        if (!isNaN(index)) {
            bulkBarcodeSelectedOrders.push(index);
        }
    });

    updateActionButtons();
}

function updateActionButtons() {
    const hasSelected = bulkBarcodeSelectedOrders.length > 0;
    const hasOrders = bulkBarcodeOrders.length > 0;

    document.getElementById('bulkGenerateBarcodesBtn').disabled = !hasOrders;
    document.getElementById('bulkRecollectAllBtn').disabled = !hasSelected;
    document.getElementById('bulkMarkCollectedBtn').disabled = !hasSelected;
}

function updateOrdersSummary() {
    const totalOrders = bulkBarcodeOrders.length;
    let totalTests = 0;
    let toCollect = 0;
    let estimatedPages = 0;

    bulkBarcodeOrders.forEach(item => {
        totalTests += item.stats.totalTests;
        toCollect += item.stats.registeredTests;
        estimatedPages += item.stats.estimatedBarcodes;
    });

    // Assuming 20 barcodes per page
    estimatedPages = Math.ceil(estimatedPages / 20);

    document.getElementById('bulkTotalOrdersCount').textContent = totalOrders;
    document.getElementById('bulkTotalTestsCount').textContent = totalTests;
    document.getElementById('bulkToCollectCount').textContent = toCollect;
    document.getElementById('bulkEstimatedPages').textContent = estimatedPages;
}

async function startBulkBarcodeGeneration() {
    if (bulkBarcodeIsGenerating) return;

    // Use all orders if none selected
    const ordersToProcess = bulkBarcodeSelectedOrders.length > 0 ?
        bulkBarcodeSelectedOrders : Array.from({ length: bulkBarcodeOrders.length }, (_, i) => i);

    if (ordersToProcess.length === 0) {
        alert('No orders to process.');
        return;
    }

    bulkBarcodeIsGenerating = true;
    bulkBarcodeCancelled = false;

    // Show progress section
    document.getElementById('bulkBarcodeProgressSection').style.display = 'block';
    document.getElementById('bulkBarcodePrintContainer').innerHTML = '';

    let successCount = 0;
    let failedCount = 0;

    // Initialize progress
    updateBulkProgress(0, ordersToProcess.length, successCount, failedCount);

    for (let i = 0; i < ordersToProcess.length; i++) {
        if (bulkBarcodeCancelled) break;

        const orderIndex = ordersToProcess[i];
        const item = bulkBarcodeOrders[orderIndex];

        try {
            // Update progress display
            document.getElementById('bulkCurrentOrderId').textContent = getOrderDigitalNumber(item.order.order_id);
            document.getElementById('bulkCurrentPatientName').textContent =
                `${item.patient.firstName} ${item.patient.secondName}`;
            document.getElementById('bulkCurrentStatus').textContent = 'Generating...';
            document.getElementById('bulkCurrentStatus').className = 'status-processing';

            // Generate barcodes for this order
            await generateOrderBarcodes(item);

            successCount++;
            logBulkProgress(`Order ${i + 1}: Generated barcodes for ${item.order.order_id}`, 'success');

        } catch (error) {
            failedCount++;
            logBulkProgress(`Order ${i + 1}: Error - ${error.message}`, 'error');
            console.error(`Error generating barcodes for order ${item.order.order_id}:`, error);
        }

        // Update progress
        updateBulkProgress(i + 1, ordersToProcess.length, successCount, failedCount);

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Final update
    bulkBarcodeIsGenerating = false;
    document.getElementById('bulkCurrentStatus').textContent = bulkBarcodeCancelled ? 'Cancelled' : 'Completed';
    document.getElementById('bulkCurrentStatus').className = bulkBarcodeCancelled ? 'status-error' : 'status-success';

    // Show print button and print container if we have barcodes
    const printContainer = document.getElementById('bulkBarcodePrintContainer');
    if (printContainer.children.length > 0 && !bulkBarcodeCancelled) {
        document.getElementById('bulkBarcodePrintBtnRow').style.display = 'block'; // Show new print row
        printContainer.style.display = 'block';
        showToast('success', `Generated ${printContainer.children.length} barcodes! Ready to print.`);
    } else if (bulkBarcodeCancelled) {
        showToast('warning', 'Barcode generation was cancelled.');
    }
}
// Add this helper function (place it near updateOrderStatusInNewRecord)
async function updateOrderCollectedAtInNewRecord(patientId, orderId, collectedAt) {
    const partsSnapshot = await db.collection('new_record').get();
    for (const doc of partsSnapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.patients)) {
            for (let pIndex = 0; pIndex < data.patients.length; pIndex++) {
                const patientObj = data.patients[pIndex];
                for (const key in patientObj) {
                    const patient = patientObj[key];
                    if (patient.details && patient.details.patient_id === patientId) {
                        if (Array.isArray(patient.orders)) {
                            for (let oIndex = 0; oIndex < patient.orders.length; oIndex++) {
                                if (patient.orders[oIndex].order_id === orderId) {
                                    patient.orders[oIndex].collected_at = collectedAt;
                                    await db.collection('new_record').doc(doc.id).set({
                                        patients: data.patients
                                    }, { merge: true });
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    throw new Error('Patient/order not found in new_record');
}
async function generateOrderBarcodes(item) {
    const { patient, order } = item;

    if (!order.tests || order.tests.length === 0) {
        throw new Error('No tests in order');
    }

    // Create a container for this order's barcodes (one page per order)
    const printContainer = document.getElementById('bulkBarcodePrintContainer');
    const orderPage = document.createElement('div');
    orderPage.className = 'barcode-order-page';
    orderPage.style.pageBreakAfter = 'always';

    // Separate single and grouped tests
    const singleTests = [];
    const groupedTests = {};

    order.tests.forEach(test => {
        if (test.status === 'completed' && test.sample_id) {
            // Already completed, use existing sample_id
            singleTests.push({ test, sampleId: test.sample_id });
        } else if (bulkBarcodeSingleTests.includes(test.test_id)) {
            singleTests.push({ test });
        } else {
            // Group by sample type and department
            const testDetails = getTestDetails(test.test_id);
            const sampleType = test.sample_type || 'Unknown';
            const department = testDetails?.department || 'General';

            const groupKey = bulkBarcodeStyles?.globalStyle?.groupByDept ?
                `${sampleType}_${department}` : sampleType;

            if (!groupedTests[groupKey]) groupedTests[groupKey] = [];
            groupedTests[groupKey].push({ test, testDetails });
        }
    });

    // Generate barcodes for single tests
    for (const { test, sampleId } of singleTests) {
        // Always use branchCode from the order object
        const branchCode = order.branchCode || 'BR';
        let finalSampleId = sampleId;

        if (!sampleId && (test.status === 'registered' || test.status === 'recollected')) {
            // Generate new sample_id using order.branchCode
            finalSampleId = await getNextSampleId(branchCode);
            test.sample_id = finalSampleId;
            test.status = 'Collected.html';
            test.collectedTimestamp = new Date();

            // Add barcoding history
            if (!test.barcoding) test.barcoding = [];
            test.barcoding.push({
                action: 'collect',
                timestamp: new Date().toISOString(),
                user: currentUserEmail || window.currentUserEmail
            });

            // Update sample/test counters using order.branchCode
            await updateSampleTypeCounter(test.sample_type || 'Unknown', order.branchCode || 'BR');
            await updateTestSampleCounter(test.test_id, test.test_name);

            // Save updated test to Firestore
            const testIndex = order.tests.findIndex(t => t.test_id === test.test_id);
            if (testIndex !== -1) {
                order.tests[testIndex] = test;
                await updateOrderTestsInNewRecord(patient.patient_id, order.order_id, order.tests);
            }
        }

        // Create barcode label and append to orderPage
        const label = await createBarcodeLabelForPage(patient, order, test, finalSampleId);
        orderPage.appendChild(label);
    }

    // Generate grouped barcodes
    for (const [groupKey, tests] of Object.entries(groupedTests)) {
        if (tests.length === 0) continue;

        // Split into chunks based on tests per barcode
        const testsPerBarcode = bulkBarcodeStyles?.globalStyle?.testsPerBarcode || 5;
        for (let i = 0; i < tests.length; i += testsPerBarcode) {
            const chunk = tests.slice(i, i + testsPerBarcode);

            // Find or generate sampleId for this chunk
            let sampleId = null;
            // If any test in chunk already has a sample_id and is collected/completed, use it
            const existingSample = chunk.find(({ test }) =>
                (test.status === 'Collected.html' || test.status === 'completed') && test.sample_id
            );
            if (existingSample) {
                sampleId = existingSample.test.sample_id;
            } else {
                sampleId = await getNextSampleId(order.branchCode || 'BR');
            }

            // Update each test in the chunk
            for (const { test } of chunk) {
                if (!test.sample_id) test.sample_id = sampleId;
                if (test.status === 'registered' || test.status === 'recollected') {
                    test.status = 'Collected.html';
                    test.collectedTimestamp = new Date();
                    if (!test.barcoding) test.barcoding = [];
                    test.barcoding.push({
                        action: 'collect',
                        timestamp: new Date().toISOString(),
                        user: currentUserEmail || window.currentUserEmail
                    });
                    await updateSampleTypeCounter(test.sample_type || 'Unknown', order.branchCode || 'BR');
                    await updateTestSampleCounter(test.test_id, test.test_name);
                }
            }

            // Save updated tests to Firestore
            await updateOrderTestsInNewRecord(patient.patient_id, order.order_id, order.tests);

            // Create grouped barcode label and append to orderPage
            const label = await createGroupedBarcodeLabelForPage(patient, order, chunk, sampleId, groupKey);
            orderPage.appendChild(label);
        }
    }

    // Append the orderPage to the main print container
    printContainer.appendChild(orderPage);

    try {
        // If any test is collected and order is not yet collected, update order status
        const anyCollected = order.tests && order.tests.some(t => t.status === 'Collected.html');
        if (anyCollected && order.status !== 'Collected.html') {
            await updateOrderStatusInNewRecord(patient.patient_id, order.order_id, 'Collected.html');
            await updateOrderCollectedAtInNewRecord(patient.patient_id, order.order_id, new Date());
            order.status = 'Collected.html'; // Update local status for UI consistency
        }
    } catch (err) {
        console.error('Error updating order status after barcode generation:', err);
    }
}

// Helper for single barcode label (returns DOM element)
async function createBarcodeLabelForPage(patient, order, test, sampleId) {
    const testDetails = getTestDetails(test.test_id);
    const testAbbr = testDetails?.abbreviation || (test.test_name ? test.test_name.substring(0, 3).toUpperCase() : '');
    const sampleType = test.sample_type || 'Unknown';

    const ageText = patient.age_years ? `${patient.age_years}y` :
        patient.age_months ? `${patient.age_months}m` :
            patient.age_days ? `${patient.age_days}d` : 'N/A';

    const label = document.createElement('div');
    label.className = 'barcode-label';

    label.innerHTML = `
        <div class="patient-info text-center">
            ${patient.patient_id} - ${patient.firstName || ''} ${patient.secondName || ''} ${patient.thirdName || ''}
        </div>
        <div class="test-abbr text-center">${testAbbr}</div>
        <div class="barcode-container text-center">
            <svg class="barcode-svg jsbarcode-bulk-print"
                data-value="${sampleId}"
                data-format="CODE128"
                data-width="3"
                data-height="30"
                data-displayValue="false">
            </svg>
        </div>
        <div class="order-info justify-content-center text-center">
            ${getOrderDigitalNumber(order.order_id)} - ${sampleId} - ${sampleType} - ${ageText}
        </div>
    `;

    // Initialize barcode
    setTimeout(() => {
        JsBarcode(label.querySelector('.jsbarcode-bulk-print')).init();
    }, 0);

    return label;
}

// Helper for grouped barcode label (returns DOM element)
async function createGroupedBarcodeLabelForPage(patient, order, tests, sampleId, groupKey) {
    const abbrs = tests.map(({ test, testDetails }) =>
        testDetails?.abbreviation || (test.test_name ? test.test_name.substring(0, 3).toUpperCase() : '')
    ).join(', ');

    const sampleType = tests[0]?.test?.sample_type || 'Unknown';
    const ageText = patient.age_years ? `${patient.age_years}y` :
        patient.age_months ? `${patient.age_months}m` :
            patient.age_days ? `${patient.age_days}d` : 'N/A';

    const label = document.createElement('div');
    label.className = 'barcode-label';

    // Check if groupKey contains department info
    let departmentInfo = '';
    if (bulkBarcodeStyles?.globalStyle?.groupByDept && groupKey.includes('_')) {
        const parts = groupKey.split('_');
        departmentInfo = `<div class="department-info text-center">Dept: ${parts.slice(1).join('_')}</div>`;
    }

    label.innerHTML = `
        <div class="patient-info text-center">
            ${patient.patient_id} - ${patient.firstName || ''} ${patient.secondName || ''} ${patient.thirdName || ''}
        </div>
        ${departmentInfo}
        <div class="test-abbr text-center">${wrapAbbreviations(abbrs)}</div>
        <div class="barcode-container text-center">
            <svg class="barcode-svg jsbarcode-bulk-print"
                data-value="${sampleId}"
                data-format="CODE128"
                data-width="3"
                data-height="30"
                data-displayValue="false">
            </svg>
        </div>
        <div class="order-info justify-content-center text-center">
            ${getOrderDigitalNumber(order.order_id)} - ${sampleId} - ${sampleType} - ${ageText}
        </div>
    `;

    // Initialize barcode
    setTimeout(() => {
        JsBarcode(label.querySelector('.jsbarcode-bulk-print')).init();
    }, 0);

    return label;
}

async function updateTestStatus(item, testId, status, sampleId) {
    const { partId, patientKey, order } = item;

    try {
        // Get the document
        const docRef = db.collection('new_record').doc(partId);
        const doc = await docRef.get();
        if (!doc.exists) return;

        const data = doc.data();
        let updated = false;

        // Find and update the test
        if (Array.isArray(data.patients)) {
            for (let pIdx = 0; pIdx < data.patients.length; pIdx++) {
                const patientObj = data.patients[pIdx];
                if (patientObj[patientKey]) {
                    const patient = patientObj[patientKey];
                    if (Array.isArray(patient.orders)) {
                        for (let oIdx = 0; oIdx < patient.orders.length; oIdx++) {
                            if (patient.orders[oIdx].order_id === order.order_id) {
                                const tests = patient.orders[oIdx].tests || [];
                                const testIndex = tests.findIndex(t => t.test_id === testId);

                                if (testIndex !== -1) {
                                    tests[testIndex].status = status;
                                    if (sampleId) tests[testIndex].sample_id = sampleId;
                                    tests[testIndex].collectedTimestamp = new Date();

                                    // Add to barcoding history
                                    if (!tests[testIndex].barcoding) tests[testIndex].barcoding = [];
                                    tests[testIndex].barcoding.push({
                                        action: 'collect',
                                        timestamp: new Date().toISOString(),
                                        user: currentUserEmail || window.currentUserEmail

                                    });

                                    // Update sample counters
                                    updateSampleTypeCounter(tests[testIndex].sample_type || 'Unknown', order.branch);
                                    updateTestSampleCounter(testId, tests[testIndex].test_name);

                                    updated = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (updated) break;
                }
            }
        }

        // Save changes if updated
        if (updated) {

            const cleanedData = removeUndefinedFields(data);
            await docRef.set(cleanedData, { merge: true });


            // Update order status to collected if not already
            if (status === 'Collected.html' && order.status !== 'Collected.html') {
                await updateOrderStatusInNewRecord(
                    order.patient_id || (order.patient_id === undefined && order.patientId) || (order.patient_id === undefined && item.patient?.patient_id),
                    order.order_id,
                    'Collected.html'
                );
            }
        }

    } catch (error) {
        console.error('Error updating test status:', error);
        throw error;
    }
}

async function updateOrderStatusInNewRecord(patientId, orderId, newStatus) {
    const partsSnapshot = await db.collection('new_record').get();
    for (const doc of partsSnapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.patients)) {
            for (let pIndex = 0; pIndex < data.patients.length; pIndex++) {
                const patientObj = data.patients[pIndex];
                for (const key in patientObj) {
                    const patient = patientObj[key];
                    if (patient.details && patient.details.patient_id === patientId) {
                        if (Array.isArray(patient.orders)) {
                            for (let oIndex = 0; oIndex < patient.orders.length; oIndex++) {
                                if (patient.orders[oIndex].order_id === orderId) {
                                    patient.orders[oIndex].status = newStatus;
                                    await db.collection('new_record').doc(doc.id).set({
                                        patients: data.patients
                                    }, { merge: true });
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    throw new Error('Patient/order not found in new_record');
}

// Add this helper function somewhere in your file
function removeUndefinedFields(obj) {
    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedFields);
    } else if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const key in obj) {
            if (obj[key] !== undefined) {
                cleaned[key] = removeUndefinedFields(obj[key]);
            }
        }
        return cleaned;
    }
    return obj;
}
async function createBarcodeLabel(patient, order, test, sampleId) {
    const testDetails = getTestDetails(test.test_id);
    const testAbbr = testDetails?.abbreviation || (test.test_name ? test.test_name.substring(0, 3).toUpperCase() : '');
    const sampleType = test.sample_type || 'Unknown';

    const ageText = patient.age_years ? `${patient.age_years}y` :
        patient.age_months ? `${patient.age_months}m` :
            patient.age_days ? `${patient.age_days}d` : 'N/A';

    const printContainer = document.getElementById('bulkBarcodePrintContainer');

    const label = document.createElement('div');
    label.className = 'barcode-label';

    // Apply styles from barcode.html
    label.innerHTML = `
        <div class="patient-info text-center">
            ${patient.patient_id} - ${patient.firstName || ''} ${patient.secondName || ''} ${patient.thirdName || ''}
        </div>
        <div class="test-abbr text-center">${testAbbr}</div>
        <div class="barcode-container text-center">
            <svg class="barcode-svg jsbarcode-bulk-print"
                data-value="${sampleId}"
                data-format="CODE128"
                data-width="3"
                data-height="30"
                data-displayValue="false">
            </svg>
        </div>
        <div class="order-info justify-content-center text-center">
            ${getOrderDigitalNumber(order.order_id)} - ${sampleId} - ${sampleType} - ${ageText}
        </div>
    `;

    printContainer.appendChild(label);

    // Initialize barcode
    JsBarcode(".jsbarcode-bulk-print").init();
}

async function createGroupedBarcodeLabel(patient, order, tests, sampleId, groupKey) {
    const abbrs = tests.map(({ test, testDetails }) =>
        testDetails?.abbreviation || (test.test_name ? test.test_name.substring(0, 3).toUpperCase() : '')
    ).join(', ');

    const sampleType = tests[0]?.test?.sample_type || 'Unknown';
    const ageText = patient.age_years ? `${patient.age_years}y` :
        patient.age_months ? `${patient.age_months}m` :
            patient.age_days ? `${patient.age_days}d` : 'N/A';

    const printContainer = document.getElementById('bulkBarcodePrintContainer');
    const label = document.createElement('div');
    label.className = 'barcode-label';

    // Check if groupKey contains department info
    let departmentInfo = '';
    if (bulkBarcodeStyles?.globalStyle?.groupByDept && groupKey.includes('_')) {
        const parts = groupKey.split('_');
        departmentInfo = `<div class="department-info text-center">Dept: ${parts.slice(1).join('_')}</div>`;
    }

    label.innerHTML = `
        <div class="patient-info text-center">
            ${patient.patient_id} - ${patient.firstName || ''} ${patient.secondName || ''} ${patient.thirdName || ''}
        </div>
        ${departmentInfo}
        <div class="test-abbr text-center">${wrapAbbreviations(abbrs)}</div>
        <div class="barcode-container text-center">
            <svg class="barcode-svg jsbarcode-bulk-print"
                data-value="${sampleId}"
                data-format="CODE128"
                data-width="3"
                data-height="30"
                data-displayValue="false">
            </svg>
        </div>
        <div class="order-info justify-content-center text-center">
            ${getOrderDigitalNumber(order.order_id)} - ${sampleId} - ${sampleType} - ${ageText}
        </div>
    `;

    printContainer.appendChild(label);

    // Initialize barcode
    JsBarcode(".jsbarcode-bulk-print").init();
}

function getTestDetails(testId) {
    // This should be loaded from tests_list
    // For now, return a stub
    return {
        abbreviation: testId.substring(0, 3).toUpperCase(),
        department: 'General'
    };
}

function updateBulkProgress(current, total, success, failed) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    document.getElementById('bulkProgressCounter').textContent = `${current}/${total}`;
    document.getElementById('bulkProgressBar').style.width = `${percentage}%`;
    document.getElementById('bulkSuccessCount').textContent = success;
    document.getElementById('bulkFailedCount').textContent = failed;
    document.getElementById('bulkRemainingCount').textContent = total - current;
}

function logBulkProgress(message, type = 'info') {
    const logContainer = document.getElementById('bulkProgressLog');
    const timestamp = new Date().toLocaleTimeString();
    const colorClass = type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-info';

    const logEntry = document.createElement('div');
    logEntry.className = `small ${colorClass}`;
    logEntry.innerHTML = `[${timestamp}] ${message}`;

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function cancelBulkBarcodeGeneration() {
    bulkBarcodeCancelled = true;
    logBulkProgress('Barcode generation cancelled by user', 'warning');
}

function printAllBulkBarcodes() {
    const printContainer = document.getElementById('bulkBarcodePrintContainer');
    if (printContainer.children.length === 0) {
        alert('No barcodes to print.');
        return;
    }

    // Hide everything except the print container
    const elementsToHide = document.querySelectorAll('body > *:not(#bulkBarcodePrintContainer)');
    elementsToHide.forEach(el => el.style.display = 'none');
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    // Show print container
    printContainer.style.display = 'block';

    // Print
    window.print();

    // Restore display
    setTimeout(() => {
        elementsToHide.forEach(el => el.style.display = '');
        printContainer.style.display = 'none';
    }, 1000);
}

async function showBulkRecollectModal() {
    if (bulkBarcodeSelectedOrders.length === 0) {
        alert('Please select orders to recollect.');
        return;
    }

    // Store selected orders in global variable for the modal
    window.bulkRecollectOrders = bulkBarcodeSelectedOrders.map(idx => bulkBarcodeOrders[idx]);

    // Open the recollect reason modal (you'll need to adapt your existing modal)
    // For now, show a confirmation
    if (confirm(`Recollect ${bulkBarcodeSelectedOrders.length} selected orders?`)) {
        await bulkRecollectOrdersWithReason('Bulk recollect from bulk barcode system');
    }
}

async function bulkRecollectOrdersWithReason(reason) {
    const progressDiv = document.getElementById('recollectProgress');
    progressDiv.style.display = '';
    progressDiv.textContent = `Recollecting: 0 / ${bulkBarcodeSelectedOrders.length}`;

    try {
        for (let i = 0; i < bulkBarcodeSelectedOrders.length; i++) {
            const idx = bulkBarcodeSelectedOrders[i];
            const item = bulkBarcodeOrders[idx];

            await recollectOrder(item, reason);

            progressDiv.textContent = `Recollecting: ${i + 1} / ${bulkBarcodeSelectedOrders.length}`;
        }

        showToast('success', `Recollected ${bulkBarcodeSelectedOrders.length} orders successfully.`);

        // Refresh the orders list
        await loadBulkBarcodeOrders();

    } catch (error) {
        console.error('Error in bulk recollect:', error);
        showToast('error', 'Error recollecting some orders.');
    } finally {
        progressDiv.style.display = 'none';
        bulkBarcodeSelectedOrders = [];
        updateSelectedOrders();
    }
}

async function recollectOrder(item, reason) {
    const { partId, patientKey, order } = item;

    try {
        const docRef = db.collection('new_record').doc(partId);
        const doc = await docRef.get();
        if (!doc.exists) return;

        const data = doc.data();
        let updated = false;

        if (Array.isArray(data.patients)) {
            for (let pIdx = 0; pIdx < data.patients.length; pIdx++) {
                const patientObj = data.patients[pIdx];
                if (patientObj[patientKey]) {
                    const patient = patientObj[patientKey];
                    if (Array.isArray(patient.orders)) {
                        for (let oIdx = 0; oIdx < patient.orders.length; oIdx++) {
                            if (patient.orders[oIdx].order_id === order.order_id) {
                                // Update order status
                                patient.orders[oIdx].status = 'recollected';

                                // Update all tests
                                const tests = patient.orders[oIdx].tests || [];
                                tests.forEach(test => {
                                    test.status = 'recollected';
                                    test.recollectedTimestamp = new Date();

                                    if (!test.barcoding) test.barcoding = [];
                                    test.barcoding.push({
                                        action: 'recollect',
                                        timestamp: new Date().toISOString(),
                                        user: currentUserEmail || window.currentUserEmail,
                                        reason: reason
                                    });
                                });

                                updated = true;
                                break;
                            }
                        }
                    }
                    if (updated) break;
                }
            }
        }

        if (updated) {
            const cleanedData = removeUndefinedFields(data);
            await docRef.set(cleanedData, { merge: true });

        }

    } catch (error) {
        console.error('Error recollecting order:', error);
        throw error;
    }
}

async function bulkMarkAsCollected() {
    if (bulkBarcodeSelectedOrders.length === 0) {
        alert('Please select orders to mark as collected.');
        return;
    }

    if (!confirm(`Mark ${bulkBarcodeSelectedOrders.length} selected orders as collected? This will update test statuses.`)) {
        return;
    }

    const progressDiv = document.getElementById('recollectProgress');
    progressDiv.style.display = '';
    progressDiv.textContent = `Processing: 0 / ${bulkBarcodeSelectedOrders.length}`;

    try {
        for (let i = 0; i < bulkBarcodeSelectedOrders.length; i++) {
            const idx = bulkBarcodeSelectedOrders[i];
            const item = bulkBarcodeOrders[idx];

            await markOrderAsCollected(item);

            progressDiv.textContent = `Processing: ${i + 1} / ${bulkBarcodeSelectedOrders.length}`;
        }

        showToast('success', `Marked ${bulkBarcodeSelectedOrders.length} orders as collected.`);
        await loadBulkBarcodeOrders();

    } catch (error) {
        console.error('Error marking orders as collected:', error);
        showToast('error', 'Error processing some orders.');
    } finally {
        progressDiv.style.display = 'none';
        bulkBarcodeSelectedOrders = [];
        updateSelectedOrders();
    }
}

async function markOrderAsCollected(item) {
    const { partId, patientKey, order } = item;

    try {
        const docRef = db.collection('new_record').doc(partId);
        const doc = await docRef.get();
        if (!doc.exists) return;

        const data = doc.data();
        let updated = false;

        if (Array.isArray(data.patients)) {
            for (let pIdx = 0; pIdx < data.patients.length; pIdx++) {
                const patientObj = data.patients[pIdx];
                if (patientObj[patientKey]) {
                    const patient = patientObj[patientKey];
                    if (Array.isArray(patient.orders)) {
                        for (let oIdx = 0; oIdx < patient.orders.length; oIdx++) {
                            if (patient.orders[oIdx].order_id === order.order_id) {
                                // Update tests
                                const tests = patient.orders[oIdx].tests || [];
                                tests.forEach(test => {
                                    if (test.status === 'registered' || test.status === 'recollected') {
                                        test.status = 'Collected.html';
                                        test.collectedTimestamp = new Date();

                                        if (!test.barcoding) test.barcoding = [];
                                        test.barcoding.push({
                                            action: 'collect',
                                            timestamp: new Date().toISOString(),
                                            user: currentUserEmail || window.currentUserEmail

                                        });
                                    }
                                });

                                // Update order status if needed
                                if (patient.orders[oIdx].status === 'registered' || patient.orders[oIdx].status === 'recollected') {
                                    patient.orders[oIdx].status = 'Collected.html';
                                }

                                updated = true;
                                break;
                            }
                        }
                    }
                    if (updated) break;
                }
            }
        }

        if (updated) {
            const cleanedData = removeUndefinedFields(data);
            await docRef.set(cleanedData, { merge: true });

        }

    } catch (error) {
        console.error('Error marking order as collected:', error);
        throw error;
    }
}

function previewOrderBarcodes(orderIndex) {
    const item = bulkBarcodeOrders[orderIndex];

    // Create a temporary container to preview barcodes
    const preview = document.createElement('div');
    preview.style.position = 'fixed';
    preview.style.top = '0';
    preview.style.left = '0';
    preview.style.width = '100%';
    preview.style.height = '100%';
    preview.style.backgroundColor = 'white';
    preview.style.zIndex = '9999';
    preview.style.overflow = 'auto';
    preview.style.padding = '20px';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-danger mb-3';
    closeBtn.innerHTML = '<i class="fas fa-times me-2"></i>Close Preview';
    closeBtn.onclick = function () {
        document.body.removeChild(preview);
    };
    preview.appendChild(closeBtn);

    // Generate preview barcodes (simplified version)
    // In a real implementation, you would generate actual barcodes
    preview.innerHTML += `
        <h4>Barcode Preview for Order: ${item.order.order_id}</h4>
        <p>Patient: ${item.patient.firstName} ${item.patient.secondName}</p>
        <p>Total tests: ${item.stats.totalTests}, Estimated barcodes: ${item.stats.estimatedBarcodes}</p>
        <div class="alert alert-info">
            This is a preview. Actual barcodes would be generated when you click "Generate Barcodes".
        </div>
    `;

    document.body.appendChild(preview);
}

function viewOrderDetails(orderIndex) {
    const item = bulkBarcodeOrders[orderIndex];
    const patientId = item.patient.patient_id;
    const orderId = item.order.order_id;

    // Navigate to the barcode page for this specific order
    window.open(`../../patients/barcode_testing.html?patientId=${encodeURIComponent(patientId)}&orderId=${encodeURIComponent(orderId)}`, '_blank');
}

function recollectSingleOrder(orderIndex) {
    const item = bulkBarcodeOrders[orderIndex];

    if (confirm(`Recollect order ${item.order.order_id}?`)) {
        // Open the recollect reason modal or directly recollect
        // For simplicity, using the same reason
        recollectOrder(item, 'Single recollect from bulk view')
            .then(() => {
                showToast('success', 'Order recollected successfully.');
                loadBulkBarcodeOrders();
            })
            .catch(error => {
                console.error('Error recollecting order:', error);
                showToast('error', 'Error recollecting order.');
            });
    }
}

function clearBulkBarcodeFilters() {
    document.getElementById('bulkBarcodeDateFrom').value = new Date().toISOString().split('T')[0];
    document.getElementById('bulkBarcodeDateTo').value = new Date().toISOString().split('T')[0];
    document.getElementById('bulkBarcodeTimeFrom').value = '00:00';
    document.getElementById('bulkBarcodeTimeTo').value = '23:59';
    document.getElementById('bulkBarcodeDepartment').value = '';
    document.getElementById('bulkBarcodeStatus').value = '';
    document.getElementById('bulkBarcodePatientType').value = '';
    document.getElementById('bulkBarcodeBranch').value = '';
    document.getElementById('bulkBarcodeTestStatus').value = '';
    document.getElementById('bulkBarcodeSearch').value = '';
}

function refreshBulkBarcodeOrders() {
    loadBulkBarcodeOrders();
    showToast('info', 'Refreshing orders list...');
}

function openBulkBarcodeSettings() {
    // Open the barcode customization modal from barcode.html
    // You might need to copy that modal to the bulk entry page or open in a new window
    alert('Open barcode customization. In a full implementation, this would open the barcode settings modal.');
}

// Helper functions from barcode.html
function getOrderDigitalNumber(orderId) {
    const match = orderId.match(/\d+$/);
    return match ? match[0] : orderId;
}

function getStatusClass(status) {
    switch (status) {
        case 'registered': return 'warning text-dark';
        case 'Collected.html': return 'success';
        case 'completed': return 'info text-dark';
        case 'recollected': return 'danger';
        case 'authenticated': return 'warning text-dark';
        case 'reported': return 'secondary';
        case 'sent': return 'primary';
        default: return 'light text-dark';
    }
}

function wrapAbbreviations(abbrs) {
    if (!bulkBarcodeStyles?.globalStyle?.wrapAbbr) return abbrs;

    // Simplified wrapping logic
    const abbrArr = abbrs.split(', ');
    if (abbrArr.length <= 3) return abbrs;

    const mid = Math.ceil(abbrArr.length / 2);
    const line1 = abbrArr.slice(0, mid).join(', ');
    const line2 = abbrArr.slice(mid).join(', ');

    return `<span>${line1}</span><br><span>${line2}</span>`;
}

function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">${message}</p>
                </td>
            </tr>
        `;
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="text-danger">
                        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

function showToast(type, message) {
    // Use your existing toast function or create a simple one
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} border-0`;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    document.body.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', function () {
        toast.remove();
    });
}
async function getNextSampleId(branchCode) {
    const year = new Date().getFullYear();
    const counterDocId = `${branchCode}_${year}`;
    const counterRef = db.collection('sample_counters').doc(counterDocId);

    // Use Firestore transaction for atomic increment
    const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);
        let nextNumber = 1;
        if (doc.exists) {
            nextNumber = (doc.data().lastNumber || 0) + 1;
        }
        transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });
        return nextNumber;
    });

    return `${branchCode}${year}${result}`;
}
// Function to update sample type counter
async function updateSampleTypeCounter(sampleType, branchCode = 'BR') {
    try {
        const counterDocId = `${branchCode}_${sampleType.toLowerCase().replace(/\s+/g, '_')}`;
        const counterRef = db.collection('sample_counters').doc(counterDocId);

        // Use transaction for atomic increment
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);
            let currentCount = 0;

            if (doc.exists) {
                currentCount = doc.data().count || 0;
            }

            transaction.set(counterRef, {
                count: currentCount + 1,
                sampleType: sampleType,
                branchCode: branchCode,

            }, { merge: true });
        });

        console.log(`Counter updated for ${sampleType}`);
    } catch (error) {
        console.error('Error updating sample counter:', error);
    }
}


// Function to update per-test sample counter
async function updateTestSampleCounter(testId, testName) {
    try {
        const counterRef = db.collection('tests_sample_counter').doc(testId);

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);
            let currentCount = 0;
            if (doc.exists) {
                currentCount = doc.data().count || 0;
            }
            transaction.set(counterRef, {
                count: currentCount + 1,
                testId: testId,
                testName: testName,

            }, { merge: true });
        });

        console.log(`Test sample counter updated for ${testName} (${testId})`);
    } catch (error) {
        console.error('Error updating test sample counter:', error);
    }
}

async function updateOrderTestsInNewRecord(patientId, orderId, updatedTests) {
    // Find the part document containing the patient
    const partsSnapshot = await db.collection('new_record').get();
    for (const doc of partsSnapshot.docs) {
        const data = doc.data();
        if (Array.isArray(data.patients)) {
            for (let pIndex = 0; pIndex < data.patients.length; pIndex++) {
                const patientObj = data.patients[pIndex];
                for (const key in patientObj) {
                    const patient = patientObj[key];
                    if (patient.details && patient.details.patient_id === patientId) {
                        // Find the order
                        if (Array.isArray(patient.orders)) {
                            for (let oIndex = 0; oIndex < patient.orders.length; oIndex++) {
                                if (patient.orders[oIndex].order_id === orderId) {
                                    // Update tests
                                    patient.orders[oIndex].tests = updatedTests;
                                    // Save back the whole patients array
                                    await db.collection('new_record').doc(doc.id).set({
                                        patients: data.patients
                                    }, { merge: true });
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    throw new Error('Patient/order not found in new_record');
}
function printBulkBarcodes() {
    const printContainer = document.getElementById('bulkBarcodePrintContainer');
    if (!printContainer || printContainer.children.length === 0) {
        alert('No barcodes to print.');
        return;
    }

    // 1. Force render all barcodes
    const barcodeElements = printContainer.querySelectorAll('.jsbarcode-bulk-print');
    barcodeElements.forEach(svg => {
        // Ensure all barcodes are initialized
        if (!svg.hasAttribute('data-rendered')) {
            try {
                JsBarcode(svg).init();
                svg.setAttribute('data-rendered', 'true');
            } catch (error) {
                console.error('Error rendering barcode:', error);
            }
        }
    });

    // 2. Wait for barcodes to render
    setTimeout(() => {
        // 3. Store original body content and styles
        const originalBody = document.body.innerHTML;
        const originalStyles = document.body.getAttribute('style') || '';
        const originalClasses = document.body.className;

        // 4. Create a clean print document
        const printWindow = window.open('', '_blank');
        printWindow.document.open();

        // 5. Copy styles from current page
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('');

        // 6. Get print-specific CSS
        const printCSS = `
            <style>
                @media print {
                    body { margin: 0; padding: 0; background: white !important; }
                    .barcode-label {
                        width: 50mm !important;
                        height: 25mm !important;
                        margin: 2mm !important;
                        padding: 1mm !important;
                        display: inline-block !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .barcode-order-page {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .no-print { display: none !important; }
                }
                body { 
                    font-family: Arial, sans-serif !important;
                    background: white !important;
                    color: black !important;
                }
                .barcode-label {
                    border: 1px dashed #ccc !important;
                    font-family: Arial, sans-serif !important;
                }
            </style>
        `;

        // 7. Build print document
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bulk Barcode Print</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${styles}
                ${printCSS}
            </head>
            <body>
                <div id="bulkBarcodePrintContainer">
                    ${printContainer.innerHTML}
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>
                    // Initialize any uninitialized barcodes
                    document.addEventListener('DOMContentLoaded', function() {
                        const barcodes = document.querySelectorAll('.jsbarcode-bulk-print:not([data-rendered])');
                        barcodes.forEach(svg => {
                            try {
                                JsBarcode(svg).init();
                                svg.setAttribute('data-rendered', 'true');
                            } catch(e) { console.error(e); }
                        });
                        
                        // Wait a moment then print
                        setTimeout(() => {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        }, 500);
                    });
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();

    }, 100); // Small delay to ensure DOM updates
}


// Export functions for use in HTML
window.loadBulkBarcodeOrders = loadBulkBarcodeOrders;
window.startBulkBarcodeGeneration = startBulkBarcodeGeneration;
window.cancelBulkBarcodeGeneration = cancelBulkBarcodeGeneration;
window.printAllBulkBarcodes = printAllBulkBarcodes;
window.showBulkRecollectModal = showBulkRecollectModal;
window.bulkMarkAsCollected = bulkMarkAsCollected;
window.clearBulkBarcodeFilters = clearBulkBarcodeFilters;
window.refreshBulkBarcodeOrders = refreshBulkBarcodeOrders;
window.openBulkBarcodeSettings = openBulkBarcodeSettings;
window.previewOrderBarcodes = previewOrderBarcodes;
window.viewOrderDetails = viewOrderDetails;
window.recollectSingleOrder = recollectSingleOrder;
// Export for HTML
window.printBulkBarcodes = printBulkBarcodes;





