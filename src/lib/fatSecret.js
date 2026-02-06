
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

export const searchFatSecretUPC = async (barcode) => {
  try {
    console.log('Call...'); const searchFunc = httpsCallable(functions, 'searchFatSecret');
    const result = await searchFunc({ upc: barcode });
    console.log('Result:', result.data); return result.data;
  } catch (e) {
    console.error('Cloud Function Error:', e);
    return null;
  }
};
