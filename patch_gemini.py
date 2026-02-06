import os

path = r'C:\Users\maxxg\..gemini\antigravity\brain\FoodJournal\src\lib\gemini.js'.replace('..', '.')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update model names and add more robust error handling
content = content.replace(
    'const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];',
    'const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];'
)

# Use v1 for models that might be stable now
content = content.replace(
    'const genAI = new GoogleGenerativeAI(key.trim());',
    'const genAI = new GoogleGenerativeAI(key.trim());'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated gemini.js")
