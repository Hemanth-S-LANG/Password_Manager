#  **Password Manager Chrome Extension — Feature Overview**

---

##  **1. Chrome Extension (Core Architecture)**

* **manifest.json**

  * MV3 configuration
  * Includes required permissions

* **content.js**

  * Injected into every webpage
  * Detects input fields and user actions

* **background.js**

  * Service worker
  * Handles API calls and core logic

---

##  **2. Save Password Feature**

* Detects **login forms** on any website

* Captures:

  * Username / Email
  * Password

* Triggered on:

  * Form submission
  * Button click

* Displays **"Save Password?" banner** at top-right

* Handles **SPA websites** (like X/Twitter):

  * Uses **pending save storage**
  * Prevents data loss during navigation

---

##  **3. Autofill Feature**

* On page load:

  * Fetches credentials for current domain

* Displays **autofill banner**:

  * Shows saved accounts
  * Allows user to choose (conflict resolution)

* Keyboard shortcut:

  * **Ctrl + Shift + L → Instant autofill**

* UX behavior:

  * Once dismissed → does not reappear until next page load

---

##  **4. Password Suggestion System**

* Detects **signup forms** using:

  * Confirm password fields
  * `autocomplete="new-password"`
  * URL keywords like "register"

* Generates:

  * **Strong 16-character password**
  * Includes uppercase, lowercase, numbers, symbols

* Features:

  * Autofills password + confirm field
  * Copy button (without autofill)

---

##  **5. Password Strength Meter**

* Appears below password field (real-time)

### Checks:

*  Minimum 8 characters
*  Uppercase letter
*  Number
*  Special character
*  12+ characters

### Visual Feedback:

*  Weak →  Medium →  Good →  Strong

* When strong:

  * Shows: **“ Password is strong enough!”**
  * Automatically fades out

* Includes:

  *  Manual dismiss button

---

##  **6. Conflict Resolution Picker**

* Triggered when:

  * Multiple credentials exist for same domain

* Displays:

  * Website favicon
  * Username/email
  * Website name
  * **Fill button for each account**

* Allows user to:

  * Select correct account before autofill

---

##  **7. Mini Vault Popup (Extension UI)**

* Full **credential dashboard inside popup**

### Features:

*  Search with real-time filtering

* Tabs:

  * **All Credentials**
  * **This Site Only**

* Each credential card includes:

  * Website favicon
  * Username
  * Actions:

    *  Copy username
    *  Copy password
    *  Delete

---

###  Detail Panel:

* Click on card to open detailed view:

  * Blurred password with reveal option
  * Autofill button
  * Delete option

---

##  **8. Favicon Display System**

* Shows favicon for each credential:

  * In frontend dashboard
  * In extension popup

* Uses:

```text
https://<domain>/favicon.ico
```

---

### Enhancements:

* Domain mapping for **50+ popular apps/banks**:

  * Canara Bank
  * BookMyShow
  * WhatsApp
  * etc.

* Fallback:

  * Displays first letter if favicon unavailable

---

##  **9. Backend (Security & API)**

* Encryption:

  * **AES-256-CBC** for all stored passwords

* API Support:

  * Domain-based filtering:

```text
GET /api/credentials?website=<domain>
```

* CORS:

  * Configured to allow:

```text
chrome-extension://
```

* Environment:

  * dotenv configured (Node v17 compatible)

---

##  **10. Testing Environment**

* Login Test Page:

```text
http://localhost:3333/login
```

* Signup Test Page:

```text
http://localhost:3333/signup
```

---

##  **System Highlights**

* Real-time interaction with web forms
* Secure credential handling with encryption
* Domain-based intelligent autofill
* Advanced UX with minimal intrusion
* Works across multiple websites dynamically

---

##  **Project Summary**

This project is a **browser-integrated password manager** that:

* Detects login/signup activity
* Suggests strong passwords
* Securely stores credentials
* Autofills intelligently based on domain
* Provides a full vault interface inside the extension

---
