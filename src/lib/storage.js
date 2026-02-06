import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  doc, 
  getDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

const COLLECTIONS = {
  SETTINGS: 'settings',
  MEALS: 'meals',
  SHOPPING: 'shopping',
  WATER: 'water',
  FAVORITES: 'favorites'
};

export const storage = {
  getSettings: async () => {
    const user = auth.currentUser;
    if (!user) return {};
    const d = await getDoc(doc(db, COLLECTIONS.SETTINGS, user.uid));
    return d.exists() ? d.data() : {};
  },

  saveSettings: async (settings) => {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, COLLECTIONS.SETTINGS, user.uid), settings);
  },

  getMeals: async (dateStr) => {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(
      collection(db, COLLECTIONS.MEALS), 
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    const meals = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (dateStr) return meals.filter(m => m.timestamp.startsWith(dateStr));
    return meals;
  },

  addMeal: async (meal) => {
    const user = auth.currentUser;
    if (!user) return;
    return await addDoc(collection(db, COLLECTIONS.MEALS), {
      ...meal,
      userId: user.uid
    });
  },

  updateMeal: async (id, meal) => {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, COLLECTIONS.MEALS, id), meal);
  },

  deleteMeal: async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    await deleteDoc(doc(db, COLLECTIONS.MEALS, id));
  },

  // Favorites
  getFavorites: async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(collection(db, COLLECTIONS.FAVORITES), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  },

  addFavorite: async (fav) => {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, COLLECTIONS.FAVORITES), {
      ...fav,
      userId: user.uid,
      createdAt: new Date().toISOString()
    });
  },

  deleteFavorite: async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    await deleteDoc(doc(db, COLLECTIONS.FAVORITES, id));
  },

  // Water Tracking
  getWater: async (dateStr) => {
    const user = auth.currentUser;
    if (!user) return 0;
    const q = query(
      collection(db, COLLECTIONS.WATER),
      where('userId', '==', user.uid),
      where('date', '==', dateStr)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data().amount || 0;
    return 0;
  },

  setWater: async (dateStr, amount) => {
    const user = auth.currentUser;
    if (!user) return;
    const docId = `${user.uid}_${dateStr}`;
    await setDoc(doc(db, COLLECTIONS.WATER, docId), {
      userId: user.uid,
      date: dateStr,
      amount: amount,
      timestamp: new Date().toISOString()
    });
  },

  getShoppingList: async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(
      collection(db, COLLECTIONS.SHOPPING),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  },

  addShoppingItem: async (item) => {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, COLLECTIONS.SHOPPING), {
      ...item,
      userId: user.uid,
      timestamp: new Date().toISOString(),
      done: false
    });
  }
};
