// Bulk Record Results Logic

let bulkRecordOrders = [];
let bulkRecordTestsList = {};
let bulkRecordIsSaving = false;


// Load departments and branches for filters
document.addEventListener('DOMContentLoaded', async function () {
    // Get current user
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserEmail = user.email;
            loadCurrentUserFullName(user.email);
        }
    });
    
    await loadBulkRecordDepartments();
    await loadBulkRecordBranches();
    // Optionally set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bulkRecordDateFrom').value = '';
    document.getElementById('bulkRecordDateTo').value = '';
});

// Load current user full name for authentication
async function loadCurrentUserFullName(email) {
    try {
        const doc = await db.collection('employees').doc(email).get();
        if (doc.exists) {
            const userData = doc.data();
            window.currentUserFullName = userData.fullName || email;
        }
    } catch (error) {
        console.error("Error loading user info:", error);
        window.currentUserFullName = email;
    }
}

// Load departments from tests_list
async function loadBulkRecordDepartments() {
    const select = document.getElementById('bulkRecordDepartment');
    select.innerHTML = '<option value="">All Departments</option>';
    const doc = await db.collection('tests_list').doc('Tests.html').get();
    if (doc.exists) {
        const tests = doc.data();
        const departments = new Set();
        Object.values(tests).forEach(test => {
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

// Load branches for filter
async function loadBulkRecordBranches() {
    const select = document.getElementById('bulkRecordBranch');
    select.innerHTML = '<option value="">All Branches</option>';
    const snap = await db.collection('branches').get();
    snap.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = doc.id;
        select.appendChild(opt);
    });
}

// Clear filters
function clearBulkRecordFilters() {
    document.getElementById('bulkRecordDateFrom').value = '';
    document.getElementById('bulkRecordDateTo').value = '';
    document.getElementById('bulkRecordTimeFrom').value = '';
    document.getElementById('bulkRecordTimeTo').value = '';
    document.getElementById('bulkRecordDepartment').value = '';
    document.getElementById('bulkRecordStatus').value = '';
    document.getElementById('bulkRecordPatientType').value = '';
    document.getElementById('bulkRecordBranch').value = '';
    document.getElementById('bulkRecordTestStatus').value = '';
    document.getElementById('bulkRecordSearch').value = '';
    document.getElementById('bulkRecordOrdersTable').innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="text-muted">
                    <i class="fas fa-search fa-2x mb-3"></i><br>
                    Use the filters above to search for orders
                </div>
            </td>
        </tr>
    `;
    document.getElementById('bulkRecordFilteredOrdersCount').textContent = '0';
    document.getElementById('bulkSaveResultsBtn').disabled = true;
    document.getElementById('bulkAuthenticateOrdersBtn').disabled = true;
}

// Load orders matching filters
async function loadBulkRecordOrders() {
    const tbody = document.getElementById('bulkRecordOrdersTable');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2">Loading orders...</p>
            </td>
        </tr>
    `;
    bulkRecordOrders = [];
    bulkRecordTestsList = {};

    // Get filters
    const dateFrom = document.getElementById('bulkRecordDateFrom').value;
    const dateTo = document.getElementById('bulkRecordDateTo').value;
    const timeFrom = document.getElementById('bulkRecordTimeFrom').value || '00:00';
    const timeTo = document.getElementById('bulkRecordTimeTo').value || '23:59';
    const department = document.getElementById('bulkRecordDepartment').value;
    const status = document.getElementById('bulkRecordStatus').value;
    const patientType = document.getElementById('bulkRecordPatientType').value;
    const branch = document.getElementById('bulkRecordBranch').value;
    const testStatus = document.getElementById('bulkRecordTestStatus').value;
    const search = document.getElementById('bulkRecordSearch').value.trim().toLowerCase();

    // Convert dates to timestamps
    const startDate = dateFrom ? new Date(`${dateFrom}T${timeFrom}`) : null;
    const endDate = dateTo ? new Date(`${dateTo}T${timeTo}`) : null;

    // Load all tests for reference ranges
    const testsDoc = await db.collection('tests_list').doc('Tests.html').get();
    const allTests = testsDoc.exists ? testsDoc.data() : {};

    // Fetch all new_record docs
    const partsSnap = await db.collection('new_record').get();
    let rows = [];
    let count = 0;

    // Group by order to track which orders need to be updated
    const ordersToUpdate = new Map(); // key: `${docId}_${patientKey}_${order.order_id}`

    for (const doc of partsSnap.docs) {
        const data = doc.data();
        if (!Array.isArray(data.patients)) continue;
        for (const patientObj of data.patients) {
            for (const key in patientObj) {
                const patient = patientObj[key];
                if (!Array.isArray(patient.orders)) continue;
                for (const order of patient.orders) {
                    // Filter by date
                    let orderDate = order.order_date?.toDate ? order.order_date.toDate() : new Date(order.order_date);
                    if (startDate && orderDate < startDate) continue;
                    if (endDate && orderDate > endDate) continue;
                    // Filter by status
                    if (status && order.status !== status) continue;
                    // Filter by patient type
                    if (patientType && order.patient_type !== patientType) continue;
                    // Filter by branch
                    if (branch && order.branch !== branch) continue;
                    // Filter by department
                    if (department && order.tests && !order.tests.some(t => {
                        const tObj = allTests[t.test_id];
                        return tObj && tObj.department === department;
                    })) continue;
                    // Filter by test status
                    if (testStatus && order.tests && !order.tests.some(t => t.status === testStatus)) continue;
                    // Filter by search
                    if (search) {
                        const patientName = `${patient.details.firstName || ''} ${patient.details.secondName || ''} ${patient.details.thirdName || ''}`.toLowerCase();
                        const patientId = (patient.details.patient_id || '').toLowerCase();
                        const mobile = (patient.details.mobile || '').toLowerCase();
                        const orderId = (order.order_id || '').toLowerCase();
                        if (!patientName.includes(search) && !patientId.includes(search) && !mobile.includes(search) && !orderId.includes(search)) continue;
                    }
                    // For each test in order, add a row
                    if (Array.isArray(order.tests)) {
                        for (const test of order.tests) {
                            // Only show editable for registered/collected/recollected/completed
                            if (!['registered', 'Collected.html', 'recollected', 'completed'].includes(test.status)) continue;
                            // Get test details
                            const testObj = allTests[test.test_id];
                            if (!testObj) continue;
                            // Get reference range for this patient
                            const refRange = getReferenceRangeForBulk(testObj, patient.details);
                            // Unique row id
                            const rowId = `bulkres_${doc.id}_${key}_${order.order_id}_${test.test_id}`;
                            
                            // Store order info for later status update
                            const orderKey = `${doc.id}_${key}_${order.order_id}`;
                            if (!ordersToUpdate.has(orderKey)) {
                                ordersToUpdate.set(orderKey, {
                                    docId: doc.id,
                                    patientKey: key,
                                    patient: patient.details,
                                    order: order,
                                    tests: []
                                });
                            }
                            
                            // Add test to order
                            ordersToUpdate.get(orderKey).tests.push(test);
                            
                            // Store for later save
                            bulkRecordOrders.push({
                                docId: doc.id,
                                patientKey: key,
                                patient: patient.details,
                                order,
                                test,
                                testObj,
                                rowId,
                                orderKey
                            });
                            
                            // Build row
                            rows.push(`
                                <tr>
                                    <td>${order.order_id}</td>
                                    <td>${patient.details.patient_id}</td>
                                    <td>${patient.details.firstName || ''} ${patient.details.secondName || ''} ${patient.details.thirdName || ''}</td>
                                    <td>${testObj.test_name}</td>
                                    <td>
                                        <input type="text" class="form-control form-control-sm" id="${rowId}_result" value="${test.result || ''}">
                                    </td>
                                    <td>
                                        <input type="text" class="form-control form-control-sm" id="${rowId}_ref" value="${refRange || ''}" readonly>
                                        <small class="text-muted">${testObj.unit || ''}</small>
                                    </td>
                                </tr>
                            `);
                            count++;
                        }
                    }
                }
            }
        }
    }

    tbody.innerHTML = rows.length ? rows.join('') : `
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="text-muted">
                    <i class="fas fa-exclamation-circle fa-2x mb-3"></i><br>
                    No orders found matching the filters
                </div>
            </td>
        </tr>
    `;
    document.getElementById('bulkRecordFilteredOrdersCount').textContent = count;
    document.getElementById('bulkSaveResultsBtn').disabled = count === 0;
    document.getElementById('bulkAuthenticateOrdersBtn').disabled = count === 0;
}

// Reference range logic (same as record_result.html)
function getReferenceRangeForBulk(test, patient) {
    if (!test.reference_ranges || test.reference_ranges.length === 0) return '';
    let ageValue = null, ageUnit = null;
    if (typeof patient.age_years === 'number' && patient.age_years > 0) {
        ageValue = patient.age_years; ageUnit = 'years';
    } else if (typeof patient.age_months === 'number' && patient.age_months > 0) {
        ageValue = patient.age_months; ageUnit = 'months';
    } else if (typeof patient.age_days === 'number' && patient.age_days > 0) {
        ageValue = patient.age_days; ageUnit = 'days';
    }
    function convertAgeToDays(age, unit) {
        if (!age) return 0;
        switch (unit) {
            case 'days': return age;
            case 'months': return age * 30;
            case 'years': return age * 365;
            default: return age;
        }
    }
    function isWithinRange(range) {
        let from = convertAgeToDays(range.age_from, range.unit || range.age_type);
        let to = convertAgeToDays(range.age_to, range.unit || range.age_type);
        let patientAgeInDays = convertAgeToDays(ageValue, ageUnit);
        return patientAgeInDays >= from && (to === 0 || patientAgeInDays <= to);
    }
    let ranges = test.reference_ranges.filter(r => r.gender === patient.gender);
    if (patient.gender === 'Female' && typeof patient.pregnancyStatus === 'string' && patient.pregnancyStatus.toLowerCase().includes('preg')) {
        const pregnantRanges = ranges.filter(r => r.pregnant === true);
        for (const range of pregnantRanges) if (isWithinRange(range)) return range.range;
    }
    const nonPregnantRanges = ranges.filter(r => !r.pregnant || r.pregnant === false || r.pregnant === undefined);
    for (const range of nonPregnantRanges) if (isWithinRange(range)) return range.range;
    if (ranges.length > 0) return ranges[0].range;
    return test.reference_ranges[0].range;
}

// Helper to remove undefined fields (same as record_result.html)
function removeUndefinedFields(obj) {
    if (Array.isArray(obj)) {
        return obj
            .map(removeUndefinedFields)
            .filter(v => v !== undefined);
    } else if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, removeUndefinedFields(v)])
        );
    }
    return obj;
}

// Bulk save results for all filtered tests (COMPLETE)
async function bulkSaveResults() {
    if (bulkRecordIsSaving) return;
    if (!confirm('Are you sure you want to complete results for all selected tests? This will mark orders as completed.')) return;
    
    bulkRecordIsSaving = true;
    document.getElementById('bulkSaveResultsBtn').disabled = true;
    let updatedCount = 0, failedCount = 0;
    
    // Group by order first
    const ordersMap = new Map();
    bulkRecordOrders.forEach(item => {
        const orderKey = item.orderKey;
        if (!ordersMap.has(orderKey)) {
            ordersMap.set(orderKey, {
                docId: item.docId,
                patientKey: item.patientKey,
                patient: item.patient,
                order: item.order,
                tests: []
            });
        }
        ordersMap.get(orderKey).tests.push(item);
    });
    
    // Process each order
    for (const [orderKey, orderData] of ordersMap.entries()) {
        try {
            const docRef = db.collection('new_record').doc(orderData.docId);
            const doc = await docRef.get();
            if (!doc.exists) continue;
            
            const data = doc.data();
            let orderUpdated = false;
            
            if (Array.isArray(data.patients)) {
                for (let pIdx = 0; pIdx < data.patients.length; pIdx++) {
                    const patientObj = data.patients[pIdx];
                    if (patientObj[orderData.patientKey]) {
                        const patient = patientObj[orderData.patientKey];
                        if (Array.isArray(patient.orders)) {
                            for (let oIdx = 0; oIdx < patient.orders.length; oIdx++) {
                                if (patient.orders[oIdx].order_id === orderData.order.order_id) {
                                    const order = patient.orders[oIdx];
                                    const tests = order.tests || [];
                                    let allTestsCompleted = true;
                                    let hasAnyResult = false;
                                    
                                    // Update each test
                                    for (let tIdx = 0; tIdx < tests.length; tIdx++) {
                                        const test = tests[tIdx];
                                        // Find corresponding bulk item
                                        const bulkItem = orderData.tests.find(t => t.test.test_id === test.test_id);
                                        if (bulkItem) {
                                            const resultVal = document.getElementById(`${bulkItem.rowId}_result`).value.trim();
                                            if (resultVal) {
                                                test.result = resultVal;
                                                test.status = 'completed';
                                                test.completedTimestamp = new Date();
                                                test.last_updated = new Date();
                                                test.updated_by = currentUserEmail;
                                                hasAnyResult = true;
                                                
                                                // Add barcoding entry
                                                if (!test.barcoding) test.barcoding = [];
                                                test.barcoding.push({
                                                    action: 'completed',
                                                    timestamp: new Date().toISOString(),
                                                    user: window.currentUserFullName || currentUserEmail
                                                });
                                            }
                                        }
                                        
                                        // Check if all tests are completed
                                        if (test.status !== 'completed' && test.status !== 'authenticated') {
                                            allTestsCompleted = false;
                                        }
                                    }
                                    
                                    // Update order status if any test was completed
                                    if (hasAnyResult) {
                                        order.status = 'completed';
                                        order.completed_at = new Date();
                                        order.completed_by = window.currentUserFullName || currentUserEmail;
                                        order.last_updated = new Date();
                                        orderUpdated = true;
                                    }
                                    
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            if (orderUpdated) {
                await docRef.set(data, { merge: true });
                updatedCount++;
            }
        } catch (e) {
            console.error("Error updating order:", e);
            failedCount++;
        }
    }
    
    showToast('success', `Bulk complete done! Updated orders: ${updatedCount}, Failed: ${failedCount}`);
    bulkRecordIsSaving = false;
    document.getElementById('bulkSaveResultsBtn').disabled = false;
    loadBulkRecordOrders(); // Refresh the list
}

// Bulk authenticate all filtered orders/tests
async function bulkAuthenticateOrders() {
    if (bulkRecordIsSaving) return;
    if (!confirm('Are you sure you want to authenticate all selected tests? This will mark orders as authenticated.')) return;
    
    bulkRecordIsSaving = true;
    document.getElementById('bulkAuthenticateOrdersBtn').disabled = true;
    let updatedCount = 0, failedCount = 0;
    
    // Group by order first
    const ordersMap = new Map();
    bulkRecordOrders.forEach(item => {
        const orderKey = item.orderKey;
        if (!ordersMap.has(orderKey)) {
            ordersMap.set(orderKey, {
                docId: item.docId,
                patientKey: item.patientKey,
                patient: item.patient,
                order: item.order,
                tests: []
            });
        }
        ordersMap.get(orderKey).tests.push(item);
    });
    
    // Process each order
    for (const [orderKey, orderData] of ordersMap.entries()) {
        try {
            const docRef = db.collection('new_record').doc(orderData.docId);
            const doc = await docRef.get();
            if (!doc.exists) continue;
            
            const data = doc.data();
            let orderUpdated = false;
            let orderHasAuthenticatedTests = false;
            
            if (Array.isArray(data.patients)) {
                for (let pIdx = 0; pIdx < data.patients.length; pIdx++) {
                    const patientObj = data.patients[pIdx];
                    if (patientObj[orderData.patientKey]) {
                        const patient = patientObj[orderData.patientKey];
                        if (Array.isArray(patient.orders)) {
                            for (let oIdx = 0; oIdx < patient.orders.length; oIdx++) {
                                if (patient.orders[oIdx].order_id === orderData.order.order_id) {
                                    const order = patient.orders[oIdx];
                                    const tests = order.tests || [];
                                    let allTestsAuthenticated = true;
                                    
                                    // Update each test
                                    for (let tIdx = 0; tIdx < tests.length; tIdx++) {
                                        const test = tests[tIdx];
                                        // Find corresponding bulk item
                                        const bulkItem = orderData.tests.find(t => t.test.test_id === test.test_id);
                                        if (bulkItem) {
                                            const resultVal = document.getElementById(`${bulkItem.rowId}_result`).value.trim();
                                            if (resultVal) {
                                                // Only authenticate if result exists
                                                test.result = resultVal;
                                                test.status = 'authenticated';
                                                test.authenticated_at = new Date();
                                                test.authenticated_by = window.currentUserFullName || currentUserEmail;
                                                test.last_updated = new Date();
                                                orderHasAuthenticatedTests = true;
                                                
                                                // Add barcoding entry
                                                if (!test.barcoding) test.barcoding = [];
                                                test.barcoding.push({
                                                    action: 'authenticated',
                                                    timestamp: new Date().toISOString(),
                                                    user: window.currentUserFullName || currentUserEmail
                                                });
                                            }
                                        }
                                        
                                        // Check if test should be authenticated
                                        if (test.status !== 'authenticated' && test.result) {
                                            allTestsAuthenticated = false;
                                        }
                                    }
                                    
                                    // Update order status if any test was authenticated
                                    if (orderHasAuthenticatedTests) {
                                        order.status = 'authenticated';
                                        order.authenticated_at = new Date();
                                        order.authenticated_by = window.currentUserFullName || currentUserEmail;
                                        order.last_updated = new Date();
                                        orderUpdated = true;
                                        
                                        // Add WhatsApp request (same as record_result.html)
                                        try {
                                            const mobile = orderData.patient.mobile || '';
                                            const autoPassword = orderData.patient.autoPassword || orderData.patient.auto_password || orderData.patient.password || '';
                                            const orderRequest = {
                                                orderId: order.order_id,
                                                mobile: mobile,
                                                patient_id: orderData.patient.patient_id,
                                                auto_password: autoPassword,
                                                whatsapp_status: "pending"
                                            };
                                            
                                            const ordersDocRef = db.collection('whats_app_requests').doc('whatsapp_orders');
                                            await ordersDocRef.set({
                                                [order.order_id]: orderRequest
                                            }, { merge: true });
                                        } catch (err) {
                                            console.error('Failed to log WhatsApp request:', err);
                                        }
                                    }
                                    
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            if (orderUpdated) {
                await docRef.set(data, { merge: true });
                updatedCount++;
            }
        } catch (e) {
            console.error("Error updating order:", e);
            failedCount++;
        }
    }
    
    showToast('success', `Bulk authenticate done! Authenticated orders: ${updatedCount}, Failed: ${failedCount}`);
    bulkRecordIsSaving = false;
    document.getElementById('bulkAuthenticateOrdersBtn').disabled = false;
    loadBulkRecordOrders(); // Refresh the list
}

// Update test result in Firestore (same structure as record_result.html)
async function updateBulkTestResult(item) {
    const docRef = db.collection('new_record').doc(item.docId);
    const doc = await docRef.get();
    if (!doc.exists) return;
    const data = doc.data();
    let updated = false;
    if (Array.isArray(data.patients)) {
        for (let pIdx = 0; pIdx < data.patients.length; pIdx++) {
            const patientObj = data.patients[pIdx];
            if (patientObj[item.patientKey]) {
                const patient = patientObj[item.patientKey];
                if (Array.isArray(patient.orders)) {
                    for (let oIdx = 0; oIdx < patient.orders.length; oIdx++) {
                        if (patient.orders[oIdx].order_id === item.order.order_id) {
                            const tests = patient.orders[oIdx].tests || [];
                            for (let tIdx = 0; tIdx < tests.length; tIdx++) {
                                if (tests[tIdx].test_id === item.test.test_id) {
                                    tests[tIdx] = { ...tests[tIdx], ...item.test };
                                    updated = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (updated) {
        await docRef.set(data, { merge: true });
    }
}

// Simple toast
function showToast(type, message) {
    let toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', function () { toast.remove(); });
}

// Export functions for HTML
window.clearBulkRecordFilters = clearBulkRecordFilters;
window.loadBulkRecordOrders = loadBulkRecordOrders;
window.bulkSaveResults = bulkSaveResults;
window.bulkAuthenticateOrders = bulkAuthenticateOrders;




