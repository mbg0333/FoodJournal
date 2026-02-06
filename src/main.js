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
let currentSettings = { 
  geminiKey: localStorage.getItem('gemini_key') || '', 
  calGoal: 2000, 
  startWeight: 180, 
  goalWeight: 160 
};
let categoriesExpanded = { Breakfast: true, Lunch: true, Dinner: true, Snack: true };
let currentFavorites = [];
let allMeals = [];
let selectionMode = false;
let selectedIds = new Set();
let checkinHistory = [];

const elements = {
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
  // Weight & Checkins
  addCheckinBtn: document.getElementById('add-checkin-btn'),
  checkinHistoryList: document.getElementById('checkin-history'),
  goalProgress: document.getElementById('goal-progress'),
  currentWeightDisplay: document.getElementById('current-weight'),
  goalWeightDisplay: document.getElementById('goal-weight')
};

function init() {
  lucide.createIcons();
  setupEventListeners();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user; 
      elements.authScreen.style.display = 'none'; 
      elements.app.style.display = 'block';
      await loadUserData();
      refreshIcons();
    } else {
      currentUser = null; 
      elements.authScreen.style.display = 'flex'; 
      elements.app.style.display = 'none';
    }
  });
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setupEventListeners() {
  elements.loginBtn.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
  elements.logoutBtn.addEventListener('click', () => signOut(auth));
  elements.prevDay.addEventListener('click', () => changeDate(-1));
  elements.nextDay.addEventListener('click', () => changeDate(1));
  elements.dateDisplay.addEventListener('click', () => elements.datePickerHidden.showPicker());
  elements.datePickerHidden.addEventListener('change', (e) => { currentDate = e.target.value; updateDateDisplay(); renderJournal(); });
  elements.navItems.forEach(item => item.addEventListener('click', (e) => { e.preventDefault(); switchTab(item.dataset.tab); }));
  
  elements.logBtn.addEventListener('click', () => handleLog('text'));
  elements.textLog.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLog('text'); });
  elements.voiceBtn.addEventListener('click', startVoiceRecognition);
  elements.photoBtn.addEventListener('click', () => document.getElementById('photo-modal').style.display = 'flex');
  
  // Photo source buttons
  document.getElementById('take-photo-btn').addEventListener('click', () => { document.getElementById('photo-modal').style.display = 'none'; document.getElementById('camera-input').click(); });
  document.getElementById('choose-photo-btn').addEventListener('click', () => { document.getElementById('photo-modal').style.display = 'none'; document.getElementById('file-input').click(); });
  document.getElementById('close-photo-modal').addEventListener('click', () => { document.getElementById('photo-modal').style.display = 'none'; });
  document.getElementById('camera-input').addEventListener('change', (e) => handleLog('photo', e.target.files[0]));
  document.getElementById('file-input').addEventListener('change', (e) => handleLog('photo', e.target.files[0]));

  elements.openFavsLogBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    const isVisible = elements.favsDropdown.style.display === 'block'; 
    elements.favsDropdown.style.display = isVisible ? 'none' : 'block'; 
    if (!isVisible) renderFavsDropdown(); 
  });
  document.addEventListener('click', () => { if (elements.favsDropdown) elements.favsDropdown.style.display = 'none'; });

  elements.saveConfirm.addEventListener('click', async () => { 
    if (!currentTempMeal) return; 
    const isEdit = !!currentTempMeal.id; 
    const meal = buildMealFromForm(); 
    showLoading(true); 
    if (isEdit) await storage.updateMeal(currentTempMeal.id, meal); else await storage.addMeal(meal); 
    await renderJournal(); 
    showLoading(false); 
    elements.confirmModal.style.display = 'none'; 
  });

  elements.saveAsFavBtn.addEventListener('click', async () => { 
    if (!currentTempMeal) return; 
    const name = prompt("Name this favorite:", currentTempMeal.name); 
    if (!name) return; 
    const meal = buildMealFromForm(); 
    showLoading(true); 
    await storage.addFavorite({ ...meal, name }); 
    await loadUserData(); 
    showLoading(false); 
    alert("Saved to Favorites!"); 
  });

  elements.deleteBtn.addEventListener('click', async () => { 
    if (!currentTempMeal?.id) return; 
    if (confirm("Delete?")) { 
      showLoading(true); 
      await storage.deleteMeal(currentTempMeal.id); 
      await renderJournal(); 
      showLoading(false); 
      elements.confirmModal.style.display = 'none'; 
    } 
  });

  elements.searchBtn.addEventListener('click', () => elements.searchModal.style.display = 'flex');
  elements.closeSearch.addEventListener('click', () => elements.searchModal.style.display = 'none');
  elements.globalSearchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  elements.settingsBtn.addEventListener('click', () => { 
    document.getElementById('settings-modal').style.display = 'flex'; 
    document.getElementById('api-key').value = currentSettings.geminiKey; 
    document.getElementById('cal-goal-input').value = currentSettings.calGoal; 
    document.getElementById('goal-weight-input').value = currentSettings.goalWeight || '';
    document.getElementById('start-weight-input').value = currentSettings.startWeight || '';
  });
  
  document.getElementById('close-settings').addEventListener('click', () => document.getElementById('settings-modal').style.display = 'none');
  
  document.getElementById('save-settings').addEventListener('click', async () => { 
    currentSettings.geminiKey = document.getElementById('api-key').value.trim(); 
    currentSettings.calGoal = parseInt(document.getElementById('cal-goal-input').value) || 2000; 
    currentSettings.goalWeight = parseFloat(document.getElementById('goal-weight-input').value) || 160;
    currentSettings.startWeight = parseFloat(document.getElementById('start-weight-input').value) || 180;
    await storage.saveSettings(currentSettings); 
    localStorage.setItem('gemini_key', currentSettings.geminiKey);
    await loadUserData(); 
    document.getElementById('settings-modal').style.display = 'none'; 
  });

  elements.waterBtns.forEach(btn => btn.addEventListener('click', async (e) => { 
    e.stopPropagation(); 
    const amt = parseInt(btn.dataset.amt); 
    const next = Math.max(0, parseInt(elements.currentWater.textContent) + amt); 
    elements.currentWater.textContent = next; 
    updateWaterSummary(next); 
    await storage.setWater(currentDate, next); 
  }));

  elements.resetWater.addEventListener('click', async (e) => { 
    e.stopPropagation(); 
    if(confirm("Reset?")) { 
      elements.currentWater.textContent = 0; 
      updateWaterSummary(0); 
      await storage.setWater(currentDate, 0); 
    } 
  });

  // Bulk Select
  document.getElementById('bulk-select-btn').addEventListener('click', () => { 
    selectionMode = !selectionMode; 
    selectedIds.clear(); 
    document.getElementById('bulk-actions').style.display = selectionMode ? 'block' : 'none'; 
    renderJournal(); 
  });

  document.getElementById('save-bulk-fav-btn').addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const name = prompt("Name this group favorite:");
    if (!name) return;
    const meals = await storage.getMeals(currentDate);
    const selectedMeals = meals.filter(m => selectedIds.has(m.id));
    const aggregate = selectedMeals.reduce((acc, m) => ({ 
      calories: acc.calories + m.calories, 
      protein: acc.protein + (m.protein || 0), 
      carbs: acc.carbs + (m.carbs || 0), 
      fat: acc.fat + (m.fat || 0) 
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    showLoading(true);
    await storage.addFavorite({ 
      ...aggregate, 
      name, 
      category: "Lunch", 
      stockPhoto: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80" 
    });
    selectionMode = false; 
    selectedIds.clear(); 
    document.getElementById('bulk-actions').style.display = 'none';
    await loadUserData(); 
    showLoading(false);
  });

  // Weight Check-in
  elements.addCheckinBtn.addEventListener('click', async () => {
    const weight = prompt("Enter your weight (lbs):");
    if (!weight || isNaN(weight)) return;
    
    // Determine the most recent Sunday
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const sundayStr = sunday.toISOString().split('T')[0];
    
    showLoading(true);
    await storage.addCheckin({
      weight: parseFloat(weight),
      date: sundayStr,
      timestamp: new Date().toISOString()
    });
    await loadUserData();
    showLoading(false);
  });
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
  if (!currentSettings.geminiKey) return alert("Key missing."); 
  showLoading(true); 
  try { 
    let input = type === 'text' ? elements.textLog.value : data; 
    if (type === 'photo' && data) input = await toBase64(data);
    const result = await analyzeFood(currentSettings.geminiKey, input, type); 
    if (result) { 
      currentTempMeal = { ...result, stockPhoto: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80&sig=${Date.now()}` }; 
      openConfirmModal(currentTempMeal, false); 
    } 
  } catch (e) { console.error(e); } finally { showLoading(false); } 
}

function openConfirmModal(meal, isEdit) { 
  elements.confirmTitle.textContent = isEdit ? "Edit Entry" : "Confirm Entry"; 
  elements.confirmName.value = meal.name; 
  elements.confirmCalories.value = meal.calories; 
  elements.confirmProtein.value = meal.protein || 0; 
  elements.confirmCarbs.value = meal.carbs || 0; 
  elements.confirmFat.value = meal.fat || 0; 
  elements.confirmCategory.value = meal.category || "Lunch"; 
  elements.confirmImgPreview.style.backgroundImage = `url('${meal.stockPhoto}')`; 
  elements.deleteBtn.style.display = isEdit ? "flex" : "none"; 
  elements.confirmModal.style.display = 'flex'; 
  refreshIcons(); 
}

async function handleSearch(query) { 
  if (query.length < 2) { elements.searchResults.innerHTML = ""; return; } 
  const matches = allMeals.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10); 
  elements.searchResults.innerHTML = matches.map(m => `<div class="search-item glass" onclick="window.quickLog('${m.id}')"><strong>${m.name}</strong> • ${m.calories} kcal</div>`).join('') || "<p style='text-align:center'>No matches.</p>"; 
}

window.quickLog = (id) => { 
  const meal = allMeals.find(m => m.id === id); 
  if (meal) { 
    currentTempMeal = { ...meal, timestamp: new Date().toISOString() }; 
    openConfirmModal(currentTempMeal, false); 
    elements.searchModal.style.display = 'none'; 
  } 
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

function switchTab(tab) { 
  Object.keys(elements.views).forEach(v => elements.views[v].style.display = v === tab ? 'block' : 'none'); 
  elements.navItems.forEach(item => item.classList.toggle('active', item.dataset.tab === tab)); 
  refreshIcons(); 
}

async function renderJournal() {
  const meals = await storage.getMeals(currentDate); 
  const water = await storage.getWater(currentDate); 
  elements.currentWater.textContent = water; 
  updateWaterSummary(water);
  
  const grouped = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] }; 
  let totalCals = 0, totalPro = 0;
  meals.forEach(m => { 
    totalCals += m.calories; 
    totalPro += (m.protein || 0); 
    if (grouped[m.category]) grouped[m.category].push(m); else grouped.Snack.push(m); 
  });

  const weight = checkinHistory.length > 0 ? checkinHistory[0].weight : (currentSettings.startWeight || 180);
  const pGoal = Math.round(weight * 0.825); 
  
  elements.totalCals.textContent = totalCals; 
  elements.totalPro.textContent = totalPro; 
  elements.goalCals.textContent = currentSettings.calGoal; 
  elements.goalPro.textContent = pGoal;
  
  elements.calBar.style.width = `${Math.min(100, (totalCals/currentSettings.calGoal)*100)}%`; 
  elements.proBar.style.width = `${Math.min(100, (totalPro/pGoal)*100)}%`;
  
  elements.categorizedMeals.innerHTML = Object.keys(grouped).map(cat => `
    <div class="category-section glass ${categoriesExpanded[cat] ? '' : 'collapsed'}" data-cat="${cat}">
      <div class="category-header" onclick="window.toggleCat('${cat}')">
        <h4><i data-lucide="chevron-down" class="chevron"></i> ${cat}</h4>
        <span class="category-stats">${grouped[cat].length} items • ${grouped[cat].reduce((s, m) => s+m.calories, 0)} kcal</span>
      </div>
      <div class="category-content">
        ${grouped[cat].map(m => `
          <div class="meal-item glass" onclick="${selectionMode ? `window.toggleSelect('${m.id}')` : `window.editMeal('${m.id}')`}">
            ${selectionMode ? `<div style="padding:15px; border-right:1px solid var(--glass-border)"><input type="checkbox" ${selectedIds.has(m.id) ? 'checked' : ''} /></div>` : ''}
            <div class="meal-photo" style="background-image: url('${m.stockPhoto}')"></div>
            <div class="meal-details">
              <span class="meal-name">${m.name}</span>
              <span class="meal-meta">${m.calories} kcal</span>
              <div class="macro-chips">
                <span class="chip protein">P: ${m.protein || 0}g</span>
                <span class="chip carbs">C: ${m.carbs || 0}g</span>
                <span class="chip fat">F: ${m.fat || 0}g</span>
              </div>
            </div>
          </div>
        `).join('') || "<p style='color:var(--text-dim); padding:10px;'>Empty</p>"}
      </div>
    </div>`).join('');
  refreshIcons();
}

window.toggleCat = (cat) => { categoriesExpanded[cat] = !categoriesExpanded[cat]; renderJournal(); };
window.editMeal = (id) => { const m = allMeals.find(meal => meal.id === id); if (m) { currentTempMeal = m; openConfirmModal(m, true); } };
window.toggleSelect = (id) => { if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); renderJournal(); };

window.logFav = async (id) => { 
  const f = currentFavorites.find(fav => fav.id === id); 
  if (f) { 
    showLoading(true); 
    await storage.addMeal({ ...f, timestamp: new Date().toISOString(), id: null }); 
    await loadUserData(); 
    showLoading(false); 
  } 
};

window.deleteFav = async (id) => { if (confirm("Delete?")) { showLoading(true); await storage.deleteFavorite(id); await loadUserData(); showLoading(false); } };

async function renderFavorites() { 
  elements.favoritesList.innerHTML = currentFavorites.map(f => `
    <div class="fav-item glass">
      <div class="fav-header">
        <div>
          <strong>${f.name}</strong>
          <div style="font-size:0.8rem; color:var(--text-dim)">${f.calories} kcal • P:${f.protein}g C:${f.carbs}g F:${f.fat}g</div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="primary" onclick="window.logFav('${f.id}')" style="padding:6px 12px; font-size:0.8rem">Add</button>
          <button class="glass" onclick="window.deleteFav('${f.id}')" style="color:#ef4444"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    </div>`).join('') || "<p style='text-align:center; padding:40px; color:var(--text-dim)'>Save favorites here!</p>"; 
  refreshIcons(); 
}

function renderFavsDropdown() { elements.favsDropdownList.innerHTML = currentFavorites.map(f => `<div class="fav-drop-item" onclick="window.logFav('${f.id}')"><span>${f.name}</span><span style="color:var(--text-dim); font-size:0.75rem">${f.calories} kcal</span></div>`).join('') || "<div style='padding:15px; color:var(--text-dim);'>No favorites</div>"; }

function renderCheckins() {
  if (checkinHistory.length === 0) {
    elements.checkinHistoryList.innerHTML = '<p style="text-align: center; color: var(--text-dim); padding: 20px;">No check-ins yet.</p>';
    return;
  }
  
  elements.checkinHistoryList.innerHTML = checkinHistory.map(c => {
    const d = new Date(c.date + "T12:00:00");
    return `
    <div class="checkin-item glass" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; margin-bottom: 10px;">
      <div>
        <div style="font-weight: 700;">${c.weight} lbs</div>
        <div style="font-size: 0.75rem; color: var(--text-dim);">Week of ${d.toLocaleDateString()}</div>
      </div>
      <button class="icon-sm glass" style="color: #ef4444;" onclick="window.deleteCheckin('${c.id}')"><i data-lucide="trash-2"></i></button>
    </div>
    `;
  }).join('');
  refreshIcons();
}

window.deleteCheckin = async (id) => {
  if (confirm("Delete check-in?")) {
    showLoading(true);
    await storage.deleteCheckin(id);
    await loadUserData();
    showLoading(false);
  }
};

function updateDateDisplay() { 
  const today = new Date().toISOString().split('T')[0]; 
  elements.dateDisplay.textContent = currentDate === today ? "Today" : new Date(currentDate + "T12:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); 
  elements.datePickerHidden.value = currentDate; 
}

function changeDate(days) { 
  const d = new Date(currentDate + "T12:00:00"); 
  d.setDate(d.getDate() + days); 
  currentDate = d.toISOString().split('T')[0]; 
  updateDateDisplay(); 
  renderJournal(); 
}

function updateWaterSummary(amt) { 
  const weight = checkinHistory.length > 0 ? checkinHistory[0].weight : (currentSettings.startWeight || 180);
  const goal = Math.round(weight * 0.5); 
  elements.goalWater.textContent = goal; 
  elements.waterBar.style.width = `${Math.min(100, (amt / goal) * 100)}%`; 
}

function updateDashboard() { 
  const currentW = checkinHistory.length > 0 ? checkinHistory[0].weight : (currentSettings.startWeight || "--");
  elements.currentWeightDisplay.textContent = currentW + (currentW !== "--" ? " lbs" : ""); 
  elements.goalWeightDisplay.textContent = (currentSettings.goalWeight || "--") + (currentSettings.goalWeight ? " lbs" : ""); 
  
  if (currentSettings.goalWeight && currentSettings.startWeight && currentW !== "--") {
    const totalDiff = Math.abs(currentSettings.startWeight - currentSettings.goalWeight);
    const currentDiff = Math.abs(currentSettings.startWeight - currentW);
    const progress = Math.min(100, (currentDiff / totalDiff) * 100);
    elements.goalProgress.style.width = progress + "%";
  }
}

function showLoading(s) { elements.loadingOverlay.style.display = s ? 'flex' : 'none'; }
function toBase64(f) { return new Promise((s, r) => { const reader = new FileReader(); reader.readAsDataURL(f); reader.onload = () => s(reader.result.split(',')[1]); reader.onerror = e => r(e); }); }

function startVoiceRecognition() { 
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; 
  if (!SR) return alert("Not supported."); 
  const r = new SR(); r.onresult = (e) => { elements.textLog.value = e.results[0][0].transcript; handleLog('text'); }; r.start(); 
}

init();
