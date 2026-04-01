import { useState, useEffect } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import CredentialList from "../components/CredentialList";
import AddCredentialModal from "../components/AddCredentialModal";
import ChangeMasterPasswordModal from "../components/ChangeMasterPasswordModal";
import Toast from "../components/Toast";
import { fetchCredentials, addCredential, updateCredential, deleteCredential } from "../api/credentials";

export default function Dashboard({ onLock }) {
  const [credentials, setCredentials] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (!window.confirm("Delete this credential?")) return;
    try {
      await deleteCredential(id);
      setCredentials((prev) => prev.filter((c) => c._id !== id));
      showToast("Credential deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
  }

  function handleEdit(credential) {
    setEditData(credential);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditData(null);
  }

  // When switching category, clear the search so results aren't double-filtered confusingly
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
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon="🔐" label="Total Credentials" value={credentials.length} color="indigo" />
          <StatCard icon="🛡️" label="Encryption Standard" value="AES-256" color="green" />
          <StatCard icon="💾" label="Storage Location" value="Local" color="purple" />
        </div>

        {/* Main layout: sidebar + content */}
        <div className="flex gap-6">
          <Sidebar credentials={credentials} activeCategory={activeCategory} onSelect={handleCategorySelect} />

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
                onDelete={handleDelete} onEdit={handleEdit} reusedPasswords={reusedPasswords} />
            )}
          </div>
        </div>
      </div>

      {showModal && <AddCredentialModal onClose={handleCloseModal} onSave={handleSave} editData={editData} />}
      {showChangePwd && (
        <ChangeMasterPasswordModal onClose={() => setShowChangePwd(false)}
          onSuccess={() => showToast("Master password updated successfully")} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
