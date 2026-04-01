Chrome Extension (core)

manifest.json — MV3 setup with all permissions
content.js — injected into every webpage
background.js — service worker handling all API calls
Save password feature

Detects login forms on any website
Captures username + password on form submit or button click
Shows "Save password?" banner top-right
Handles SPAs like X/Twitter that navigate away instantly using pending save storage
Autofill feature

On page load, fetches credentials for current domain
Shows autofill banner with picker if multiple accounts exist
Ctrl+Shift+L keyboard shortcut to trigger autofill instantly
Once dismissed, never reappears until next page load
Password suggestion

Detects signup forms (confirm password field, new-password autocomplete, register in URL)
Suggests a strong 16-character random password
Fills all password fields including confirm field
Copy button to copy without filling
Password strength meter

Appears below any password field as you type
Shows 5 checks: 8+ chars, uppercase, number, symbol, 12+ chars
Color goes red → orange → yellow → green
When password becomes strong → shows "✅ Password is strong enough!" then fades out
× button to dismiss manually
Conflict resolution picker

When multiple credentials saved for same domain
Shows a proper picker with favicon, username, website, Fill button per account
Mini vault popup

Full credential browser inside the extension popup
Search with live filtering
All / This Site tabs
Quick copy username, copy password, delete buttons on each card
Click card → detail panel with blurred password reveal, autofill, delete
Favicon next to every credential
Favicon display

Frontend dashboard shows website favicon on every credential card
Extension popup shows favicons too
Domain map for 50+ common apps/banks by name (Canara, BookMyShow, WhatsApp etc.)
Falls back to first letter if favicon not found
Backend

AES-256-CBC encryption for all stored passwords
?website= domain filter for extension queries
CORS updated to allow chrome-extension:// origins
dotenv path fix for v17 compatibility
Test pages

http://localhost:3333/login — test save/autofill
http://localhost:3333/signup — test password suggestion + strength meter
