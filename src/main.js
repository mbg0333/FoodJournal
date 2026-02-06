import { auth, db } from './lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { storage } from './lib/storage';
import { analyzeFood } from './lib/gemini';

// Initialize State
let currentUser = null;
let currentTempMeal = null; 
let currentDate = new Date().toISOString().split('T')[0];
let currentSettings = { geminiKey: '', calGoal: 2000, startWeight: 180, goalWeight: 160 };
let categoriesExpanded = { Breakfast: true, Lunch: true, Dinner: true, Snack: true };
let currentFavorites = [];
let allMeals = [];
let activeSearchTab = "history";
let selectionMode = false;
let selectedIds = new Set();
let checkinHistory = [];

let elements = {};

function selectElements() {
  elements = {
    authScreen: document.getElementById('auth-screen'),
    app: document.getElementById('app'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    searchBtn: document.getElementById('search-btn'),
    navItems: document.querySelectorAll('.nav-item'),
    views: { 
      journal: document.getElementById('journal-view'), 
      weight: document.getElementById('weight-view'), 
      favorites: document.getElementById('favorites-view'), 
      shopping: document.getElementById('shopping-view') 
    },
    prevDay: document.getElementById('prev-day'), 
    nextDay: document.getElementById('next-day'),
    dateDisplay: document.getElementById('current-date-display'), 
    datePickerHidden: document.getElementById('date-picker-hidden'),
    totalCals: document.getElementById('total-calories'), 
    goalCals: document.getElementById('goal-calories-display'),
    totalPro: document.getElementById('total-protein'), 
    goalPro: document.getElementById('goal-protein-display'),
    calBar: document.getElementById('cal-progress-bar'), 
    proBar: document.getElementById('pro-progress-bar'),
    waterCard: document.getElementById('water-card'), 
    currentWater: document.getElementById('current-water'),
    goalWater: document.getElementById('goal-water'), 
    waterBar: document.getElementById('water-progress-bar'),
    waterBtns: document.querySelectorAll('.water-btn'), 
    resetWater: document.getElementById('reset-water'),
    logBtn: document.getElementById('log-btn'), 
    textLog: document.getElementById('text-log'),
    voiceBtn: document.getElementById('voice-btn'), 
    photoBtn: document.getElementById('photo-btn'),
    openFavsLogBtn: document.getElementById('open-favs-log-btn'), 
    favsDropdown: document.getElementById('favs-dropdown'), 
    favsDropdownList: document.getElementById('favs-dropdown-list'),
    categorizedMeals: document.getElementById('categorized-meals'), 
    favoritesList: document.getElementById('favorites-list'),
    confirmModal: document.getElementById('confirm-modal'), 
    confirmImgPreview: document.getElementById('confirm-img-preview'), 
    confirmName: document.getElementById('confirm-name'),
    confirmCalories: document.getElementById('confirm-calories'), 
    confirmProtein: document.getElementById('confirm-protein'), 
    confirmCarbs: document.getElementById('confirm-carbs'), 
    confirmFat: document.getElementById('confirm-fat'),
    confirmCategory: document.getElementById('confirm-category'), 
    saveConfirm: document.getElementById('save-confirm'), 
    saveAsFavBtn: document.getElementById('save-as-fav-btn'), 
    deleteBtn: document.getElementById('delete-btn'),
    loadingOverlay: document.getElementById('loading-overlay'), 
    searchModal: document.getElementById('search-modal'), 
    globalSearchInput: document.getElementById('global-search-input'), 
    searchResults: document.getElementById('search-results'), 
    closeSearch: document.getElementById('close-search'),
    addCheckinBtn: document.getElementById('add-checkin-btn'),
    checkinHistoryList: document.getElementById('checkin-history'),
    goalProgress: document.getElementById('goal-progress'),
        currentWeightDisplay: document.getElementById('current-weight'),
    goalWeightDisplay: document.getElementById('goal-weight'),
    logSearchBtn: document.getElementById('log-search-btn'),
    searchTabHistory: document.getElementById('search-tab-history'),
    searchTabWeb: document.getElementById('search-tab-web'),
    triggerAiSearch: document.getElementById('trigger-ai-search'),
    aiSearchPrompt: document.getElementById('ai-search-prompt'),
    confirmTitle: document.getElementById('confirm-title')
  };
}

function init() {
  selectElements();
  setupEventListeners();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user; 
      if (elements.authScreen) elements.authScreen.style.display = 'none'; 
      if (elements.app) elements.app.style.display = 'block';
      await loadUserData();
    } else {
      currentUser = null; 
      if (elements.authScreen) elements.authScreen.style.display = 'flex'; 
      if (elements.app) elements.app.style.display = 'none';
    }
  });
}

function setupEventListeners() {
  if (elements.loginBtn) elements.loginBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
  if (elements.logoutBtn) elements.logoutBtn.onclick = () => signOut(auth);
  if (elements.prevDay) elements.prevDay.onclick = () => changeDate(-1);
  if (elements.nextDay) elements.nextDay.onclick = () => changeDate(1);
  if (elements.dateDisplay) elements.dateDisplay.onclick = () => elements.datePickerHidden.showPicker();
  if (elements.datePickerHidden) elements.datePickerHidden.onchange = (e) => { currentDate = e.target.value; updateDateDisplay(); renderJournal(); };
  
  if (elements.navItems) elements.navItems.forEach(item => {
    item.onclick = (e) => { e.preventDefault(); switchTab(item.getAttribute('data-tab')); };
  });
  
  if (elements.logBtn) elements.logBtn.onclick = () => handleLog('text');
  if (elements.textLog) elements.textLog.onkeypress = (e) => { if (e.key === 'Enter') handleLog('text'); };
  if (elements.voiceBtn) elements.voiceBtn.onclick = startVoiceRecognition;
  if (elements.photoBtn) elements.photoBtn.onclick = () => document.getElementById('photo-modal').style.display = 'flex';
  
  const closePhotoModal = document.getElementById('close-photo-modal');
  if (closePhotoModal) closePhotoModal.onclick = () => document.getElementById('photo-modal').style.display = 'none';
  
  const takePhoto = document.getElementById('take-photo-btn');
  const choosePhoto = document.getElementById('choose-photo-btn');
  if (takePhoto) takePhoto.onclick = () => { document.getElementById('photo-modal').style.display = 'none'; document.getElementById('camera-input').click(); };
  if (choosePhoto) choosePhoto.onclick = () => { document.getElementById('photo-modal').style.display = 'none'; document.getElementById('file-input').click(); };
  
  const cancelConfirm = document.getElementById('cancel-confirm');
  if (cancelConfirm) cancelConfirm.onclick = () => elements.confirmModal.style.display = 'none';

  if (elements.openFavsLogBtn) {
    elements.openFavsLogBtn.onclick = (e) => {
      e.stopPropagation();
      const drop = elements.favsDropdown;
      if (!drop) return;
      const isVisible = drop.style.display === 'block';
      drop.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) renderFavsDropdown();
    };
  }
  document.addEventListener('click', () => { if (elements.favsDropdown) elements.favsDropdown.style.display = 'none'; });

  if (elements.saveConfirm) elements.saveConfirm.onclick = async () => {
    if (!currentTempMeal) return;
    const meal = buildMealFromForm();
    showLoading(true);
    if (currentTempMeal.id) await storage.updateMeal(currentTempMeal.id, meal);
    else await storage.addMeal(meal);
    await renderJournal();
    showLoading(false);
    elements.confirmModal.style.display = 'none';
  };

  if (elements.saveAsFavBtn) elements.saveAsFavBtn.onclick = async () => {
    if (!currentTempMeal) return;
    const name = prompt("Name favorite:", currentTempMeal.name);
    if (!name) return;
    const meal = buildMealFromForm();
    showLoading(true);
    await storage.addFavorite({ ...meal, name });
    await loadUserData();
    showLoading(false);
  };

  if (elements.deleteBtn) elements.deleteBtn.onclick = async () => {
    if (!currentTempMeal || !currentTempMeal.id) return;
    if (confirm("Delete?")) {
      showLoading(true);
      await storage.deleteMeal(currentTempMeal.id);
      await renderJournal();
      showLoading(false);
      elements.confirmModal.style.display = 'none';
    }
  };

  if (elements.searchBtn) elements.searchBtn.onclick = () => { elements.searchModal.style.display = 'flex'; activeSearchTab = 'history'; updateSearchTabs(); handleSearch(''); };
  if (elements.logSearchBtn) elements.logSearchBtn.onclick = () => { elements.searchModal.style.display = 'flex'; activeSearchTab = 'history'; updateSearchTabs(); handleSearch(""); };
  if (elements.searchTabHistory) elements.searchTabHistory.onclick = () => { activeSearchTab = 'history'; updateSearchTabs(); handleSearch(elements.globalSearchInput.value); };
  if (elements.searchTabWeb) elements.searchTabWeb.onclick = () => { activeSearchTab = 'web'; updateSearchTabs(); handleSearch(elements.globalSearchInput.value); };
  if (elements.triggerAiSearch) elements.triggerAiSearch.onclick = () => handleAiWebSearch();
  if (elements.closeSearch) elements.closeSearch.onclick = () => elements.searchModal.style.display = 'none';
  if (elements.globalSearchInput) elements.globalSearchInput.oninput = (e) => handleSearch(e.target.value);

  if (elements.settingsBtn) elements.settingsBtn.onclick = () => {
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('api-key').value = currentSettings.geminiKey;
    document.getElementById('cal-goal-input').value = currentSettings.calGoal;
    document.getElementById('goal-weight-input').value = currentSettings.goalWeight;
    document.getElementById('start-weight-input').value = currentSettings.startWeight;
  };

  const closeSettings = document.getElementById('close-settings');
  if (closeSettings) closeSettings.onclick = () => document.getElementById('settings-modal').style.display = 'none';

  const saveSettings = document.getElementById('save-settings');
  if (saveSettings) saveSettings.onclick = async () => {
    currentSettings.geminiKey = document.getElementById('api-key').value.trim();
    currentSettings.calGoal = parseInt(document.getElementById('cal-goal-input').value) || 2000;
    currentSettings.goalWeight = parseFloat(document.getElementById('goal-weight-input').value) || 160;
    currentSettings.startWeight = parseFloat(document.getElementById('start-weight-input').value) || 180;
    await storage.saveSettings(currentSettings);
    localStorage.setItem('gemini_key', currentSettings.geminiKey);
    await loadUserData();
    document.getElementById('settings-modal').style.display = 'none';
  };

  if (elements.waterBtns) elements.waterBtns.forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const amt = parseInt(btn.getAttribute('data-amt'));
      const next = Math.max(0, parseInt(elements.currentWater.textContent) + amt);
      elements.currentWater.textContent = next;
      updateWaterSummary(next);
      await storage.setWater(currentDate, next);
    };
  });

  if (elements.resetWater) elements.resetWater.onclick = async (e) => {
    e.stopPropagation();
    if (confirm("Reset water?")) {
      elements.currentWater.textContent = 0;
      updateWaterSummary(0);
      await storage.setWater(currentDate, 0);
    }
  };

  const bulkBtn = document.getElementById('bulk-select-btn');
  if (bulkBtn) bulkBtn.onclick = () => { 
    selectionMode = !selectionMode; 
    selectedIds.clear(); 
    document.getElementById('bulk-actions').style.display = selectionMode ? 'block' : 'none'; 
    renderJournal(); 
  };

  const saveBulk = document.getElementById('save-bulk-fav-btn');
  if (saveBulk) saveBulk.onclick = async () => {
    if (selectedIds.size === 0) return;
    const name = prompt("Group name:");
    if (!name) return;
    const items = allMeals.filter(m => selectedIds.has(m.id));
    const agg = items.reduce((a, m) => ({ calories: a.calories + m.calories, protein: a.protein + (m.protein || 0), carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    showLoading(true);
    await storage.addFavorite({ ...agg, name, category: "Lunch", stockPhoto: "https://images.unsplash.com/photo-1547592166-23ac45744acd" });
    selectionMode = false; selectedIds.clear(); document.getElementById('bulk-actions').style.display = 'none';
    await loadUserData(); showLoading(false);
  };

  if (elements.addCheckinBtn) elements.addCheckinBtn.onclick = async () => {
    const w = prompt("Weight:");
    if (!w || isNaN(w)) return;
    const now = new Date();
    const sun = new Date(now); sun.setDate(now.getDate() - now.getDay());
    showLoading(true);
    await storage.addCheckin({ weight: parseFloat(w), date: sun.toISOString().split('T')[0] });
    await loadUserData();
    showLoading(false);
  };
}

function buildMealFromForm() {
  return {
    name: elements.confirmName.value,
    calories: parseInt(elements.confirmCalories.value),
    protein: parseInt(elements.confirmProtein.value) || 0,
    carbs: parseInt(elements.confirmCarbs.value) || 0,
    fat: parseInt(elements.confirmFat.value) || 0,
    category: elements.confirmCategory.value,
    stockPhoto: currentTempMeal.stockPhoto,
    timestamp: currentTempMeal.timestamp || new Date().toISOString()
  };
}

async function handleLog(type, data = null) {
  if (!currentSettings.geminiKey) return alert("API Key missing");
  showLoading(true);
  try {
    let input = type === 'text' ? elements.textLog.value : data;
    if (type === 'photo') input = await toBase64(data);
    const res = await analyzeFood(currentSettings.geminiKey, input, type);
    if (res) {
      currentTempMeal = { ...res, stockPhoto: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80&sig=${Date.now()}` };
      openConfirmModal(currentTempMeal, false);
    }
  } catch (e) { console.error(e); } finally { showLoading(false); }
}

function openConfirmModal(m, edit) {
  elements.confirmTitle.textContent = edit ? "Edit" : "Confirm";
  elements.confirmName.value = m.name;
  elements.confirmCalories.value = m.calories;
  elements.confirmProtein.value = m.protein || 0;
  elements.confirmCarbs.value = m.carbs || 0;
  elements.confirmFat.value = m.fat || 0;
  elements.confirmCategory.value = m.category || "Lunch";
  elements.confirmImgPreview.style.backgroundImage = `url('${m.stockPhoto}')`;
  elements.deleteBtn.style.display = edit ? "flex" : "none";
  elements.confirmModal.style.display = 'flex';
}


function updateSearchTabs() {
  elements.searchTabHistory.classList.toggle('active-tab', activeSearchTab === 'history');
  elements.searchTabWeb.classList.toggle('active-tab', activeSearchTab === 'web');
  elements.aiSearchPrompt.style.display = activeSearchTab === 'web' ? 'block' : 'none';
  elements.searchResults.style.display = activeSearchTab === 'history' ? 'flex' : 'none';
}

async function handleSearch(q) {
  if (activeSearchTab === 'web') return;
  
  let matches = [];
  if (q.length < 1) {
    // Show most recent entries if searching history and q is empty
    matches = allMeals.slice().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
  } else {
    // Regular search filter
    matches = allMeals.filter(m => m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  }

  // Deduplicate matches by name to show "common" items better if they are exact matches
  const uniqueMatches = [];
  const names = new Set();
  matches.forEach(m => {
    if (!names.has(m.name.toLowerCase())) {
      names.add(m.name.toLowerCase());
      uniqueMatches.push(m);
    }
  });

  elements.searchResults.innerHTML = uniqueMatches.map(m => `
    <div class="search-item glass" onclick="window.quickLog('${m.id}')">
      <div><strong>${m.name}</strong><small>${m.calories} kcal | ${m.category}</small></div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </div>`).join('') || "<p style='text-align:center; padding: 20px; color: var(--text-dim)'>No recent history found.</p>";
}

async function handleAiWebSearch() {
  const q = elements.globalSearchInput.value.trim();
  if (!q) return alert("Type what you're looking for first!");
  
  showLoading(true);
  try {
    const res = await analyzeFood(currentSettings.geminiKey, q, 'text'); // Uses existing analyzeFood for web results
    if (res) {
      currentTempMeal = { ...res, stockPhoto: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80" };
      openConfirmModal(currentTempMeal, false);
      elements.searchModal.style.display = 'none';
    }
  } catch (e) {
    console.error(e);
    alert("AI Search failed. Check API Key.");
  } finally {
    showLoading(false);
  }
}

window.quickLog = (id) => {
  const m = allMeals.find(x => x.id === id);
  if (m) { currentTempMeal = { ...m, timestamp: new Date().toISOString() }; openConfirmModal(currentTempMeal, false); elements.searchModal.style.display = 'none'; }
};

async function loadUserData() {
  const s = await storage.getSettings();
  if (s.calGoal) currentSettings = { ...currentSettings, ...s };
  currentFavorites = await storage.getFavorites();
  allMeals = await storage.getMeals();
  checkinHistory = await storage.getCheckins();
  updateDateDisplay();
  await renderJournal();
  await renderFavorites();
  updateDashboard();
  renderCheckins();
}

function switchTab(t) {
  Object.keys(elements.views).forEach(v => { if (elements.views[v]) elements.views[v].style.display = v === t ? 'block' : 'none'; });
  if (elements.navItems) elements.navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-tab') === t));
}

async function renderJournal() {
  const meals = await storage.getMeals(currentDate);
  const water = await storage.getWater(currentDate);
  if (elements.currentWater) elements.currentWater.textContent = water;
  updateWaterSummary(water);
  
  const grp = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
  let tc = 0, tp = 0;
  meals.forEach(m => { tc += m.calories; tp += (m.protein || 0); if (grp[m.category]) grp[m.category].push(m); else grp.Snack.push(m); });

  const curW = checkinHistory.length > 0 ? checkinHistory[0].weight : (currentSettings.startWeight || 180);
  const prog = Math.round(curW * 0.825);
  
  if (elements.totalCals) elements.totalCals.textContent = tc;
  if (elements.totalPro) elements.totalPro.textContent = tp;
  if (elements.goalCals) elements.goalCals.textContent = currentSettings.calGoal;
  if (elements.goalPro) elements.goalPro.textContent = prog;
  
  if (elements.calBar) elements.calBar.style.width = `${Math.min(100, (tc/currentSettings.calGoal)*100)}%`;
  if (elements.proBar) elements.proBar.style.width = `${Math.min(100, (tp/prog)*100)}%`;
  
  if (elements.categorizedMeals) elements.categorizedMeals.innerHTML = Object.keys(grp).map(cat => `
    <div class="category-section glass ${categoriesExpanded[cat] ? '' : 'collapsed'}">
      <div class="category-header" onclick="window.toggleCat('${cat}')">
        <h4><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron"><polyline points="6 9 12 15 18 9"></polyline></svg> ${cat}</h4>
        <span>${grp[cat].length} items � ${grp[cat].reduce((s, m) => s+m.calories, 0)} kcal</span>
      </div>
      <div class="category-content">
        ${grp[cat].map(m => `
          <div class="meal-item glass" onclick="${selectionMode ? `window.toggleSelect('${m.id}')` : `window.editMeal('${m.id}')`}">
            ${selectionMode ? `<div style="padding:15px; border-right:1px solid var(--glass-border)"><input type="checkbox" ${selectedIds.has(m.id) ? 'checked' : ''} /></div>` : ''}
            <div class="meal-photo" style="background-image: url('${m.stockPhoto}')"></div>
            <div class="meal-details"><strong>${m.name}</strong><br><small>${m.calories} kcal | P:${m.protein}g</small></div>
          </div>
        `).join('')}
      </div>
    </div>`).join('');
}

window.toggleCat = (c) => { categoriesExpanded[c] = !categoriesExpanded[c]; renderJournal(); };
window.editMeal = (id) => { const m = allMeals.find(x => x.id === id); if (m) { currentTempMeal = m; openConfirmModal(m, true); } };
window.toggleSelect = (id) => { if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); renderJournal(); };

window.logFav = async (id) => {
  const f = currentFavorites.find(fav => fav.id === id);
  if (f) { showLoading(true); await storage.addMeal({ ...f, timestamp: new Date().toISOString(), id: null }); await loadUserData(); showLoading(false); }
};
window.deleteFav = async (id) => { if (confirm("Delete?")) { showLoading(true); await storage.deleteFavorite(id); await loadUserData(); showLoading(false); } };

async function renderFavorites() {
  if (elements.favoritesList) elements.favoritesList.innerHTML = currentFavorites.map(f => `
    <div class="fav-item glass" style="padding:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
      <div><strong>${f.name}</strong><br><small>${f.calories} kcal</small></div>
      <div style="display:flex; gap:10px;"><button class="primary" onclick="window.logFav('${f.id}')">Add</button><button class="glass" onclick="window.deleteFav('${f.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button></div>
    </div>`).join('') || "<p style='text-align:center; padding:20px;'>None</p>";
}

function renderFavsDropdown() { if (elements.favsDropdownList) elements.favsDropdownList.innerHTML = currentFavorites.map(f => `<div class="fav-drop-item" onclick="window.logFav('${f.id}')" style="padding:10px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05)">${f.name}</div>`).join('') || "<div style='padding:10px'>Empty</div>"; }

function renderCheckins() {
  if (!elements.checkinHistoryList) return;
  if (checkinHistory.length === 0) { elements.checkinHistoryList.innerHTML = '<p style="text-align: center; color: var(--text-dim); padding: 20px;">No check-ins.</p>'; return; }
  elements.checkinHistoryList.innerHTML = checkinHistory.map(c => `
    <div class="checkin-item glass" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; margin-bottom: 10px;">
      <div><strong>${c.weight} lbs</strong><br><small>${new Date(c.date + "T12:00:00").toLocaleDateString()}</small></div>
      <button class="icon-sm glass" style="color: #ef4444;" onclick="window.deleteCheckin('${c.id}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>`).join('');
}

window.deleteCheckin = async (id) => { if (confirm("Delete?")) { showLoading(true); await storage.deleteCheckin(id); await loadUserData(); showLoading(false); } };

function updateDateDisplay() {
  if (elements.dateDisplay) elements.dateDisplay.textContent = currentDate === new Date().toISOString().split('T')[0] ? "Today" : new Date(currentDate + "T12:00:00").toLocaleDateString();
  if (elements.datePickerHidden) elements.datePickerHidden.value = currentDate;
}

function changeDate(d) {
  const x = new Date(currentDate + "T12:00:00"); x.setDate(x.getDate() + d); currentDate = x.toISOString().split('T')[0];
  updateDateDisplay(); renderJournal();
}

function updateWaterSummary(a) {
  const w = checkinHistory.length > 0 ? checkinHistory[0].weight : (currentSettings.startWeight || 180);
  const g = Math.round(w * 0.5);
  if (elements.goalWater) elements.goalWater.textContent = g;
  if (elements.waterBar) elements.waterBar.style.width = `${Math.min(100, (a / g) * 100)}%`;
}

function updateDashboard() {
  const curW = checkinHistory.length > 0 ? checkinHistory[0].weight : (currentSettings.startWeight || "--");
  if (elements.currentWeightDisplay) elements.currentWeightDisplay.textContent = curW + (curW !== "--" ? " lbs" : "");
  if (elements.goalWeightDisplay) elements.goalWeightDisplay.textContent = currentSettings.goalWeight + " lbs";
  if (currentSettings.goalWeight && currentSettings.startWeight && curW !== "--" && elements.goalProgress) {
    const p = Math.min(100, (Math.abs(currentSettings.startWeight - curW) / Math.abs(currentSettings.startWeight - currentSettings.goalWeight)) * 100);
    elements.goalProgress.style.width = p + "%";
  }
}

function showLoading(s) { if (elements.loadingOverlay) elements.loadingOverlay.style.display = s ? 'flex' : 'none'; }
function toBase64(f) { return new Promise((s, r) => { const rdr = new FileReader(); rdr.readAsDataURL(f); rdr.onload = () => s(rdr.result.split(',')[1]); rdr.onerror = e => r(e); }); }
function startVoiceRecognition() { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return alert("No support"); const r = new SR(); r.onresult = (e) => { elements.textLog.value = e.results[0][0].transcript; handleLog('text'); }; r.start(); }

init();

