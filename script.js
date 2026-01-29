// --- Al-Gomhouria Lab - PURE LOCAL STORAGE MODE ---
// No server, no IP, just files working together in the folder.

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Automatic Date & ID ---
    const creationDateInput = document.getElementById('creationDate');
    if (creationDateInput) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        creationDateInput.value = (new Date(now - offset)).toISOString().slice(0, 16);
    }

    const patientIdInput = document.getElementById('patientId');
    if (patientIdInput && !patientIdInput.value) {
        patientIdInput.value = 'GOM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    // --- 2. Load Local Data ---
    function getDB() {
        return JSON.parse(localStorage.getItem('patientsDatabase')) || [];
    }

    function saveDB(data) {
        localStorage.setItem('patientsDatabase', JSON.stringify(data));
    }

    // Initialize Dashboard if on that page
    if (window.location.href.includes('dashboard.html')) {
        refreshDashboardTable(getDB());
    }

    // --- 3. Age Calculation Logic ---
    const birthDateInput = document.getElementById('birthDate');
    const ageYears = document.getElementById('ageYears');
    const ageMonths = document.getElementById('ageMonths');
    const ageDays = document.getElementById('ageDays');
    if (birthDateInput && ageYears) {
        birthDateInput.addEventListener('change', () => {
            const birth = new Date(birthDateInput.value);
            const now = new Date();
            let y = now.getFullYear() - birth.getFullYear();
            let m = now.getMonth() - birth.getMonth();
            let d = now.getDate() - birth.getDate();
            if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
            if (m < 0) { y--; m += 12; }
            ageYears.value = y; ageMonths.value = m; ageDays.value = d;
        });
        ageYears.addEventListener('input', () => {
            if (ageYears.value) birthDateInput.value = (new Date().getFullYear() - ageYears.value) + "-01-01";
        });
    }

    // --- 4. Gender & Pregnancy Logic ---
    const genderSelect = document.getElementById('gender');
    const pregnancyGroup = document.getElementById('pregnancyGroup');
    if (genderSelect && pregnancyGroup) {
        genderSelect.addEventListener('change', () => {
            if (genderSelect.value === 'Female') {
                pregnancyGroup.style.display = 'block';
            } else {
                pregnancyGroup.style.display = 'none';
                document.getElementById('isPregnant').value = 'No';
            }
        });
    }

    // --- 5. Sidebar Sync ---
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.onclick = () => {
            const label = item.textContent.toLowerCase();
            if (label.includes('overview')) window.location.href = 'dashboard.html';
            else if (label.includes('inventory')) window.location.href = 'patients-inventory.html';
            else if (label.includes('registration')) window.location.href = 'patient-registration.html';
            else if (label.includes('collection')) window.location.href = 'collection-room.html';
            else if (label.includes('finance')) window.location.href = 'finance-dashboard.html';
            else if (label.includes('request')) window.location.href = 'order-tests.html';
        };
    });

    // --- 6. Global Save ---
    const saveBtn = document.getElementById('confirmSaveBtn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            const firstNameInput = document.querySelector('input[placeholder="1st Name"]');
            const mobileInput = document.querySelector('input[placeholder="Enter Mobile Number"]');

            if (!firstNameInput || !mobileInput) return;

            const firstName = firstNameInput.value;
            const mobile = mobileInput.value;

            if (!firstName || !mobile) return alert("Please fill Name and Mobile!");

            const patientData = {
                id: document.getElementById('patientId').value,
                name: firstName + ' ' + (document.querySelector('input[placeholder="2nd Name"]').value || ""),
                mobile: mobile,
                gender: document.getElementById('gender').value,
                isPregnant: document.getElementById('isPregnant') ? document.getElementById('isPregnant').value : 'No',
                ageY: ageYears.value || "0",
                ageM: ageMonths.value || "0",
                ageD: ageDays.value || "0",
                totalPrice: document.getElementById('totalPrice') ? document.getElementById('totalPrice').value : "0",
                paidAmount: document.getElementById('paidAmount') ? document.getElementById('paidAmount').value : "0",
                discountPercent: document.getElementById('discountPercent') ? document.getElementById('discountPercent').value : "0",
                creationDate: document.getElementById('creationDate').value || new Date().toISOString(),
                date: new Date().toLocaleDateString('en-CA'), // Standard YYYY-MM-DD local date
                status: 'New',
                results: {} // Initialize empty results
            };

            // Save to LocalStorage
            let db = getDB();
            const index = db.findIndex(p => p.id === patientData.id);
            if (index !== -1) {
                // Merge existing results if any
                patientData.results = db[index].results || {};
                db[index] = patientData;
            }
            else db.push(patientData);
            saveDB(db);

            alert("✅ Patient Saved Successfully!");
            window.location.href = 'dashboard.html';
        };
    }

    function refreshDashboardTable(data) {
        const pendingBody = document.getElementById('latestActivityBody');
        const completedBody = document.getElementById('completedActivityBody');
        if (!pendingBody || !completedBody) return;

        pendingBody.innerHTML = '';
        completedBody.innerHTML = '';

        const pending = data.filter(p => p.status !== 'Completed').slice().reverse();
        const completed = data.filter(p => p.status === 'Completed').slice().reverse();

        // Update Stats
        if (document.getElementById('pendingCount')) document.getElementById('pendingCount').textContent = pending.length;
        if (document.getElementById('completedCount')) document.getElementById('completedCount').textContent = completed.length;
        if (document.getElementById('collectionCount')) {
            const needsColl = data.filter(p => !p.collectionStatus || p.collectionStatus !== 'Collected').length;
            document.getElementById('collectionCount').textContent = needsColl;
        }

        if (pending.length === 0) {
            pendingBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No pending patients.</td></tr>';
        } else {
            pending.forEach(p => {
                const collStatus = p.collectionStatus === 'Collected' ? 'Collected' : 'Pending Sample';
                const collColor = p.collectionStatus === 'Collected' ? '#059669' : '#ea580c';

                pendingBody.insertAdjacentHTML('beforeend', `<tr>
                    <td>#${p.id}</td>
                    <td style="font-weight: 600;">${p.name}</td>
                    <td><span style="font-size: 0.8rem; color: ${collColor}; font-weight: 600;">${collStatus}</span></td>
                    <td>${p.date}</td>
                    <td><span class="status-badge status-pending">${p.status}</span></td>
                    <td>
                        <button class="primary-btn" style="padding: 5px 12px; font-size: 0.8rem; background: #006ce7;" onclick="location.href='collection-room.html?id=${p.id}'">Tube</button>
                        <button class="primary-btn" style="padding: 5px 12px; font-size: 0.8rem; background: #d32f2f;" onclick="location.href='results-entry.html?id=${p.id}'">Tests</button>
                    </td>
                </tr>`);
            });
        }

        if (completed.length === 0) {
            completedBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No completed records yet.</td></tr>';
        } else {
            completed.forEach(p => {
                completedBody.insertAdjacentHTML('beforeend', `<tr>
                    <td>#${p.id}</td>
                    <td style="font-weight: 600;">${p.name}</td>
                    <td style="font-family: monospace; font-weight: 700;">||| ${p.id.slice(-4)}</td>
                    <td>${p.date}</td>
                    <td><span class="status-badge status-completed" style="background: #f0fdf4; color: #166534; border: 1px solid #86efac;">Ready</span></td>
                    <td><button class="primary-btn" style="padding: 5px 15px; font-size: 0.8rem; background: #2e7d32;" onclick="location.href='patient-report.html?id=${p.id}'">📄 Print</button></td>
                </tr>`);
            });
        }
    }

    // Database Export/Import
    window.exportDatabase = () => {
        const data = localStorage.getItem('patientsDatabase');
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gomhouria_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };

    window.importDatabase = (input) => {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            localStorage.setItem('patientsDatabase', e.target.result);
            alert("Database Imported Successfully!");
            location.reload();
        };
        reader.readAsText(file);
    };
});
