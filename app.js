// Weekly Planner App - Main JavaScript
class WeeklyPlanner {
    constructor() {
        this.currentWeek = this.getCurrentWeek();
        this.mainHours = this.generateHours(0, 23); // 00:00 - 23:00 (full grid)
        this.morningHours = this.generateHours(0, 5); // 00:00 - 05:00 (accordion)
        this.days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        this.dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        this.data = {};
        this.completedTasks = JSON.parse(localStorage.getItem('planner:completed') || '{}');
        this.saveTimeout = null;
        this.colorMap = new Map(); // Aynı text'ler için renk haritası
        this.timeIndicatorInterval = null;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        // Morning collapse durumu
        this.morningCollapsed = localStorage.getItem('planner:morning:collapsed') === 'true';

        this.init();
    }

    init() {
        this.initDarkMode();
        this.loadData();
        this.createAllGrids();
        this.applyMorningCollapse();
        this.updateWeekDisplay();
        this.bindEvents();
        this.startTimeIndicator();
        console.log('Weekly Planner initialized');
    }

    // ISO Hafta hesaplama
    getCurrentWeek() {
        const now = new Date();
        return this.getWeekFromDate(now);
    }

    getWeekFromDate(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        // ISO hafta hesabı: Pazartesi başlangıç
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        return {
            year: d.getFullYear(),
            week: weekNum
        };
    }

    getStorageKey() {
        return `planner:${this.currentWeek.year}-W${this.currentWeek.week.toString().padStart(2, '0')}`;
    }

    // Saat aralığı oluşturma
    generateHours(start, end) {
        const hours = [];
        for (let i = start; i <= end; i++) {
            hours.push(i.toString().padStart(2, '0') + ':00');
        }
        return hours;
    }

    // Veri yükleme ve kaydetme
    loadData() {
        const storageKey = this.getStorageKey();
        try {
            const saved = localStorage.getItem(storageKey);
            this.data = saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Veri yüklenirken hata:', error);
            this.data = {};
        }
    }

    saveData() {
        const storageKey = this.getStorageKey();
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.data));
        } catch (error) {
            console.error('Veri kaydedilirken hata:', error);
        }
    }

    debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveData();
        }, 300);
    }

    // Dark Mode İşlevleri
    initDarkMode() {
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode.toString());
        
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // Renk Sistemi
    getColorForText(text) {
        if (!text || text.trim() === '') return null;
        
        const normalizedText = text.trim().toLowerCase();
        
        if (this.colorMap.has(normalizedText)) {
            return this.colorMap.get(normalizedText);
        }
        
        // Tatlı renk paleti
        const colors = [
            { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }, // Amber
            { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }, // Blue
            { bg: '#d1fae5', border: '#10b981', text: '#065f46' }, // Emerald
            { bg: '#fce7f3', border: '#ec4899', text: '#be185d' }, // Pink
            { bg: '#e0e7ff', border: '#8b5cf6', text: '#5b21b6' }, // Violet
            { bg: '#fed7d7', border: '#f56565', text: '#c53030' }, // Red
            { bg: '#c6f6d5', border: '#48bb78', text: '#2f855a' }, // Green
            { bg: '#fbb6ce', border: '#ed64a6', text: '#b83280' }, // Rose
            { bg: '#bee3f8', border: '#4299e1', text: '#2b6cb0' }, // Light Blue
            { bg: '#faf089', border: '#ecc94b', text: '#b7791f' }, // Yellow
        ];
        
        // Hash tabanlı renk seçimi (aynı text her zaman aynı rengi alsın)
        let hash = 0;
        for (let i = 0; i < normalizedText.length; i++) {
            const char = normalizedText.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit integer'a çevir
        }
        const colorIndex = Math.abs(hash) % colors.length;
        const selectedColor = colors[colorIndex];
        
        this.colorMap.set(normalizedText, selectedColor);
        return selectedColor;
    }

    applyCellColor(cell, text) {
        const color = this.getColorForText(text);
        
        if (color && text.trim() !== '') {
            cell.style.backgroundColor = color.bg;
            cell.style.borderLeft = `3px solid ${color.border}`;
            cell.style.color = color.text;
            cell.classList.add('colored-cell');
        } else {
            cell.style.backgroundColor = '';
            cell.style.borderLeft = '';
            cell.style.color = '';
            cell.classList.remove('colored-cell');
        }
    }

    // Zaman kontrolü ve işaretleme fonksiyonları
    isPastTime(dayKey, hour) {
        const now = new Date();
        const currentWeek = this.getWeekFromDate(now);
        
        // Sadece mevcut hafta için geçmiş kontrolü yap
        if (currentWeek.year !== this.currentWeek.year || currentWeek.week !== this.currentWeek.week) {
            return false;
        }

        const dayIndex = this.dayKeys.indexOf(dayKey);
        const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Pazartesi=0
        const currentHour = now.getHours();
        const slotHour = parseInt(hour.split(':')[0]);

        // Geçmiş günler
        if (dayIndex < currentDayIndex) {
            return true;
        }
        
        // Bugün ve geçmiş saatler
        if (dayIndex === currentDayIndex && slotHour < currentHour) {
            return true;
        }

        return false;
    }

    createCompletionCheckbox(slotId) {
        const checkbox = document.createElement('div');
        checkbox.className = 'completion-checkbox';
        checkbox.setAttribute('data-slot', slotId);
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(slotId);
        });
        return checkbox;
    }

    toggleTaskCompletion(slotId) {
        const isCompleted = this.completedTasks[slotId];
        
        if (isCompleted) {
            delete this.completedTasks[slotId];
        } else {
            this.completedTasks[slotId] = true;
        }

        localStorage.setItem('planner:completed', JSON.stringify(this.completedTasks));
        
        // UI'ı güncelle - sol kenarlık sistemi
        const cell = document.querySelector(`[data-slot="${slotId}"]`);
        const checkbox = cell.querySelector('.completion-checkbox');
        
        if (this.completedTasks[slotId]) {
            checkbox.classList.add('completed');
            cell.classList.add('task-completed');
        } else {
            checkbox.classList.remove('completed');
            cell.classList.remove('task-completed');
        }
    }

    markCurrentDay() {
        const now = new Date();
        const currentWeek = this.getWeekFromDate(now);
        
        // Sadece mevcut hafta için işaretle
        if (currentWeek.year !== this.currentWeek.year || currentWeek.week !== this.currentWeek.week) {
            return;
        }

        const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Pazartesi=0
        
        // Gün başlığını işaretle
        const dayHeaders = document.querySelectorAll('.day-header');
        if (dayHeaders[currentDayIndex]) {
            dayHeaders[currentDayIndex].classList.add('current-day');
        }

        // Current day cells styling - tüm hücreleri işaretle
        const currentDayKey = this.dayKeys[currentDayIndex];
        const allCells = document.querySelectorAll(`[data-slot^="${currentDayKey}-"]`);
        allCells.forEach(cell => {
            cell.classList.add('current-day-cell');
        });
    }

    markPastTimes() {
        // Geçmiş saatleri işaretle ve checkbox ekle
        this.dayKeys.forEach(dayKey => {
            [...this.morningHours, ...this.mainHours].forEach(hour => {
                if (this.isPastTime(dayKey, hour)) {
                    const cell = document.querySelector(`[data-slot="${dayKey}-${hour}"]`);
                    if (cell && !cell.classList.contains('past-time')) {
                        const slotId = `${dayKey}-${hour}`;
                        const checkbox = this.createCompletionCheckbox(slotId);
                        cell.appendChild(checkbox);
                        cell.classList.add('past-time');

                        // Tamamlanmış ise işaretle - checkbox ve sol kenarlık
                        if (this.completedTasks[slotId]) {
                            checkbox.classList.add('completed');
                            cell.classList.add('task-completed');
                        }
                    }
                }
            });
        });
    }

    // Morning Collapse İşlevleri
    toggleMorningCollapse() {
        this.morningCollapsed = !this.morningCollapsed;
        localStorage.setItem('planner:morning:collapsed', this.morningCollapsed.toString());
        this.applyMorningCollapse();
    }

    applyMorningCollapse() {
        const toggle = document.getElementById('morningToggle');
        const grid = document.getElementById('plannerGrid');
        
        if (this.morningCollapsed) {
            // Morning saatleri gizle
            grid.classList.add('morning-collapsed');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.title = '00:00–05:00 aralığını göster';
        } else {
            // Morning saatleri göster
            grid.classList.remove('morning-collapsed');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.title = '00:00–05:00 aralığını gizle';
        }
    }

    // Grid oluşturma (ana fonksiyon)
    createAllGrids() {
        this.createGrid('plannerGrid', this.mainHours, true);
        this.markCurrentDay();
        this.markPastTimes();
    }

    createGrid(gridId, hours, includeDayHeaders = false) {
        const grid = document.getElementById(gridId);
        grid.innerHTML = '';

        if (includeDayHeaders) {
            // Boş köşe hücresi
            const corner = document.createElement('div');
            corner.className = 'time-header';
            corner.textContent = '';
            
            // Sadece ana grid için corner'ı işaretle  
            if (gridId === 'plannerGrid') {
                corner.id = 'mainGridCorner';
                corner.style.position = 'relative';
            }
            
            grid.appendChild(corner);

            // Gün başlıkları
            this.days.forEach(day => {
                const dayHeader = document.createElement('div');
                dayHeader.className = 'day-header';
                dayHeader.textContent = day;
                grid.appendChild(dayHeader);
            });
        }

        // Saat satırları
        hours.forEach(hour => {
            // Saat başlığı
            const timeHeader = document.createElement('div');
            timeHeader.className = 'time-header';
            timeHeader.textContent = hour;
            timeHeader.setAttribute('data-hour', hour);
            grid.appendChild(timeHeader);

            // Her gün için hücre
            this.dayKeys.forEach(dayKey => {
                const cell = document.createElement('div');
                cell.className = 'planner-cell';
                cell.contentEditable = true;
                cell.setAttribute('data-slot', `${dayKey}-${hour}`);
                cell.setAttribute('tabindex', '0');
                cell.setAttribute('role', 'textbox');
                cell.setAttribute('aria-label', `${this.days[this.dayKeys.indexOf(dayKey)]} ${hour}`);

                // Kayıtlı veri varsa yükle
                const slotId = `${dayKey}-${hour}`;
                if (this.data[slotId]) {
                    cell.textContent = this.data[slotId];
                    this.applyCellColor(cell, this.data[slotId]);
                }

                // Completion checkbox ekle
                if (this.isPastTime(dayKey, hour)) {
                    const checkbox = this.createCompletionCheckbox(slotId);
                    cell.appendChild(checkbox);
                    cell.classList.add('past-time');
                }

                // Tamamlanmış görevleri işaretle - checkbox ve sol kenarlık
                if (this.completedTasks[slotId]) {
                    const checkbox = cell.querySelector('.completion-checkbox');
                    if (checkbox) {
                        checkbox.classList.add('completed');
                        cell.classList.add('task-completed');
                    }
                }

                // Event listener'ları ekle
                this.addCellEventListeners(cell);
                grid.appendChild(cell);
            });
        });
    }

    addCellEventListeners(cell) {
        // Veri kaydetme
        const saveContent = () => {
            const slotId = cell.getAttribute('data-slot');
            const content = cell.textContent.trim();
            
            if (content === '') {
                delete this.data[slotId];
                this.applyCellColor(cell, '');
            } else {
                this.data[slotId] = content;
                this.applyCellColor(cell, content);
            }
            
            // Diğer aynı içeriğe sahip hücreleri güncelle - geçici olarak devre dışı
            // this.updateMatchingCells(content);
            this.debouncedSave();
        };

        cell.addEventListener('input', saveContent);
        cell.addEventListener('blur', saveContent);

        // Enter tuşu davranışı
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                cell.blur();
            }
        });

        // Klavye navigasyonu (opsiyonel)
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cell.blur();
            }
        });
    }

    updateMatchingCells(content) {
        if (!content || content.trim() === '') return;
        
        const normalizedContent = content.trim().toLowerCase();
        const allCells = document.querySelectorAll('.planner-cell');
        
        allCells.forEach(cell => {
            const cellContent = cell.textContent.trim();
            if (cellContent.toLowerCase() === normalizedContent) {
                this.applyCellColor(cell, cellContent);
            }
        });
    }

    // Time Indicator İşlevleri
    startTimeIndicator() {
        this.updateTimeIndicator();
        // Her dakika güncelle
        this.timeIndicatorInterval = setInterval(() => {
            this.updateTimeIndicator();
        }, 60000);
    }

    updateTimeIndicator() {
        // Önceki indicator'ı temizle
        const existingIndicator = document.querySelector('.time-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        const now = new Date();
        const currentWeek = this.getWeekFromDate(now);
        
        // Sadece mevcut hafta görüntüleniyorsa indicator göster
        if (currentWeek.year !== this.currentWeek.year || currentWeek.week !== this.currentWeek.week) {
            return;
        }

        const dayOfWeek = now.getDay();
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Pazartesi=0, Pazar=6
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Saat aralığında mı kontrol et (0-6: sabah, 7-22: ana, 23: gece)
        if (currentHour < 0 || currentHour > 23) return;

        const currentTime = currentHour + (currentMinute / 60);
        const dayKey = this.dayKeys[dayIndex];
        const hourString = currentHour.toString().padStart(2, '0') + ':00';

        // Hangi grid'de olduğunu belirle
        let gridContainer = null;
        if (currentHour >= 0 && currentHour <= 6) {
            // Sabah akordeonunda
            if (this.accordionState.morning === 'open') {
                gridContainer = '#morningGrid';
            }
        } else if (currentHour >= 7 && currentHour <= 23) {
            // Ana grid'de (7-23 arası tüm saatler)
            gridContainer = '#plannerGrid';
        }

        if (!gridContainer) return;

        // İlgili hücreyi bul
        const targetCell = document.querySelector(`${gridContainer} [data-slot="${dayKey}-${hourString}"]`);
        if (!targetCell) return;

        // Indicator oluştur
        const indicator = document.createElement('div');
        indicator.className = 'time-indicator';
        
        // Hücre içindeki pozisyonu hesapla (dakikaya göre)
        const minutePercent = (currentMinute / 60) * 100;
        indicator.style.top = `${minutePercent}%`;
        
        targetCell.style.position = 'relative';
        targetCell.appendChild(indicator);
    }

    // Hafta navigasyonu
    navigateWeek(direction) {
        const date = this.getDateFromWeek(this.currentWeek);
        date.setDate(date.getDate() + (direction * 7));
        this.currentWeek = this.getWeekFromDate(date);
        this.loadData();
        this.createAllGrids();
        this.updateWeekDisplay();
    }

    goToCurrentWeek() {
        this.currentWeek = this.getCurrentWeek();
        this.loadData();
        this.createAllGrids();
        this.updateWeekDisplay();
    }

    getDateFromWeek(week) {
        const simple = new Date(week.year, 0, 1 + (week.week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4)
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        else
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        return ISOweekStart;
    }

    // Hafta görüntüsünü güncelleme
    updateWeekDisplay() {
        const weekDisplay = document.getElementById('weekDisplay');
        const dateRange = document.getElementById('dateRange');

        weekDisplay.textContent = `${this.currentWeek.year} • Hafta ${this.currentWeek.week}`;

        // Tarih aralığını hesapla
        const weekStart = this.getDateFromWeek(this.currentWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const formatDate = (date) => {
            return date.toLocaleDateString('tr-TR', { 
                day: 'numeric', 
                month: 'short' 
            });
        };

        dateRange.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    }

    // Temizleme fonksiyonları
    clearCurrentWeek() {
        if (confirm('Bu haftanın tüm notlarını silmek istediğinizden emin misiniz?')) {
            this.data = {};
            this.saveData();
            this.createAllGrids();
        }
    }

    clearAllData() {
        if (confirm('TÜM haftalardaki notlarınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
            // Tüm planner anahtarlarını bul ve sil
            const keysToDelete = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('planner:')) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => localStorage.removeItem(key));
            this.data = {};
            this.createAllGrids();
            
            alert('Tüm veriler silindi.');
        }
    }

    // Event bağlama
    bindEvents() {
        document.getElementById('prevWeek').addEventListener('click', () => {
            this.navigateWeek(-1);
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            this.navigateWeek(1);
        });

        document.getElementById('currentWeek').addEventListener('click', () => {
            this.goToCurrentWeek();
        });

        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Akordeon toggle event'leri
        document.getElementById('morningToggle').addEventListener('click', () => {
            this.toggleMorningCollapse();
        });

        // Morning toggle klavye desteği
        document.getElementById('morningToggle').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleMorningCollapse();
            }
        });

        document.getElementById('clearWeek').addEventListener('click', () => {
            this.clearCurrentWeek();
        });

        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAllData();
        });

        // Klavye kısayolları
        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('planner-cell')) return;
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.navigateWeek(-1);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.navigateWeek(1);
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.goToCurrentWeek();
                        break;
                }
            }
        });
    }
}

// Uygulama başlatma
document.addEventListener('DOMContentLoaded', () => {
    new WeeklyPlanner();
});

// Service Worker kaydetme (eğer varsa)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('SW kayıtlı:', registration.scope);
            })
            .catch((error) => {
                console.log('SW kayıt hatası:', error);
            });
    });
}
