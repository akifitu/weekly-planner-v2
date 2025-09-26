// Weekly Planner App - Main JavaScript
class WeeklyPlanner {
    constructor() {
        this.currentWeek = this.getCurrentWeek();
        this.mainHours = this.generateTimeBlocks(); // 3 saatlik bloklar (full grid)
        this.morningHours = []; // Morning collapse sistemi kaldırıldı
        this.days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        this.dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        this.data = {};
        this.completedTasks = JSON.parse(localStorage.getItem('planner:completed') || '{}');
        this.weeklyGoals = JSON.parse(localStorage.getItem('planner:weekly-goals') || '{}');
        this.dailyRatings = JSON.parse(localStorage.getItem('planner:daily-ratings') || '{}');
        this.habits = JSON.parse(localStorage.getItem('planner:habits') || '[]');
        this.habitCheckboxes = JSON.parse(localStorage.getItem('planner:habit-checkboxes') || '{}');
        this.saveTimeout = null;
        this.colorMap = new Map(); // Aynı text'ler için renk haritası
        this.timeIndicatorInterval = null;
        this.currentTheme = localStorage.getItem('theme') || 'light'; // light, dark, sepia
        
        // Morning collapse sistemı kaldırıldı (3 saatlik bloklar ile gerek yok)
        // Habits collapse durumu
        this.habitsCollapsed = localStorage.getItem('planner:habits:collapsed') === 'false';

        this.init();
    }

    init() {
        this.initTheme();
        this.loadData();
        this.loadWeeklyGoal();
        this.createAllGrids();
        this.createHabitsGrid();
        this.applyHabitsCollapse();
        this.updateWeekDisplay();
        this.bindEvents();
        this.startTimeIndicator();
        console.log('Weekly Planner initialized with 3-hour blocks');
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

    // 3 saatlik zaman blokları oluşturma
    generateTimeBlocks() {
        const blocks = [];
        // 24 saati 3'erli bloklara böl: 00-03, 03-06, 06-09, 09-12, 12-15, 15-18, 18-21, 21-24
        for (let i = 0; i < 24; i += 3) {
            const startHour = i.toString().padStart(2, '0');
            const endHour = (i + 3).toString().padStart(2, '0');
            blocks.push(`${startHour}:00-${endHour}:00`);
        }
        return blocks;
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

    // Haftalık Hedef İşlevleri
    loadWeeklyGoal() {
        const weekKey = this.getStorageKey();
        const goalInput = document.getElementById('weeklyGoal');
        if (goalInput && this.weeklyGoals[weekKey]) {
            goalInput.value = this.weeklyGoals[weekKey];
        }
    }

    saveWeeklyGoal() {
        const weekKey = this.getStorageKey();
        const goalInput = document.getElementById('weeklyGoal');
        if (goalInput) {
            const goal = goalInput.value.trim();
            if (goal) {
                this.weeklyGoals[weekKey] = goal;
            } else {
                delete this.weeklyGoals[weekKey];
            }
            localStorage.setItem('planner:weekly-goals', JSON.stringify(this.weeklyGoals));
        }
    }

    debouncedSaveWeeklyGoal() {
        if (this.goalSaveTimeout) {
            clearTimeout(this.goalSaveTimeout);
        }
        this.goalSaveTimeout = setTimeout(() => {
            this.saveWeeklyGoal();
        }, 500);
    }

    // Günlük Puanlama İşlevleri
    isPastDay(dayIndex) {
        const now = new Date();
        const currentWeek = this.getWeekFromDate(now);
        
        // Sadece mevcut hafta için geçmiş kontrolü yap
        if (currentWeek.year !== this.currentWeek.year || currentWeek.week !== this.currentWeek.week) {
            return false;
        }

        const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Pazartesi=0
        return dayIndex < currentDayIndex;
    }

    createDayRatingInput(dayIndex) {
        const weekKey = this.getStorageKey();
        const dayKey = this.dayKeys[dayIndex];
        const ratingKey = `${weekKey}-${dayKey}`;
        
        const ratingContainer = document.createElement('div');
        ratingContainer.className = 'day-rating-container';
        
        const ratingInput = document.createElement('input');
        ratingInput.type = 'number';
        ratingInput.min = '1';
        ratingInput.max = '10';
        ratingInput.className = 'day-rating-input';
        ratingInput.placeholder = '/10';
        ratingInput.title = 'Bu günü 1-10 arasında puanla';
        
        // Kayıtlı değer varsa yükle
        if (this.dailyRatings[ratingKey]) {
            ratingInput.value = this.dailyRatings[ratingKey];
            this.applyRatingColor(ratingInput, this.dailyRatings[ratingKey]);
        }

        // Event listener ekle
        ratingInput.addEventListener('input', (e) => {
            const rating = parseInt(e.target.value);
            if (rating >= 1 && rating <= 10) {
                this.dailyRatings[ratingKey] = rating;
                this.applyRatingColor(ratingInput, rating);
                localStorage.setItem('planner:daily-ratings', JSON.stringify(this.dailyRatings));
            } else if (e.target.value === '') {
                delete this.dailyRatings[ratingKey];
                ratingInput.style.backgroundColor = '';
                ratingInput.style.borderColor = '';
                ratingInput.style.color = '';
                localStorage.setItem('planner:daily-ratings', JSON.stringify(this.dailyRatings));
            }
        });

        ratingContainer.appendChild(ratingInput);
        return ratingContainer;
    }

    applyRatingColor(input, rating) {
        // 1-4: Kırmızı tonları, 5-6: Sarı, 7-10: Yeşil tonları
        let bgColor, borderColor, textColor;
        
        if (rating <= 4) {
            // Kırmızı tonları (1=koyu kırmızı, 4=açık kırmızı)
            const intensity = (rating - 1) / 3; // 0-1 arası
            bgColor = `hsl(0, 70%, ${85 - intensity * 15}%)`;
            borderColor = `hsl(0, 70%, ${50 - intensity * 10}%)`;
            textColor = `hsl(0, 70%, ${20 + intensity * 10}%)`;
        } else if (rating <= 6) {
            // Sarı tonları
            const intensity = (rating - 5) / 1; // 0-1 arası
            bgColor = `hsl(45, 80%, ${85 - intensity * 10}%)`;
            borderColor = `hsl(45, 80%, ${60 - intensity * 10}%)`;
            textColor = `hsl(45, 80%, ${30 + intensity * 10}%)`;
        } else {
            // Yeşil tonları (7=açık yeşil, 10=koyu yeşil)
            const intensity = (rating - 7) / 3; // 0-1 arası
            bgColor = `hsl(120, 60%, ${85 - intensity * 15}%)`;
            borderColor = `hsl(120, 60%, ${50 - intensity * 10}%)`;
            textColor = `hsl(120, 60%, ${25 + intensity * 5}%)`;
        }

        input.style.backgroundColor = bgColor;
        input.style.borderColor = borderColor;
        input.style.color = textColor;
        input.style.fontWeight = '600';
    }

    // Habits İşlevleri
    toggleHabitsCollapse() {
        this.habitsCollapsed = !this.habitsCollapsed;
        localStorage.setItem('planner:habits:collapsed', this.habitsCollapsed.toString());
        this.applyHabitsCollapse();
    }

    applyHabitsCollapse() {
        const toggle = document.getElementById('habitsToggle');
        const section = document.querySelector('.habits-section');
        
        if (this.habitsCollapsed) {
            section.classList.add('collapsed');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.title = 'Alışkanlıkları göster';
        } else {
            section.classList.remove('collapsed');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.title = 'Alışkanlıkları gizle';
        }
    }

    addHabit() {
        const newHabit = {
            id: Date.now().toString(),
            name: 'Yeni Alışkanlık',
            score: 5
        };
        this.habits.push(newHabit);
        this.saveHabits();
        this.createHabitsGrid();
    }

    deleteHabit(habitId) {
        if (confirm('Bu alışkanlığı silmek istediğinizden emin misiniz?')) {
            this.habits = this.habits.filter(habit => habit.id !== habitId);
            this.saveHabits();
            this.createHabitsGrid();
            this.recalculateAllDailyScores();
        }
    }

    updateHabit(habitId, field, value) {
        const habit = this.habits.find(h => h.id === habitId);
        if (habit) {
            habit[field] = value;
            this.saveHabits();
            if (field === 'score') {
                this.recalculateAllDailyScores();
            }
        }
    }

    saveHabits() {
        localStorage.setItem('planner:habits', JSON.stringify(this.habits));
    }

    createHabitsGrid() {
        const grid = document.getElementById('habitsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';

        // Header row
        // Score header
        const scoreHeader = document.createElement('div');
        scoreHeader.className = 'habit-score-header';
        scoreHeader.textContent = 'Puan';
        grid.appendChild(scoreHeader);

        // Name header
        const nameHeader = document.createElement('div');
        nameHeader.className = 'habit-name-header';
        nameHeader.textContent = 'Alışkanlık';
        grid.appendChild(nameHeader);

        // Day headers (using same as main grid)
        this.days.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'habit-score-header';
            dayHeader.textContent = day.substring(0, 3); // İlk 3 harf
            grid.appendChild(dayHeader);
        });

        // Habit rows
        this.habits.forEach(habit => {
            this.createHabitRow(grid, habit);
        });
    }

    createHabitRow(grid, habit) {
        // Score input
        const scoreCell = document.createElement('div');
        scoreCell.className = 'habit-checkbox-cell';
        const scoreInput = document.createElement('input');
        scoreInput.type = 'number';
        scoreInput.min = '1';
        scoreInput.max = '50';
        scoreInput.className = 'habit-score-input';
        scoreInput.value = habit.score;
        scoreInput.addEventListener('change', (e) => {
            const newScore = parseInt(e.target.value) || 5;
            this.updateHabit(habit.id, 'score', Math.max(1, Math.min(50, newScore)));
        });
        scoreCell.appendChild(scoreInput);
        grid.appendChild(scoreCell);

        // Name input
        const nameCell = document.createElement('div');
        nameCell.className = 'habit-checkbox-cell habit-name-cell';
        nameCell.style.position = 'relative';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'habit-name-input';
        nameInput.value = habit.name;
        nameInput.addEventListener('change', (e) => {
            this.updateHabit(habit.id, 'name', e.target.value || 'Alışkanlık');
        });
        nameCell.appendChild(nameInput);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'habit-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Alışkanlığı sil';
        deleteBtn.addEventListener('click', () => {
            this.deleteHabit(habit.id);
        });
        nameCell.appendChild(deleteBtn);
        grid.appendChild(nameCell);

        // Daily checkboxes
        this.dayKeys.forEach(dayKey => {
            const checkboxCell = document.createElement('div');
            checkboxCell.className = 'habit-checkbox-cell';
            
            const checkbox = document.createElement('div');
            checkbox.className = 'habit-checkbox';
            checkbox.setAttribute('data-habit', habit.id);
            checkbox.setAttribute('data-day', dayKey);
            
            const weekKey = this.getStorageKey();
            const checkboxKey = `${weekKey}-${habit.id}-${dayKey}`;
            
            if (this.habitCheckboxes[checkboxKey]) {
                checkbox.classList.add('checked');
            }

            checkbox.addEventListener('click', () => {
                this.toggleHabitCheckbox(habit.id, dayKey);
            });

            checkboxCell.appendChild(checkbox);
            grid.appendChild(checkboxCell);
        });
    }

    toggleHabitCheckbox(habitId, dayKey) {
        const weekKey = this.getStorageKey();
        const checkboxKey = `${weekKey}-${habitId}-${dayKey}`;
        const checkbox = document.querySelector(`[data-habit="${habitId}"][data-day="${dayKey}"]`);
        
        if (this.habitCheckboxes[checkboxKey]) {
            delete this.habitCheckboxes[checkboxKey];
            checkbox.classList.remove('checked');
        } else {
            this.habitCheckboxes[checkboxKey] = true;
            checkbox.classList.add('checked');
        }
        
        localStorage.setItem('planner:habit-checkboxes', JSON.stringify(this.habitCheckboxes));
        this.calculateAndUpdateDailyScore(dayKey);
    }

    // Otomatik Puanlama Sistemi
    calculateAndUpdateDailyScore(dayKey) {
        const dayIndex = this.dayKeys.indexOf(dayKey);
        
        // Sadece geçmiş günler için puanla
        if (!this.isPastDay(dayIndex)) {
            return;
        }

        // Gün için tüm 3 saatlik blokları say
        const daySlots = this.mainHours; // Artık sadece mainHours (8 adet 3 saatlik blok)
        let completedSlots = 0;
        
        daySlots.forEach(timeBlock => {
            const slotId = `${dayKey}-${timeBlock}`;
            if (this.completedTasks[slotId]) {
                completedSlots++;
            }
        });

        // Habits için tamamlanan ve toplam puanları hesapla
        const weekKey = this.getStorageKey();
        let completedHabitsScore = 0;
        let totalHabitsScore = 0;

        this.habits.forEach(habit => {
            const checkboxKey = `${weekKey}-${habit.id}-${dayKey}`;
            totalHabitsScore += habit.score;
            
            if (this.habitCheckboxes[checkboxKey]) {
                completedHabitsScore += habit.score;
            }
        });

        // Toplam mümkün puan hesapla
        const totalSlots = daySlots.length;
        const totalPossibleScore = totalSlots + totalHabitsScore;
        
        // Eğer hiç görev/habit yoksa 0 puan
        if (totalPossibleScore === 0) {
            this.updateDailyRating(dayIndex, 0);
            return;
        }

        // Gerçek puan hesapla
        const achievedScore = completedSlots + completedHabitsScore;
        
        // 100 üzerinden puan hesapla
        const scorePercentage = (achievedScore / totalPossibleScore) * 100;
        
        // 10'a bölerek final puanı hesapla (1-10 arası)
        const finalScore = Math.round(scorePercentage / 10);
        const clampedScore = Math.max(1, Math.min(10, finalScore));
        
        // Günlük rating'i güncelle
        this.updateDailyRating(dayIndex, clampedScore);
    }

    updateDailyRating(dayIndex, score) {
        const weekKey = this.getStorageKey();
        const dayKey = this.dayKeys[dayIndex];
        const ratingKey = `${weekKey}-${dayKey}`;
        
        // Manuel puanlama sistemini güncelle
        this.dailyRatings[ratingKey] = score;
        localStorage.setItem('planner:daily-ratings', JSON.stringify(this.dailyRatings));
        
        // UI'daki rating input'u güncelle
        const ratingInput = document.querySelector(`[data-slot="${ratingKey}"] input, input[data-rating-key="${ratingKey}"]`);
        if (ratingInput) {
            ratingInput.value = score;
            this.applyRatingColor(ratingInput, score);
        }
        
        // Gün başlığındaki rating inputunu da güncelle
        this.updateDayHeaderRating(dayIndex, score);
    }

    updateDayHeaderRating(dayIndex, score) {
        // Eğer gün başlığında rating input varsa güncelle
        const dayHeaders = document.querySelectorAll('.day-header');
        if (dayHeaders[dayIndex]) {
            const ratingInput = dayHeaders[dayIndex].querySelector('.day-rating-input');
            if (ratingInput) {
                ratingInput.value = score;
                this.applyRatingColor(ratingInput, score);
            }
        }
    }

    recalculateAllDailyScores() {
        // Tüm günler için puanları yeniden hesapla
        this.dayKeys.forEach((dayKey, index) => {
            if (this.isPastDay(index)) {
                this.calculateAndUpdateDailyScore(dayKey);
            }
        });
    }

    // Theme İşlevleri
    initTheme() {
        this.applyTheme(this.currentTheme);
    }

    toggleTheme() {
        // Tema sırası: light -> dark -> sepia -> light
        const themes = ['light', 'dark', 'sepia'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        
        this.currentTheme = themes[nextIndex];
        localStorage.setItem('theme', this.currentTheme);
        this.applyTheme(this.currentTheme);
    }

    applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
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

    // Zaman kontrolü ve işaretleme fonksiyonları (3 saatlik bloklar için)
    isPastTime(dayKey, timeBlock) {
        const now = new Date();
        const currentWeek = this.getWeekFromDate(now);
        
        // Sadece mevcut hafta için geçmiş kontrolü yap
        if (currentWeek.year !== this.currentWeek.year || currentWeek.week !== this.currentWeek.week) {
            return false;
        }

        const dayIndex = this.dayKeys.indexOf(dayKey);
        const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Pazartesi=0
        const currentHour = now.getHours();
        
        // Time block'u parse et (örn: "09:00-12:00")
        const [startTime] = timeBlock.split('-');
        const [startHourStr] = startTime.split(':');
        const blockStartHour = parseInt(startHourStr);

        // Geçmiş günler
        if (dayIndex < currentDayIndex) {
            return true;
        }
        
        // Bugün ve geçmiş 3 saatlik bloklar
        if (dayIndex === currentDayIndex) {
            // Eğer şu anki saat, bloğun bitiş saatinden büyükse geçmiş
            const blockEndHour = blockStartHour + 3;
            if (currentHour >= blockEndHour) {
                return true;
            }
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
        
        // Otomatik puanlama için günlük skoru yeniden hesapla
        const dayKey = slotId.split('-')[0];
        this.calculateAndUpdateDailyScore(dayKey);
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
        // Geçmiş 3 saatlik blokları işaretle ve checkbox ekle
        this.dayKeys.forEach(dayKey => {
            this.mainHours.forEach(timeBlock => {
                if (this.isPastTime(dayKey, timeBlock)) {
                    const cell = document.querySelector(`[data-slot="${dayKey}-${timeBlock}"]`);
                    if (cell && !cell.classList.contains('past-time')) {
                        const slotId = `${dayKey}-${timeBlock}`;
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

    // Morning Collapse sistemi kaldırıldı (3 saatlik bloklar ile gerek yok)

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
            this.days.forEach((day, index) => {
                const dayHeader = document.createElement('div');
                dayHeader.className = 'day-header';
                
                const dayName = document.createElement('span');
                dayName.className = 'day-name';
                dayName.textContent = day;
                dayHeader.appendChild(dayName);
                
                // Geçmiş günler için puanlama inputu ekle
                if (this.isPastDay(index)) {
                    const ratingInput = this.createDayRatingInput(index);
                    dayHeader.appendChild(ratingInput);
                }
                
                grid.appendChild(dayHeader);
            });
        }

        // Zaman bloku satırları (3 saatlik bloklar)
        hours.forEach(timeBlock => {
            // Zaman bloku başlığı
            const timeHeader = document.createElement('div');
            timeHeader.className = 'time-header';
            timeHeader.textContent = timeBlock;
            timeHeader.setAttribute('data-timeblock', timeBlock);
            grid.appendChild(timeHeader);

            // Her gün için hücre
            this.dayKeys.forEach(dayKey => {
                const cell = document.createElement('div');
                cell.className = 'planner-cell';
                cell.contentEditable = true;
                cell.setAttribute('data-slot', `${dayKey}-${timeBlock}`);
                cell.setAttribute('tabindex', '0');
                cell.setAttribute('role', 'textbox');
                cell.setAttribute('aria-label', `${this.days[this.dayKeys.indexOf(dayKey)]} ${timeBlock}`);

                // Kayıtlı veri varsa yükle
                const slotId = `${dayKey}-${timeBlock}`;
                if (this.data[slotId]) {
                    cell.textContent = this.data[slotId];
                    this.applyCellColor(cell, this.data[slotId]);
                }

                // Completion checkbox ekle
                if (this.isPastTime(dayKey, timeBlock)) {
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
            
            // Otomatik puanlama için günlük skoru yeniden hesapla
            const dayKey = slotId.split('-')[0];
            this.calculateAndUpdateDailyScore(dayKey);
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

        // Saat aralığında mı kontrol et
        if (currentHour < 0 || currentHour > 23) return;

        const dayKey = this.dayKeys[dayIndex];
        
        // Hangi 3 saatlik blokta olduğumuzu belirle
        const blockStartHour = Math.floor(currentHour / 3) * 3;
        const blockEndHour = blockStartHour + 3;
        const targetTimeBlock = `${blockStartHour.toString().padStart(2, '0')}:00-${blockEndHour.toString().padStart(2, '0')}:00`;

        // İlgili hücreyi bul
        const targetCell = document.querySelector(`[data-slot="${dayKey}-${targetTimeBlock}"]`);
        if (!targetCell) return;

        // Indicator oluştur
        const indicator = document.createElement('div');
        indicator.className = 'time-indicator';
        
        // Hücre içindeki pozisyonu hesapla (3 saatlik blok içinde)
        const hourInBlock = currentHour - blockStartHour;
        const totalMinutesInBlock = (hourInBlock * 60) + currentMinute;
        const minutePercent = (totalMinutesInBlock / 180) * 100; // 180 dakika = 3 saat
        
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
        this.loadWeeklyGoal();
        this.createAllGrids();
        this.createHabitsGrid();
        this.updateWeekDisplay();
        this.recalculateAllDailyScores();
    }

    goToCurrentWeek() {
        this.currentWeek = this.getCurrentWeek();
        this.loadData();
        this.loadWeeklyGoal();
        this.createAllGrids();
        this.createHabitsGrid();
        this.updateWeekDisplay();
        this.recalculateAllDailyScores();
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

        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Morning toggle kaldırıldı (3 saatlik bloklar ile gerek yok)

        document.getElementById('clearWeek').addEventListener('click', () => {
            this.clearCurrentWeek();
        });

        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAllData();
        });

        // Haftalık hedef inputu
        const weeklyGoalInput = document.getElementById('weeklyGoal');
        if (weeklyGoalInput) {
            weeklyGoalInput.addEventListener('input', () => {
                this.debouncedSaveWeeklyGoal();
            });
            weeklyGoalInput.addEventListener('blur', () => {
                this.saveWeeklyGoal();
            });
        }

        // Habits toggle
        document.getElementById('habitsToggle').addEventListener('click', () => {
            this.toggleHabitsCollapse();
        });

        // Add habit button
        document.getElementById('addHabitBtn').addEventListener('click', () => {
            this.addHabit();
        });

        // Habits toggle klavye desteği
        document.getElementById('habitsToggle').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleHabitsCollapse();
            }
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
