import { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import CredentialList from "../components/CredentialList";
import AddCredentialModal from "../components/AddCredentialModal";
import ChangeMasterPasswordModal from "../components/ChangeMasterPasswordModal";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import PasswordHistoryModal from "../components/PasswordHistoryModal";
import AnalyticsDashboard from "../components/AnalyticsDashboard";   // NEW
import { fetchCredentials, addCredential, updateCredential, deleteCredential } from "../api/credentials";

// ── Tab navigation ────────────────────────────────────────────────────────────

function TabBar({ active, onChange, credentialCount }) {
  const tabs = [
    { id: "vault",     label: "Vault",     icon: "🔐" },
    { id: "analytics", label: "Analytics", icon: "📊" },
  ];
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1 w-fit mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
            ${active === tab.id
              ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
          {tab.id === "vault" && credentialCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold
              ${active === "vault"
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}>
              {credentialCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ onLock }) {
  const [credentials, setCredentials] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab] = useState("vault");              // NEW
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [historyCredential, setHistoryCredential] = useState(null);

  // Set of passwords used more than once across different sites
  const reusedPasswords = new Set(
    credentials
      .filter((c) =>
        credentials.some((other) => other._id !== c._id && other.password === c.password)
      )
      .map((c) => c.password)
  );

  useEffect(() => { loadCredentials(); }, []);

  async function loadCredentials() {
    try {
      const { data } = await fetchCredentials();
      setCredentials(data);
    } catch {
      showToast("Failed to load credentials", "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  // ── Export vault as encrypted JSON ─────────────────────────────────────────
  // Uses the Web Crypto API to AES-GCM encrypt all credentials client-side.
  // The user sets an export password — nothing is sent to the server.
  async function handleExport() {
    const exportPassword = window.prompt(
      "Set an export password to encrypt your vault backup.You will need this password to restore.",
    );
    if (!exportPassword) return;
    if (exportPassword.length < 4) {
      showToast("Export password must be at least 4 characters", "error");
      return;
    }

    try {
      // Derive an AES-GCM key from the export password using PBKDF2
      const enc      = new TextEncoder();
      const keyMat   = await crypto.subtle.importKey(
        "raw", enc.encode(exportPassword), "PBKDF2", false, ["deriveKey"]
      );
      const salt     = crypto.getRandomValues(new Uint8Array(16));
      const key      = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMat,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );

      // Build the payload
      const payload = JSON.stringify({
        version:    1,
        exportedAt: new Date().toISOString(),
        count:      credentials.length,
        credentials: credentials.map((c) => ({
          website:  c.website,
          username: c.username,
          password: c.password,
          category: c.category,
          notes:    c.notes || "",
          createdAt: c.createdAt,
        })),
      });

      // Encrypt
      const iv        = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(payload)
      );

      // Encode everything as base64 for the JSON file
      const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      const exportData = JSON.stringify({
        _kv:       "SecureVault Encrypted Backup v1",
        salt:      toB64(salt),
        iv:        toB64(iv),
        encrypted: toB64(encrypted),
      }, null, 2);

      // Trigger download
      const blob = new Blob([exportData], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `securevault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(`Vault exported — ${credentials.length} credentials saved`);
    } catch (err) {
      showToast("Export failed: " + err.message, "error");
    }
  }

  async function handleSave(form, id) {
    if (id) {
      const { data } = await updateCredential(id, form);
      setCredentials((prev) => prev.map((c) => (c._id === id ? data : c)));
      showToast("Credential updated");
    } else {
      const { data } = await addCredential(form);
      setCredentials((prev) => [data, ...prev]);
      showToast("Credential added successfully");
    }
  }

  async function handleDelete(id) {
    setConfirmModal({
      title: "Delete credential?",
      message: "This credential will be permanently removed from your vault.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteCredential(id);
          setCredentials((prev) => prev.filter((c) => c._id !== id));
          showToast("Credential deleted");
        } catch {
          showToast("Failed to delete", "error");
        }
      },
    });
  }

  // Bulk delete — receives array of ids and a callback to exit bulk mode
  async function handleBulkDelete(ids, onDone) {
    setConfirmModal({
      title: `Delete ${ids.length} credential${ids.length > 1 ? "s" : ""}?`,
      message: "These credentials will be permanently removed. This cannot be undone.",
      confirmLabel: `Delete ${ids.length}`,
      danger: true,
      onConfirm: async () => {
        try {
          await Promise.all(ids.map((id) => deleteCredential(id)));
          setCredentials((prev) => prev.filter((c) => !ids.includes(c._id)));
          showToast(`${ids.length} credential${ids.length > 1 ? "s" : ""} deleted`);
          onDone?.();
        } catch {
          showToast("Failed to delete some credentials", "error");
        }
      },
    });
  }

  // Bulk move — update category for all selected ids
  async function handleBulkMove(ids, category, onDone) {
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const cred = credentials.find((c) => c._id === id);
          if (!cred) return null;
          const { data } = await updateCredential(id, { ...cred, category });
          return data;
        })
      );
      setCredentials((prev) =>
        prev.map((c) => {
          const updated = results.find((u) => u && u._id === c._id);
          return updated || c;
        })
      );
      showToast(`${ids.length} credential${ids.length > 1 ? "s" : ""} moved to ${category}`);
      onDone?.();
    } catch {
      showToast("Failed to move credentials", "error");
    }
  }

  function handleEdit(credential) {
    setEditData(credential);
    setShowModal(true);
  }

  async function handleRestorePassword(credential, oldPassword) {
    try {
      const { data } = await updateCredential(credential._id, { ...credential, password: oldPassword });
      setCredentials((prev) => prev.map((c) => (c._id === credential._id ? data : c)));
      showToast(`Password restored for ${credential.website}`);
    } catch {
      showToast("Failed to restore password", "error");
    }
  }

  // Rename a custom category across all credentials that use it
  async function handleRenameCategory(oldName, newName) {
    if (!newName || newName === oldName) return;
    try {
      const affected = credentials.filter((c) => c.category === oldName);
      const results  = await Promise.all(
        affected.map(async (c) => {
          const { data } = await updateCredential(c._id, { ...c, category: newName });
          return data;
        })
      );
      setCredentials((prev) =>
        prev.map((c) => {
          const updated = results.find((u) => u && u._id === c._id);
          return updated || c;
        })
      );
      if (activeCategory === oldName) setActiveCategory(newName);
      showToast(`Category renamed to "${newName}"`);
    } catch {
      showToast("Failed to rename category", "error");
    }
  }

  // Delete a custom category — moves all its credentials to "Others"
  async function handleDeleteCategory(name) {
    try {
      const affected = credentials.filter((c) => c.category === name);
      const results  = await Promise.all(
        affected.map(async (c) => {
          const { data } = await updateCredential(c._id, { ...c, category: "Others" });
          return data;
        })
      );
      setCredentials((prev) =>
        prev.map((c) => {
          const updated = results.find((u) => u && u._id === c._id);
          return updated || c;
        })
      );
      if (activeCategory === name) setActiveCategory("All");
      showToast(`"${name}" deleted — credentials moved to Others`);
    } catch {
      showToast("Failed to delete category", "error");
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditData(null);
  }

  function handleCategorySelect(cat) {
    setActiveCategory(cat);
    setSearch("");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Header
        credentialCount={credentials.length}
        onAdd={() => setShowModal(true)}
        onLock={onLock}
        onChangePassword={() => setShowChangePwd(true)}
        onExport={handleExport}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon="🔐" label="Total Credentials" value={credentials.length} color="indigo" />
          <StatCard icon="🛡️" label="Encryption Standard" value="AES-256" color="green" />
          <StatCard icon="💾" label="Storage Location" value="Local" color="purple" />
        </div>

        {/* Tab bar — NEW */}
        <TabBar
          active={activeTab}
          onChange={setActiveTab}
          credentialCount={credentials.length}
        />

        {/* Analytics tab — NEW */}
        {activeTab === "analytics" && (
          <AnalyticsDashboard
            credentials={credentials}
            onEdit={(cred) => { setActiveTab("vault"); handleEdit(cred); }}
          />
        )}

        {/* Vault tab — existing layout */}
        {activeTab === "vault" && (
          <div className="flex gap-6">
            <Sidebar
              credentials={credentials}
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
            />

            <div className="flex-1 min-w-0">
              <div className="mb-6">
                <SearchBar value={search} onChange={setSearch} />
              </div>

              {activeCategory !== "All" && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Showing:</span>
                  <span className="text-gray-900 dark:text-white text-sm font-medium">{activeCategory}</span>
                  <button onClick={() => handleCategorySelect("All")}
                    className="text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white underline ml-1">
                    Clear
                  </button>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-24">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <CredentialList credentials={credentials} search={search} activeCategory={activeCategory}
                  onDelete={handleDelete} onEdit={handleEdit} onBulkDelete={handleBulkDelete} onBulkMove={handleBulkMove}
                  reusedPasswords={reusedPasswords} onAdd={() => setShowModal(true)}
                  onHistory={(cred) => setHistoryCredential(cred)} />
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && <AddCredentialModal onClose={handleCloseModal} onSave={handleSave} editData={editData} />}
      {showChangePwd && (
        <ChangeMasterPasswordModal onClose={() => setShowChangePwd(false)}
          onSuccess={() => showToast("Master password updated successfully")} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}
      {historyCredential && (
        <PasswordHistoryModal
          credential={historyCredential}
          onClose={() => setHistoryCredential(null)}
          onRestore={handleRestorePassword}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400",
    green:  "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800/50 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800/50 text-purple-600 dark:text-purple-400",
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${colors[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-gray-900 dark:text-white font-bold text-xl leading-none">{value}</p>
        <p className="text-gray-500 text-xs mt-1">{label}</p>
      </div>
    </div>
  );
}