import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, push, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAc46X6MIXI-moZ2oTy2ShiDv6IrjhVQC4",
    authDomain: "finance-app-23309.firebaseapp.com",
    databaseURL: "https://finance-app-23309-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "finance-app-23309",
    storageBucket: "finance-app-23309.firebasestorage.app",
    messagingSenderId: "268979076437",
    appId: "1:268979076437:web:204abafc00e7558f4e83dc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let totalBillAmount = 0;  
let cachedReportData = [];

window.toggleLoading = function(show) {  
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';  
} 

// ==========================================
// SECURITY & AUTH ENGINE
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('password-overlay').style.opacity = '0';
        setTimeout(() => { document.getElementById('password-overlay').style.display = 'none'; }, 500);
        initApp();
    } else {
        document.getElementById('password-overlay').style.display = 'flex';
        document.getElementById('password-overlay').style.opacity = '1';
        window.toggleLoading(false);
    }
});

window.handleLogin = function() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    if(!email || !pass) {
        errorMsg.innerText = "Please enter email and password.";
        errorMsg.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Signing in...`;

    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            btn.disabled = false;
            btn.innerText = "Sign In";
            errorMsg.style.display = 'none';
        })
        .catch(() => {
            btn.disabled = false;
            btn.innerText = "Sign In";
            errorMsg.innerText = "Invalid Email or Password.";
            errorMsg.style.display = 'block';
        });
}

window.handleLogout = function() {
    if(confirm("Are you sure you want to sign out?")) {
        signOut(auth).then(() => { location.reload(); }).catch(err => alert("Error signing out: " + err.message));
    }
}

document.getElementById('loginPassword').addEventListener("keypress", function(event) {
    if (event.key === "Enter") { window.handleLogin(); }
});

// ==========================================
// INITIALIZATION ENGINE
// ==========================================
window.onload = function() {  
    document.getElementById('currentYear').textContent = new Date().getFullYear();
};  

function initApp() {
    const date = new Date();
    const y = date.getFullYear();  
    const m = String(date.getMonth() + 1).padStart(2, '0');  
    const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();

    document.getElementById('billStart').value = `${y}-${m}-01`;  
    document.getElementById('billEnd').value = `${y}-${m}-${lastDay}`;  

    window.addBillRow();   
    
    const dbRef = ref(db);
    get(child(dbRef, `happyhome/people`)).then((snapshot) => {
        if (snapshot.exists()) {
            window.renderPeople(snapshot.val());
        } else {
            const defaultPeople = ["Resident 1", "Resident 2", "Resident 3"];
            set(ref(db, 'happyhome/people'), defaultPeople);
            window.renderPeople(defaultPeople);
        }
        window.toggleLoading(false);
    }).catch((error) => {
        alert("Connection Error: " + error.message);
        window.toggleLoading(false);
    });
}

// ==========================================
// CALCULATOR & RENDER ENGINE
// ==========================================
window.addBillRow = function(name = "", amt = "") {  
    const container = document.getElementById('bill-container');  
    const div = document.createElement('div');  
    div.className = 'sheet-row bill-row';  
    div.innerHTML = `  
        <input type="text" class="sheet-input bill-name" placeholder="Name" value="${name}">  
        <input type="number" class="sheet-input bill-amt" placeholder="0.00" value="${amt}" oninput="window.calculateAll()">  
        <button class="sheet-btn text-danger" onclick="window.removeBillRow(this)"><i class="bi bi-x-lg"></i></button>  
    `;  
    container.appendChild(div);  
}

window.removeBillRow = function(btn) { btn.closest('.bill-row').remove(); window.calculateAll(); }  

window.renderPeople = function(data) {  
    let names = [];
    if (Array.isArray(data)) names = data.filter(n => n); 
    else if (typeof data === 'object' && data !== null) names = Object.values(data).filter(n => n);

    document.getElementById('personCountBadge').innerText = names.length;  
    const tbody = document.getElementById('peopleBody');  
    tbody.innerHTML = '';

    names.forEach((name) => {  
        const row = `  
            <tr data-name="${name}">  
                <td class="fw-bold text-dark" style="padding-left: 10px;">${name}</td>  
                <td>  
                    <div class="date-cell-wrapper">  
                        <input type="date" class="sheet-input p-date-from" onchange="window.calculateAll()">  
                        <input type="date" class="sheet-input p-date-to" onchange="window.calculateAll()">  
                    </div>  
                </td>  
                <td><input type="text" class="sheet-input text-center readonly-cell p-days" readonly value="0"></td>  
                <td class="text-center"><span class="status-badge status-full p-status" style="padding:2px 6px; font-size:0.65rem;">Full</span></td>  
                <td><input type="text" class="sheet-input readonly-cell p-share" readonly value="0.00"></td>  
                <td>  
                    <div class="extra-cell-wrapper">  
                        <input type="text" class="sheet-input note extra-name" placeholder="Note" oninput="window.calculateAll()">  
                        <input type="number" class="sheet-input amt extra-amt" placeholder="0.00" oninput="window.calculateAll()">  
                    </div>  
                </td>  
                <td><input type="text" class="sheet-input total-cell p-total" readonly value="0.00"></td>  
            </tr>`;  
        tbody.insertAdjacentHTML('beforeend', row);  
    });
    window.syncDates();  
}

window.syncDates = function() {  
    const start = document.getElementById('billStart').value;
    const end = document.getElementById('billEnd').value;  
    
    // Update the master badge
    const diff = window.getDaysDiff(start, end);  
    const badge = document.getElementById('displayBillDays');
    if(badge) badge.innerText = diff + " Days";
    
    // Clear the vacation dates by default (meaning 0 days absent)
    document.querySelectorAll('.p-date-from').forEach(el => el.value = "");
    document.querySelectorAll('.p-date-to').forEach(el => el.value = "");  
    
    // Trigger calculator
    window.calculateAll();  
}

window.getDaysDiff = function(d1, d2) {  
    if (!d1 || !d2) return 0;
    try {
        const startParts = d1.split('-');
        const endParts = d2.split('-');  
        if(startParts.length < 3 || endParts.length < 3) return 0;

        const dStart = Date.UTC(startParts[0], startParts[1]-1, startParts[2]);
        const dEnd = Date.UTC(endParts[0], endParts[1]-1, endParts[2]);  
        
        const diffTime = dEnd - dStart;
        if(isNaN(diffTime)) return 0;

        const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return days > 0 ? days : 0;
    } catch(e) {
        return 0;
    }
}

window.calculateAll = function() {  
    try {
        let sumBills = 0;
        document.querySelectorAll('.bill-amt').forEach(el => {  
            sumBills += parseFloat(String(el.value).replace(',', '.')) || 0;  
        });

        totalBillAmount = sumBills;  
        document.getElementById('displayTotalBill').innerText = sumBills.toLocaleString(undefined, {minimumFractionDigits: 2});  

        const billStart = document.getElementById('billStart').value;
        const billEnd = document.getElementById('billEnd').value;  
        const billDays = window.getDaysDiff(billStart, billEnd);  
        
        // --- FIX: BIND BADGE STRICTLY TO MASTER DATES ---
        document.getElementById('displayBillDays').innerText = billDays + " Days";

        const rows = document.querySelectorAll('#peopleBody tr');
        const personCount = rows.length;

let rowStates = [];
        rows.forEach((row, index) => {  
            const vStart = row.querySelector('.p-date-from').value;
            const vEnd = row.querySelector('.p-date-to').value;
            
            let absentDays = 0;

            if (vStart && vEnd) {
                // "Clamp" the vacation dates so they don't exceed the billing start/end
                const clampedStart = (vStart < billStart) ? billStart : vStart;
                const clampedEnd = (vEnd > billEnd) ? billEnd : vEnd;

                // Calculate absent days ONLY if the clamped dates are valid
                if (clampedStart <= clampedEnd) {
                    absentDays = window.getDaysDiff(clampedStart, clampedEnd);
                }
            }
            
            // Consumed Days = Total Billing Days MINUS Absent Days
            const pDays = Math.max(0, billDays - absentDays);  
            
            row.querySelector('.p-days').value = pDays;  
            window.updateDateVisuals(row, billStart, billEnd);  
            
            rowStates.push({ index: index, pDays: pDays, row: row });
        });

        if (billDays <= 0 || personCount === 0) {
            rowStates.forEach(state => {
                const extraAmt = parseFloat(state.row.querySelector('.extra-amt').value) || 0;
                state.row.querySelector('.p-share').value = "0.00";
                state.row.querySelector('.p-total').value = extraAmt.toFixed(2);
            });
            return;  
        }

        let baseRatePerDay = (sumBills > 0) ? sumBills / (billDays * personCount) : 0;  
        let partialSum = 0;  
        let fullTimeCount = 0;

        rowStates.forEach(state => {
            let isFullTime = (state.pDays >= billDays);  
            state.type = isFullTime ? 'full' : 'partial';
            state.shareCost = (!isFullTime) ? baseRatePerDay * state.pDays : 0;   

            if (!isFullTime) {
                partialSum += state.shareCost; 
            } else {
                fullTimeCount++;  
            }
        });

        const remainder = Math.max(0, sumBills - partialSum);  
        const fullTimeShare = fullTimeCount > 0 ? (remainder / fullTimeCount) : 0;

        rowStates.forEach(state => {  
            const badge = state.row.querySelector('.p-status');  
            let finalShare = (state.type === 'partial') ? state.shareCost : fullTimeShare;  

            if(badge) {  
                badge.className = `status-badge ${state.type === 'partial' ? 'status-partial' : 'status-full'} p-status`;  
                badge.innerText = state.type === 'partial' ? 'Partial' : 'Full';  
            }  

            const extraAmt = parseFloat(state.row.querySelector('.extra-amt').value) || 0;  
            
            state.row.querySelector('.p-share').value = finalShare.toFixed(2);  
            state.row.querySelector('.p-total').value = (finalShare + extraAmt).toFixed(2);  
        });

    } catch(error) {
        console.error("Calculator Error:", error);
    }
}  

window.updateDateVisuals = function(row, bStart, bEnd) {  
    const inputs = row.querySelectorAll('.p-date-from, .p-date-to');
    const pStart = row.querySelector('.p-date-from').value;  
    const pEnd = row.querySelector('.p-date-to').value;  
    
    // Only show warning if dates are entered AND they fall outside the bill period
    if (pStart && pEnd && (pStart < bStart || pEnd > bEnd)) {
        inputs.forEach(i => i.classList.add('warning-date'));
    } else {
        inputs.forEach(i => i.classList.remove('warning-date'));  
    }
}

// ==========================================
// FIREBASE CLOUD DATABASE ENGINE
// ==========================================
window.submitData = function() {  
    if(!confirm("Are you sure you want to SAVE this entry?")) return;
    window.toggleLoading(true);  
    let billsSummary = [];  
    document.querySelectorAll('.bill-row').forEach(row => {  
        const n = row.querySelector('.bill-name').value;  
        const a = row.querySelector('.bill-amt').value;  
        if(n && a) billsSummary.push(n + ": " + a);  
    });

    const packet = {  
        batchId: Date.now().toString(),
        timestamp: Date.now(),
        billsSummary: billsSummary.join(', '),  
        totalBillAmount: totalBillAmount,  
        billStart: document.getElementById('billStart').value,  
        billEnd: document.getElementById('billEnd').value,  
        billDays: document.getElementById('displayBillDays').innerText,  
        people: []  
    };

    document.querySelectorAll('#peopleBody tr').forEach(row => {  
        packet.people.push({  
            name: row.getAttribute('data-name'),  
            dateFrom: row.querySelector('.p-date-from').value,  
            dateTo: row.querySelector('.p-date-to').value,  
            daysConsumed: row.querySelector('.p-days').value,  
            shareAmount: row.querySelector('.p-share').value,  
            extraNote: row.querySelector('.extra-name').value,  
            extraAmount: row.querySelector('.extra-amt').value || 0,  
            totalPay: row.querySelector('.p-total').value  
        });  
    });

    push(ref(db, 'happyhome/reports'), packet).then(() => {
        alert("Saved Successfully to Cloud!"); 
        window.toggleLoading(false); 
        window.loadReport(); 
    }).catch(err => {
        alert("Save Failed: " + err); 
        window.toggleLoading(false);
    });
}  

window.loadReport = function() {  
    const tbody = document.getElementById('reportBody');
    const statusDiv = document.getElementById('historyStatus');  
    tbody.innerHTML = '';  
    statusDiv.innerText = "Fetching data...";  
    statusDiv.style.display = 'block';  

    const dbRef = ref(db);
    get(child(dbRef, `happyhome/reports`)).then((snapshot) => {
        statusDiv.style.display = 'none';  
        if(snapshot.exists()) {
            const data = [];
            snapshot.forEach(childSnapshot => {
                data.push(childSnapshot.val());
            });
            
            data.sort((a,b) => b.timestamp - a.timestamp);
            cachedReportData = data;  

            if(data.length === 0) { 
                statusDiv.innerText = "No history found."; 
                statusDiv.style.display = 'block'; 
                return; 
            }  

            data.forEach((packet, idx) => {  
                const rowHtml = `  
                    <tr class="history-row" onclick="window.loadEntry(${idx})" title="Click to load this record">  
                        <td style="padding-left: 15px; padding-top: 8px; padding-bottom: 8px;">
                            <div class="history-period-text">
                                <span>${packet.billStart} to ${packet.billEnd}</span>
                                <span class="load-badge"><i class="bi bi-cloud-download"></i> LOAD</span>
                            </div>
                        </td>  
                        <td class="total-cell" style="text-align: right; padding-right: 15px;">${parseFloat(packet.totalBillAmount).toFixed(2)}</td>  
                    </tr>`;
                tbody.insertAdjacentHTML('beforeend', rowHtml);  
            });
        } else {
            statusDiv.innerText = "No history found.";
            statusDiv.style.display = 'block'; 
        }
    }).catch(err => {
        statusDiv.innerText = "Error loading history."; 
        console.error(err);
    });
}  

window.loadEntry = function(idx) {  
    if(!confirm("Overwrite current dashboard with this old data?")) return;
    const master = cachedReportData[idx];  
    
    document.getElementById('billStart').value = master.billStart;  
    document.getElementById('billEnd').value = master.billEnd;  
    
    const billContainer = document.getElementById('bill-container');  
    billContainer.innerHTML = '';

    const items = master.billsSummary ? master.billsSummary.split(', ') : [];  
    if(items.length > 0) {  
        items.forEach(item => { 
            const parts = item.split(': '); 
            if(parts.length === 2) window.addBillRow(parts[0], parts[1]); 
        });
    } else { 
        window.addBillRow("Total Loaded", master.totalBillAmount);
    }  

    const rows = document.querySelectorAll('#peopleBody tr');
    if(master.people && Array.isArray(master.people)) {
        master.people.forEach(rec => {  
            for(let r of rows) {  
                if(r.getAttribute('data-name') === rec.name) {  
                    r.querySelector('.p-date-from').value = rec.dateFrom; 
                    r.querySelector('.p-date-to').value = rec.dateTo;  
                    r.querySelector('.extra-name').value = rec.extraNote;  
                    r.querySelector('.extra-amt').value = rec.extraAmount;  
                    break;  
                }  
            }  
        });
    }

    // This guarantees the global badge resets based on the newly loaded dates
    window.calculateAll();  
    
    const tabEl = document.querySelector('#mainTab button[data-bs-target="#dash"]');
    const tab = new bootstrap.Tab(tabEl);  
    tab.show();  
}

// ==========================================
// UI SHARING ENGINE
// ==========================================
function escapeHtml(text) { return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : text; }  

window.showRemindersModal = function() {  
    const body = document.getElementById('reminderBody');
    body.innerHTML = '';  
    const start = document.getElementById('billStart').value;  
    const end = document.getElementById('billEnd').value;  
    const invoiceDate = new Date().toISOString().split('T')[0];

    document.querySelectorAll('#peopleBody tr').forEach(row => {  
        const name = row.getAttribute('data-name');  
        const total = row.querySelector('.p-total').value;  
        const share = row.querySelector('.p-share').value;  
        const extra = row.querySelector('.extra-amt').value;  
        const note = row.querySelector('.extra-name').value;  
        const days = row.querySelector('.p-days').value;  
        const status = row.querySelector('.p-status').innerText;  
        const pStart = row.querySelector('.p-date-from').value;  
        const pEnd = row.querySelector('.p-date-to').value;  
            
        const safeName = escapeHtml(name);  
        const safeNote = escapeHtml(note);  

        const div = document.createElement('div');  
        div.className = 'receipt-card';  
        div.innerHTML = `  
            <div class="receipt-header">  
                <span class="fw-bold fs-5">${safeName}</span>  
                <span class="text-muted small">Inv: ${invoiceDate}</span>  
            </div>  
            <div class="receipt-body">  
                <div class="receipt-row"><span>Period:</span> <span>${start} to ${end}</span></div>  
                <div class="receipt-row"><span>Dates Stayed:</span> <span>${pStart} to ${pEnd}</span></div>  
                <div class="receipt-row"><span>Status:</span> <span>${status} (${days}d)</span></div>  
                <hr class="my-2 opacity-25">  
                <div class="receipt-row"><span>Base Share:</span> <span>${share}</span></div>  
                <div class="receipt-row text-muted"><span>+ Extra ${safeNote ? '('+safeNote+')' : ''}:</span> <span>${extra}</span></div>  
                <div class="receipt-row total"><span>TOTAL:</span><span>${total}</span></div>  
            </div>  
            <div class="receipt-actions text-center">  
                <button class="btn btn-lg btn-success w-100 fw-bold" onclick="window.shareAsImage(this, '${safeName}')">  
                    <i class="bi bi-file-image me-2"></i> Save as Image  
                </button>  
            </div>`;
        body.appendChild(div);  
    });  
    new bootstrap.Modal(document.getElementById('reminderModal')).show();  
}  

window.shareAsImage = function(btn, filename) {  
    const card = btn.closest('.receipt-card');
    const actions = card.querySelector('.receipt-actions');  
    const originalText = btn.innerHTML;  
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...`;  
    actions.style.display = 'none';

    html2canvas(card, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true }).then(canvas => {  
        actions.style.display = 'block';  
        btn.innerHTML = originalText;  
        const link = document.createElement('a');  
        link.download = `Bill-${filename}.jpg`;  
        link.href = canvas.toDataURL("image/jpeg", 0.9);  
        link.click();  
    }).catch(err => {  
        actions.style.display = 'block';  
        btn.innerHTML = originalText;  
        alert("Error generating image: " + err);  
    });
}
