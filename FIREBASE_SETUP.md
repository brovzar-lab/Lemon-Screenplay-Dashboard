# Firebase Storage Setup for Screenplay PDFs

This guide explains how to set up Firebase Storage to host your screenplay PDF files.

## Why Firebase Storage?

- **Zero impact on app bundle size** - PDFs are fetched on-demand
- **Fast global CDN** - Firebase serves files from edge locations
- **Easy management** - Upload/delete files via Firebase Console
- **Free tier** - 5GB storage and 1GB/day downloads free

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or use an existing one)
3. Follow the setup wizard
4. Note your **Project ID** (e.g., `lemon-screenplay-dashboard`)

---

## Step 2: Enable Firebase Storage

1. In Firebase Console, go to **Build > Storage**
2. Click "Get started"
3. Choose a location (e.g., `us-central1`)
4. Start in **test mode** for now (we'll secure it later)

---

## Step 3: Configure Storage Rules

For public read access (screenplays only), go to **Storage > Rules** and use:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to screenplays folder
    match /screenplays/{fileName} {
      allow read: if true;
      allow write: if false; // Uploads only via Console or Admin SDK
    }

    // Block all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Click "Publish" to apply the rules.

---

## Step 4: Upload Your PDFs

### Option A: Firebase Console (Recommended for small batches)

1. Go to **Storage > Files**
2. Click "Create folder" and name it `screenplays`
3. Open the `screenplays` folder
4. Click "Upload file" and select your PDFs
5. Ensure filenames match exactly what's in your JSON files (e.g., `JUNO.pdf`)

### Option B: gsutil CLI (For bulk uploads)

```bash
# Install Google Cloud SDK if not already installed
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Upload all PDFs from a folder
gsutil -m cp /path/to/your/pdfs/*.pdf gs://YOUR-PROJECT.appspot.com/screenplays/
```

### Option C: Firebase Admin SDK (For programmatic uploads)

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert('path/to/serviceAccountKey.json'),
  storageBucket: 'YOUR-PROJECT.appspot.com'
});

const bucket = admin.storage().bucket();

async function uploadPDF(filePath) {
  const fileName = path.basename(filePath);
  await bucket.upload(filePath, {
    destination: `screenplays/${fileName}`,
    metadata: {
      contentType: 'application/pdf'
    }
  });
  console.log(`Uploaded: ${fileName}`);
}
```

---

## Step 5: Configure the Dashboard

1. Find your Firebase Storage bucket name:
   - Go to Firebase Console > Storage
   - Look at the URL: `gs://YOUR-PROJECT.appspot.com`
   - Your bucket name is: `YOUR-PROJECT.appspot.com`

2. Update the `.env` file in `lemon-dashboard/`:

```env
VITE_FIREBASE_STORAGE_BUCKET=YOUR-PROJECT.appspot.com
```

3. Restart the dev server:

```bash
npm run dev
```

---

## Step 6: Verify It Works

1. Open the dashboard
2. Click on a screenplay card
3. Click the "PDF" button in the modal header
4. The PDF should open in a new tab

---

## Filename Mapping

The dashboard uses the `source_file` field from each screenplay's JSON analysis to construct the PDF URL:

| Screenplay | JSON source_file | Firebase Storage Path |
|------------|------------------|----------------------|
| Juno | `JUNO.pdf` | `screenplays/JUNO.pdf` |
| Charlie Wilson's War | `CHARLIE WILSON_S WAR.pdf` | `screenplays/CHARLIE WILSON_S WAR.pdf` |

**Important:** PDF filenames must match exactly (case-sensitive).

---

## Troubleshooting

### PDF won't load (404 error)

1. Check the filename matches exactly (case-sensitive)
2. Verify the file is in the `screenplays/` folder
3. Check Storage Rules allow read access

### CORS errors

If you see CORS errors in the console, configure CORS for your bucket:

1. Create a `cors.json` file:
```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

2. Apply it:
```bash
gsutil cors set cors.json gs://YOUR-PROJECT.appspot.com
```

### Wrong bucket name

The URL format is:
```
https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/screenplays%2FFILENAME.pdf?alt=media
```

Make sure `BUCKET_NAME` in your `.env` matches your Firebase Storage bucket exactly.

---

## Security Notes

- **Never commit `.env` to git** - It's already in `.gitignore`
- **Production rules** - Consider restricting access to authenticated users if needed
- **Storage quotas** - Monitor usage in Firebase Console to stay in free tier

---

## Quick Reference

| Item | Value |
|------|-------|
| Firebase Console | https://console.firebase.google.com |
| Storage Rules Docs | https://firebase.google.com/docs/storage/security |
| gsutil Docs | https://cloud.google.com/storage/docs/gsutil |
| Free Tier Limits | 5GB storage, 1GB/day downloads |
