import { useEffect, useMemo, useState, type FormEvent } from "react";

type Filter = {
  id: number;
  reference: string;
  name: string;
  brand: string;
  width: number;
  height: number;
  depth: number | null;
  description: string;
};

type NewFilterForm = {
  reference: string;
  name: string;
  brand: string;
  width: string;
  height: string;
  depth: string;
  description: string;
};

function App() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Filter | null>(null);
  const [editForm, setEditForm] = useState<NewFilterForm>({
    reference: "",
    name: "",
    brand: "",
    width: "",
    height: "",
    depth: "",
    description: "",
  });

  // Top form: add a new filter
  const [newFilter, setNewFilter] = useState<NewFilterForm>({
    reference: "",
    name: "",
    brand: "",
    width: "",
    height: "",
    depth: "",
    description: "",
  });

  // Middle: search fields
  const [search, setSearch] = useState({
    brand: "",
    width: "",
    height: "",
    keyword: "",
  });

  const hasSearch = useMemo(() => {
    return Boolean(
      search.brand || search.width || search.height || search.keyword,
    );
  }, [search]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/filters");
      if (!res.ok) throw new Error("Failed to load filters");
      const data = (await res.json()) as Filter[];
      setFilters(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const brand = search.brand.trim();
      const width = search.width.trim();
      const height = search.height.trim();
      const keyword = search.keyword.trim();

      const params = new URLSearchParams();
      if (brand) params.set("brand", brand);
      if (width) params.set("width", width);
      if (height) params.set("height", height);
      if (keyword) params.set("keyword", keyword);

      const res = await fetch(`/filters/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as Filter[];
      setFilters(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch();
  }

  async function refreshList() {
    if (hasSearch) {
      await runSearch();
    } else {
      await loadAll();
    }
  }

  function openEdit(f: Filter) {
    setError(null);
    setSuccess(null);
    setEditing(f);
    setEditForm({
      reference: f.reference,
      name: f.name,
      brand: f.brand,
      width: String(f.width),
      height: String(f.height),
      depth: f.depth === null ? "" : String(f.depth),
      description: f.description,
    });
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      reference: editForm.reference,
      name: editForm.name,
      brand: editForm.brand,
      width: Number(editForm.width),
      height: Number(editForm.height),
      depth: editForm.depth === "" ? null : Number(editForm.depth),
      description: editForm.description,
    };

    try {
      const res = await fetch(`/filters/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Reference already exists");
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to update filter");
      }

      closeEdit();
      setSuccess("Filter updated successfully");
      await refreshList();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function deleteFilter(filterId: number) {
    const ok = window.confirm("Delete this filter? This cannot be undone.");
    if (!ok) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/filters/${filterId}`, { method: "DELETE" });
      if (res.status === 404) throw new Error("Filter not found");
      if (!res.ok) throw new Error("Failed to delete filter");

      setSuccess("Filter deleted successfully");
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function addFilter(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Simple conversion: keep inputs as strings, convert numbers just before POST.
    const payload = {
      reference: newFilter.reference,
      name: newFilter.name,
      brand: newFilter.brand,
      width: Number(newFilter.width),
      height: Number(newFilter.height),
      depth: newFilter.depth === "" ? null : Number(newFilter.depth),
      description: newFilter.description,
    };

    try {
      const res = await fetch("/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Reference already exists");
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to add filter");
      }

      setNewFilter({
        reference: "",
        name: "",
        brand: "",
        width: "",
        height: "",
        depth: "",
        description: "",
      });
      setSuccess("Filter added successfully");

      // After adding, refresh the list.
      // If you are currently searching, keep showing the filtered results.
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Product Filters
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Add and search filters by brand, size, or keyword.
          </p>
        </header>

        {/* TOP: Add new filter */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Add a New Filter</h2>
          <form onSubmit={addFilter} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">
                <div className="mb-1 font-medium">Reference (unique)</div>
                <input
                  value={newFilter.reference}
                  onChange={(e) =>
                    setNewFilter((p) => ({ ...p, reference: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. BOSCH-OF-250-150"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Name</div>
                <input
                  value={newFilter.name}
                  onChange={(e) =>
                    setNewFilter((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. Oil Filter Standard"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Brand</div>
                <input
                  value={newFilter.brand}
                  onChange={(e) =>
                    setNewFilter((p) => ({ ...p, brand: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. Bosch"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Width</div>
                <input
                  value={newFilter.width}
                  onChange={(e) =>
                    setNewFilter((p) => ({ ...p, width: e.target.value }))
                  }
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. 300"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Height</div>
                <input
                  value={newFilter.height}
                  onChange={(e) =>
                    setNewFilter((p) => ({ ...p, height: e.target.value }))
                  }
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. 200"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Depth (optional)</div>
                <input
                  value={newFilter.depth}
                  onChange={(e) =>
                    setNewFilter((p) => ({ ...p, depth: e.target.value }))
                  }
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. 35"
                />
              </label>
            </div>

            <label className="block text-sm">
              <div className="mb-1 font-medium">Description</div>
              <textarea
                value={newFilter.description}
                onChange={(e) =>
                  setNewFilter((p) => ({ ...p, description: e.target.value }))
                }
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                placeholder="Short description..."
                required
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={loading}
              >
                Add Filter
              </button>

              <div className="text-sm">
                {error ? <span className="text-red-600">{error}</span> : null}
                {success ? (
                  <span className="text-green-700">{success}</span>
                ) : null}
              </div>
            </div>
          </form>
        </section>

        {/* MIDDLE: Search */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Search</h2>
          <form onSubmit={onSearchSubmit}>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <div className="mb-1 font-medium">Brand (optional)</div>
                <input
                  value={search.brand}
                  onChange={(e) =>
                    setSearch((p) => ({ ...p, brand: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. Bosch"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Width (optional)</div>
                <input
                  value={search.width}
                  onChange={(e) =>
                    setSearch((p) => ({ ...p, width: e.target.value }))
                  }
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. 75"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Height (optional)</div>
                <input
                  value={search.height}
                  onChange={(e) =>
                    setSearch((p) => ({ ...p, height: e.target.value }))
                  }
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="e.g. 100"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Keyword (optional)</div>
                <input
                  value={search.keyword}
                  onChange={(e) =>
                    setSearch((p) => ({ ...p, keyword: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  placeholder="Search name/description"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={loading}
              >
                Search
              </button>
              <button
                type="button"
                onClick={loadAll}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                disabled={loading}
              >
                Show All
              </button>
              <div className="text-sm text-slate-600">
                {loading ? "Loading..." : `${filters.length} result(s)`}
              </div>
            </div>
          </form>
        </section>

        {/* BOTTOM: Results table */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Filters</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="px-3 py-2 font-semibold">Reference</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Brand</th>
                  <th className="px-3 py-2 font-semibold">Width</th>
                  <th className="px-3 py-2 font-semibold">Height</th>
                  <th className="px-3 py-2 font-semibold">Depth</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filters.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="px-3 py-2 font-medium">{f.reference}</td>
                    <td className="px-3 py-2">{f.name}</td>
                    <td className="px-3 py-2">{f.brand}</td>
                    <td className="px-3 py-2">{f.width}</td>
                    <td className="px-3 py-2">{f.height}</td>
                    <td className="px-3 py-2">{f.depth ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {f.description}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(f)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFilter(f.id)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && filters.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-slate-600"
                      colSpan={8}
                    >
                      No filters found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Edit Filter</h3>
                <div className="mt-1 text-sm text-slate-600">
                  ID: {editing.id}
                </div>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveEdit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Reference (unique)</div>
                  <input
                    value={editForm.reference}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, reference: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                    required
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-medium">Name</div>
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                    required
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-medium">Brand</div>
                  <input
                    value={editForm.brand}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, brand: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                    required
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-medium">Width</div>
                  <input
                    value={editForm.width}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, width: e.target.value }))
                    }
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                    required
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-medium">Height</div>
                  <input
                    value={editForm.height}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, height: e.target.value }))
                    }
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                    required
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-medium">Depth (optional)</div>
                  <input
                    value={editForm.depth}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, depth: e.target.value }))
                    }
                    type="number"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <label className="block text-sm">
                <div className="mb-1 font-medium">Description</div>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
                  required
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={loading}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
