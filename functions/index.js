
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const CLIENT_ID = "3fe73daccba94e1fbe584f3301362fff";
const CLIENT_SECRET = "e3b8ba4dc58341b7bc059abfd68b1132";

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  try {
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    
    // Using native global fetch (Node 18+)
    const res = await fetch("https://oauth.fatsecret.com/connect/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials&scope=basic" 
    });
    
    if (!res.ok) {
        console.error("FatSecret Auth Failed Status:", res.status);
        return null;
    }

    const data = await res.json();
    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
      return accessToken;
    }
  } catch (e) {
    console.error("Auth Exception", e);
  }
  return null;
}

exports.searchFatSecret = functions.https.onCall(async (data, context) => {
  const upc = data.upc;
  console.log("Received UPC Search:", upc);
  
  if (!upc) return { error: "No UPC" };

  const token = await getAccessToken();
  if (!token) {
      console.error("Could not get access token");
      return { error: "Auth Error" };
  }

  try {
    // 1. Find ID
    const findRes = await fetch(`https://platform.fatsecret.com/rest/server.api?method=food.find_id_for_barcode&barcode=${upc}&format=json`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const findData = await findRes.json();
    console.log("Find Data:", JSON.stringify(findData));

    if (!findData.food_id || !findData.food_id.value) {
        console.log("No food_id found for UPC");
        return null;
    }

    // 2. Get Details
    const getRes = await fetch(`https://platform.fatsecret.com/rest/server.api?method=food.get.v2&food_id=${findData.food_id.value}&format=json`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const getData = await getRes.json();
    console.log("Get Data:", JSON.stringify(getData));
    
    if (getData.food) {
        const f = getData.food;
        let s = f.servings.serving;
        if (Array.isArray(s)) s = s.find(x => x.metric_serving_unit === "g" || x.metric_serving_unit === "ml") || s[0];

        // Safely parse
        const cal = s.calories ? parseInt(s.calories) : 0;
        const pro = s.protein ? parseFloat(s.protein) : 0;
        const carbs = s.carbohydrate ? parseFloat(s.carbohydrate) : 0;
        const fat = s.fat ? parseFloat(s.fat) : 0;

        return {
            name: f.food_name || "Unknown Product",
            brand: f.brand_name,
            calories: cal,
            protein: pro,
            carbs: carbs,
            fat: fat,
            category: "Snack",
            serving_size: s.serving_description || "1 serving",
            stockPhoto: null
        };
    }
    return null;

  } catch (e) {
    console.error("Process Logic Error", e);
    return { error: e.message };
  }
});
