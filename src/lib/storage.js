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
  getDoc 
} from 'firebase/firestore';

const COLLECTIONS = {
  SETTINGS: 'settings',
  MEALS: 'meals',
  SHOPPING: 'shopping'
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

  getMeals: async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(
      collection(db, COLLECTIONS.MEALS), 
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  },

  addMeal: async (meal) => {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, COLLECTIONS.MEALS), {
      ...meal,
      userId: user.uid,
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
