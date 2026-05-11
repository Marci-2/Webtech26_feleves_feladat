const API_BASE = 'https://iit-playground.arondev.hu/api';

const Api = {
    getNeptun: () => document.getElementById('neptun-id').value.trim() || 'TEST01',

    async call(endpoint, method = 'GET', data = null) {
        const url = `${API_BASE}/${this.getNeptun()}${endpoint}`;
        const config = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) config.body = JSON.stringify(data);

        try {
            const response = await fetch(url, config);

            // Váratlan szerverhibák
            if (response.status >= 500) {
                throw new Error("A szerver jelenleg nem elérhető vagy belső hiba történt. Kérjük, próbálja meg később!");
            }

            // Üzleti logika hibák
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Ha a szerver küld hibaüzenetet, azt adjuk át, különben általános hiba
                throw new Error(errorData.message || `Hiba történt a művelet során (Kód: ${response.status})`);
            }

            return response.status !== 204 ? await response.json() : null;
        } catch (networkError) {
            // Hálózati hiba
            if (networkError.message.includes('Failed to fetch')) {
                throw new Error("Nincs kapcsolat a szerverrel. Ellenőrizze az internetet!");
            }
            throw networkError; // Továbbdobjuk a már feldolgozott hibát
        }
    }
};

const UI = {
    renderCars(cars) {
        const container = document.getElementById('car-table-body');
        if (!cars || cars.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="text-center">Nincs megjeleníthető autó.</td></tr>';
            return;
        }

        container.innerHTML = cars.map(car => `
            <tr>
                <td><strong>${car.brand}</strong><br><small class="text-muted">${car.model}</small></td>
                <td>${car.owner}</td>
                <td>${car.fuelUse} L/100km</td>
                <td><code class="date-display">${car.dayOfCommission}</code></td>
                <td>
                    <span class="type-badge ${car.electric ? 'electric' : 'combustion'}">
                        ${car.electric ? '⚡ Elektromos' : '⛽ Belsőégésű'}
                    </span>
                </td>
                <td class="text-right">
                    <button class="btn btn-primary btn-sm" onclick="App.loadForEdit(${car.id})">Szerkesztés</button>
                    <button class="btn btn-danger btn-sm" onclick="App.deleteCar(${car.id})">Törlés</button>
                </td>
            </tr>
        `).join('');
    },

    showView(isForm) {
        document.getElementById('section-list').classList.toggle('hidden', isForm);
        document.getElementById('section-form').classList.toggle('hidden', !isForm);
    },
    //Kiegészítő funkció, hogy a felhasználó visszajelzést kapjon a műveletekről, hibákról vagy figyelmeztetésekről.
    toast(msg, type = 'info') {
        const t = document.getElementById('toast');
        t.innerText = msg;
        
        if (type === 'error') t.style.background = '#dc2626';
        else if (type === 'warning') t.style.background = '#f59e0b';
        else t.style.background = '#0f172a';

        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 4000);
    }
};

const App = {
    async init() {
        document.getElementById('btn-refresh').onclick = () => this.fetchList();
        document.getElementById('btn-create-view').onclick = () => this.openForm();
        document.getElementById('btn-cancel').onclick = () => UI.showView(false);
        document.getElementById('car-form').onsubmit = (e) => this.save(e);
        await this.fetchList();
    },

    async fetchList() {
        try {
            const data = await Api.call('/car');
            UI.renderCars(data);
        } catch (e) {
            UI.toast(e.message, 'error');
        }
    },

    async loadForEdit(id) {
        try {
            const car = await Api.call(`/car/${id}`);
            this.openForm(car);
        } catch (e) {
            UI.toast("Nem sikerült az adatlap betöltése: " + e.message, 'error');
        }
    },

    openForm(car = null) {
        const f = document.getElementById('car-form');
        f.reset();
        document.getElementById('input-id').value = car ? car.id : "";
        document.getElementById('form-title').innerText = car ? "Autó módosítása" : "Új autó hozzáadása";
        
        if (car) {
            document.getElementById('input-brand').value = car.brand;
            document.getElementById('input-model').value = car.model;
            document.getElementById('input-owner').value = car.owner;
            document.getElementById('input-fuel').value = car.fuelUse;
            document.getElementById('input-date').value = car.dayOfCommission;
            document.getElementById('input-electric').checked = car.electric;
        }
        UI.showView(true);
    },

    // A mentés művelet most már tartalmaz kliens oldali validációkat, hogy a felhasználó azonnal visszajelzést kapjon a hibás adatbeviteli kísérletekre, még mielőtt a szerverhez fordulna.
    async save(e) {
        e.preventDefault();
        
        const id = document.getElementById('input-id').value;
        const brand = document.getElementById('input-brand').value.trim();
        const fuelUse = Number(document.getElementById('input-fuel').value);
        const isElectric = document.getElementById('input-electric').checked;
        const owner = document.getElementById('input-owner').value.trim();

        
        // 1. Márka validáció: pl ne túl rövid
        if (brand.length < 2) {
            UI.toast("A márka neve túl rövid (minimum 2 karakter)!", "warning");
            return;
        }

        // 2. Fogyasztás validáció: elektromos autónál 0, belsőégésűnél > 0
        if (isElectric && fuelUse !== 0) {
            UI.toast("Elektromos autó fogyasztása csak 0 lehet!", "warning");
            return;
        }
        if (!isElectric && fuelUse <= 0) {
            UI.toast("Belsőégésű motor esetén a fogyasztásnak 0-nál nagyobbnak kell lennie!", "warning");
            return;
        }

        // 3. Tulajdonos formátum ellenőrzése
        if (!owner.includes(" ")) {
            UI.toast("Kérjük, adja meg a tulajdonos teljes nevét (Vezetéknév Keresztnév)!", "warning");
            return;
        }

        const payload = {
            brand,
            model: document.getElementById('input-model').value.trim(),
            owner,
            fuelUse,
            dayOfCommission: document.getElementById('input-date').value,
            electric: isElectric
        };

        try {
            if (id) {
                await Api.call('/car', 'PUT', { ...payload, id: Number(id) });
                UI.toast("Sikeres módosítás!");
            } else {
                await Api.call('/car', 'POST', payload);
                UI.toast("Új autó rögzítve!");
            }
            UI.showView(false);
            await this.fetchList();
        } catch (e) {
            // VÁRATLAN SZERVERHIBÁK KEZELÉSE
            UI.toast(e.message, 'error');
        }
    },

    async deleteCar(id) {
        if (!confirm("Biztosan törölni szeretné ezt a rekordot?")) return;
        try {
            await Api.call(`/car/${id}`, 'DELETE');
            UI.toast("Rekord törölve.");
            await this.fetchList();
        } catch (e) {
            UI.toast("Törlési hiba: " + e.message, 'error');
        }
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());