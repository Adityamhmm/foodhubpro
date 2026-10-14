"use client";

import {
  Children,
  cloneElement,
  type FormEvent,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
  CircleDollarSign,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Utensils,
} from "lucide-react";
import { EmptyState, Notice, StaffFrame } from "@/components/StaffFrame";
import { api, ApiError, eventStream } from "@/lib/api";
import { dateTime, money } from "@/lib/format";
import type {
  Bill,
  MenuItem,
  Order,
  RestaurantTable,
  Staff,
} from "@/lib/types";

type AdminRequest = {
  id: string;
  table: number;
  type: string;
  message: string;
  createdAt: string;
};
type CustomerMessage = {
  id: string;
  table: number;
  type: string;
  message: string;
  createdAt: string;
};
type TaxRule = { id: string; name: string; percent: number; active: boolean };
type Category = { id: string; name: string; sortOrder: number };
type Analytics = {
  orderCount: number;
  completedSales: number;
  averageOrderValue: number;
  openOrders: number;
  paidRevenue: number;
  activeTables: number;
  dailyRevenue: { day: string; revenue: number }[];
  popularItems: { name: string; quantity: number }[];
};
type AdminData = {
  analytics: Analytics;
  menu: MenuItem[];
  categories: Category[];
  tags: { id: string; name: string }[];
  taxes: TaxRule[];
  tables: RestaurantTable[];
  orders: Order[];
  requests: AdminRequest[];
  messages: CustomerMessage[];
  bills: Bill[];
  staff: Staff[];
  settings: Record<string, string>;
};

const emptyData: AdminData = {
  analytics: {
    orderCount: 0,
    completedSales: 0,
    averageOrderValue: 0,
    openOrders: 0,
    paidRevenue: 0,
    activeTables: 0,
    dailyRevenue: [],
    popularItems: [],
  },
  menu: [],
  categories: [],
  tags: [],
  taxes: [],
  tables: [],
  orders: [],
  requests: [],
  messages: [],
  bills: [],
  staff: [],
  settings: {},
};
const tabs = [
  "overview",
  "menu",
  "tables",
  "orders",
  "billing",
  "tax",
  "requests",
  "team",
  "settings",
] as const;
type Tab = (typeof tabs)[number];

export default function AdminPage() {
  const [data, setData] = useState<AdminData>(emptyData);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [menuForm, setMenuForm] = useState({
    id: "",
    name: "",
    category: "",
    description: "",
    imageUrl: "",
    foodType: "Vegetarian",
    price: "",
    available: true,
    tags: "",
  });
  const [tagName, setTagName] = useState("");
  const [newTable, setNewTable] = useState({ tableNumber: "", label: "" });
  const [taxForm, setTaxForm] = useState({
    name: "",
    percent: "",
    active: true,
  });
  const [billTable, setBillTable] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [staffForm, setStaffForm] = useState({
    username: "",
    password: "",
    role: "KITCHEN",
  });
  const [settingForm, setSettingForm] = useState({
    key: "restaurant.name",
    value: "",
  });

  const load = useCallback(async () => {
    try {
      const [
        analytics,
        menu,
        categories,
        tags,
        taxes,
        tables,
        orders,
        requests,
        messages,
        bills,
        staff,
        settings,
      ] = await Promise.all([
        api<Analytics>("/analytics"),
        api<MenuItem[]>("/menu-items"),
        api<Category[]>("/menu-categories"),
        api<AdminData["tags"]>("/menu-tags"),
        api<TaxRule[]>("/tax-rules"),
        api<RestaurantTable[]>("/tables"),
        api<Order[]>("/orders"),
        api<AdminRequest[]>("/requests"),
        api<CustomerMessage[]>("/customer-messages"),
        api<Bill[]>("/bills"),
        api<Staff[]>("/staff"),
        api<Record<string, string>>("/settings"),
      ]);
      setData({
        analytics,
        menu,
        categories,
        tags,
        taxes,
        tables,
        orders,
        requests,
        messages,
        bills,
        staff,
        settings,
      });
      setError("");
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "Workspace data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const updateTab = () => {
      const candidate = window.location.hash.slice(1) as Tab;
      setActiveTab(tabs.includes(candidate) ? candidate : "overview");
    };
    updateTab();
    window.addEventListener("hashchange", updateTab);
    window.addEventListener("popstate", updateTab);
    return () => {
      window.removeEventListener("hashchange", updateTab);
      window.removeEventListener("popstate", updateTab);
    };
  }, []);

  useEffect(() => {
    load();
    const stream = eventStream(
      "/events",
      () => load(),
      () => load(),
    );
    return () => stream.close();
  }, [load]);

  async function run(
    action: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(success);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The change could not be saved.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  function selectTab(tab: Tab) {
    const nextHash = `#${tab}`;
    if (window.location.hash === nextHash) {
      setActiveTab(tab);
      return;
    }
    window.location.hash = tab;
  }

  async function saveMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { id, ...fields } = menuForm;
    const body = {
      ...fields,
      price: Number(menuForm.price),
      tags: menuForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    const method = menuForm.id ? "PUT" : "POST";
    const path = menuForm.id ? `/menu-items/${menuForm.id}` : "/menu-items";
    const saved = await run(
      () => api(path, { method, body: JSON.stringify(body) }),
      menuForm.id ? "Menu item updated." : "Menu item added.",
    );
    if (saved)
      setMenuForm({
        id: "",
        name: "",
        category: "",
        description: "",
        imageUrl: "",
        foodType: "Vegetarian",
        price: "",
        available: true,
        tags: "",
      });
  }

  const filteredMenu = useMemo(
    () =>
      data.menu.filter((item) =>
        `${item.name} ${item.category} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data.menu, search],
  );
  const maxRevenue = Math.max(
    ...data.analytics.dailyRevenue.map((day) => Number(day.revenue)),
    0,
  );
  const openBills = data.bills.filter((bill) => !bill.paidAt);

  return (
    <StaffFrame
      role="ADMIN"
      title={activeTab === "overview" ? "Overview" : tabLabel(activeTab)}
      description={
        activeTab === "overview"
          ? "The pulse of your restaurant, at a glance."
          : "Manage the details that keep your restaurant running."
      }
    >
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice kind="success">{notice}</Notice> : null}
      <div className="admin-toolbar">
        <div className="tabs-row admin-tabs" aria-label="Management sections">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "selected" : ""}
              onClick={() => selectTab(tab)}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
        <button className="small-button" onClick={load} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className="panel">
          <div className="loading-line" />
        </div>
      ) : null}
      {!loading && activeTab === "overview" ? (
        <Overview data={data} maxRevenue={maxRevenue} onTab={selectTab} />
      ) : null}
      {!loading && activeTab === "menu" ? (
        <section id="menu" className="admin-section">
          <div className="two-column align-start">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Menu items</h2>
                  <p>{data.menu.length} items in the catalog</p>
                </div>
                <label className="admin-search">
                  <Search size={14} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search menu"
                    aria-label="Search menu items"
                  />
                </label>
              </div>
              {filteredMenu.length === 0 ? (
                <EmptyState
                  title="No menu items found."
                  detail="Add an item to start building your menu."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Available</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMenu.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <span className="table-secondary">
                              {item.foodType || "Dietary type not set"}
                            </span>
                          </td>
                          <td>{item.category}</td>
                          <td>{money(item.price)}</td>
                          <td>
                            <button
                              className={`toggle ${item.available ? "on" : ""}`}
                              aria-label={`${item.available ? "Disable" : "Enable"} ${item.name}`}
                              onClick={() =>
                                run(
                                  () =>
                                    api(`/menu-items/${item.id}`, {
                                      method: "PUT",
                                      body: JSON.stringify({
                                        ...item,
                                        available: !item.available,
                                      }),
                                    }),
                                  "Availability updated.",
                                )
                              }
                            >
                              <span />
                            </button>
                          </td>
                          <td>
                            <button
                              className="small-button"
                              onClick={() =>
                                setMenuForm({
                                  id: item.id,
                                  name: item.name,
                                  category: item.category,
                                  description: item.description ?? "",
                                  imageUrl: item.imageUrl ?? "",
                                  foodType: item.foodType ?? "",
                                  price: String(item.price),
                                  available: item.available,
                                  tags: item.tags.join(", "),
                                })
                              }
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <form className="panel" onSubmit={saveMenu}>
              <div className="panel-heading">
                <div>
                  <h2>{menuForm.id ? "Edit menu item" : "Add a menu item"}</h2>
                  <p>Prices are saved in MySQL and checked at checkout.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Item name">
                  <input
                    required
                    maxLength={160}
                    value={menuForm.name}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Category">
                  <input
                    required
                    list="category-options"
                    value={menuForm.category}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, category: e.target.value })
                    }
                  />
                  <datalist id="category-options">
                    {data.categories.map((category) => (
                      <option key={category.id}>{category.name}</option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Price (INR)">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={menuForm.price}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, price: e.target.value })
                    }
                  />
                </Field>
                <Field label="Food type">
                  <select
                    value={menuForm.foodType}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, foodType: e.target.value })
                    }
                  >
                    <option>Vegetarian</option>
                    <option>Vegan</option>
                    <option>Non-vegetarian</option>
                    <option>Egg</option>
                  </select>
                </Field>
                <Field label="Description" full>
                  <textarea
                    maxLength={2000}
                    value={menuForm.description}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Image URL" full>
                  <input
                    type="url"
                    maxLength={500}
                    placeholder="https://…"
                    value={menuForm.imageUrl}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, imageUrl: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tags (comma separated)" full>
                  <input
                    maxLength={500}
                    placeholder="Popular, House special"
                    value={menuForm.tags}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, tags: e.target.value })
                    }
                  />
                </Field>
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={menuForm.available}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, available: e.target.checked })
                    }
                  />{" "}
                  Available to order
                </label>
              </div>
              <div className="form-actions">
                <button className="button-primary" disabled={busy}>
                  {menuForm.id ? "Save changes" : "Add item"}
                  <ArrowRight size={14} />
                </button>
                {menuForm.id ? (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      setMenuForm({
                        id: "",
                        name: "",
                        category: "",
                        description: "",
                        imageUrl: "",
                        foodType: "Vegetarian",
                        price: "",
                        available: true,
                        tags: "",
                      })
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </div>
          <div className="two-column">
            <CategoryManager
              categories={data.categories}
              busy={busy}
              onSave={(id, name, sortOrder) =>
                run(
                  () =>
                    api(id ? `/menu-categories/${id}` : "/menu-categories", {
                      method: id ? "PUT" : "POST",
                      body: JSON.stringify({ name, sortOrder }),
                    }),
                  id ? "Category updated." : "Category created.",
                )
              }
            />
            <InlineCreate
              title="Menu tags"
              items={data.tags.map((item) => item.name)}
              value={tagName}
              onChange={setTagName}
              placeholder="New tag"
              submitLabel="Add tag"
              busy={busy}
              onSubmit={() =>
                run(
                  () =>
                    api("/menu-tags", {
                      method: "POST",
                      body: JSON.stringify({ name: tagName }),
                    }),
                  "Tag created.",
                ).then((saved) => {
                  if (saved) setTagName("");
                })
              }
            />
          </div>
        </section>
      ) : null}
      {!loading && activeTab === "tables" ? (
        <section id="tables" className="admin-section">
          <div className="two-column align-start">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Dining tables</h2>
                  <p>Tables registered for ordering.</p>
                </div>
              </div>
              {data.tables.length === 0 ? (
                <EmptyState
                  title="No tables registered."
                  detail="Add your restaurant’s table numbers to enable ordering."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Table</th>
                        <th>Activity</th>
                        <th>Bill request</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tables.map((table) => (
                        <tr key={table.tableNumber}>
                          <td>
                            <strong>{table.label}</strong>
                            <span className="table-secondary">
                              Table {table.tableNumber}
                            </span>
                          </td>
                          <td>
                            {table.online ? (
                              <span className="active-label">
                                <i /> Online
                              </span>
                            ) : (
                              <span className="table-secondary">
                                No recent activity
                              </span>
                            )}
                          </td>
                          <td>
                            {table.billRequested ? (
                              <span className="status-badge status-pending">
                                Requested
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <button
                              className={`toggle ${table.active ? "on" : ""}`}
                              aria-label={`${table.active ? "Deactivate" : "Activate"} ${table.label}`}
                              onClick={() =>
                                run(
                                  () =>
                                    api(`/tables/${table.tableNumber}/active`, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        active: !table.active,
                                      }),
                                    }),
                                  "Table updated.",
                                )
                              }
                            >
                              <span />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <form
              className="panel"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () =>
                    api("/tables", {
                      method: "POST",
                      body: JSON.stringify({
                        tableNumber: Number(newTable.tableNumber),
                        label: newTable.label,
                      }),
                    }),
                  "Table added.",
                ).then((saved) => {
                  if (saved) setNewTable({ tableNumber: "", label: "" });
                });
              }}
            >
              <div className="panel-heading">
                <div>
                  <h2>Add a table</h2>
                  <p>Keep the label recognizable for service.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Table number">
                  <input
                    required
                    type="number"
                    min="1"
                    value={newTable.tableNumber}
                    onChange={(e) =>
                      setNewTable({ ...newTable, tableNumber: e.target.value })
                    }
                  />
                </Field>
                <Field label="Display label">
                  <input
                    required
                    maxLength={80}
                    placeholder="Window table"
                    value={newTable.label}
                    onChange={(e) =>
                      setNewTable({ ...newTable, label: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="form-actions">
                <button className="button-primary" disabled={busy}>
                  Add table <Plus size={14} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
      {!loading && activeTab === "orders" ? (
        <section className="admin-section panel">
          <div className="panel-heading">
            <div>
              <h2>Order history</h2>
              <p>Live order records and kitchen status.</p>
            </div>
          </div>
          {data.orders.length === 0 ? (
            <EmptyState
              title="No orders yet."
              detail="Customer orders will appear here as they’re placed."
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Table</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                      </td>
                      <td>{order.table}</td>
                      <td>
                        {order.items
                          .map((item) => `${item.quantity} × ${item.name}`)
                          .join(", ")}
                      </td>
                      <td>{money(order.total)}</td>
                      <td>
                        <span
                          className={`status-badge status-${order.status.toLowerCase()}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td>{dateTime(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
      {!loading && activeTab === "billing" ? (
        <section id="billing" className="admin-section">
          <div className="two-column align-start">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Bills</h2>
                  <p>Itemized from completed, not-yet-billed orders.</p>
                </div>
              </div>
              {data.bills.length === 0 ? (
                <EmptyState
                  title="No bills created."
                  detail="Create a bill when a table’s completed orders are ready to close."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Table</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Created</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.bills.map((bill) => (
                        <tr key={bill.id}>
                          <td>
                            <strong>
                              #{bill.id.slice(0, 8).toUpperCase()}
                            </strong>
                          </td>
                          <td>{bill.table}</td>
                          <td>
                            <strong>{money(bill.grandTotal)}</strong>
                          </td>
                          <td>
                            {bill.paidAt ? (
                              <span className="status-badge status-completed">
                                {bill.paymentMethod}
                              </span>
                            ) : (
                              <span className="status-badge status-pending">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td>{dateTime(bill.createdAt)}</td>
                          <td>
                            {bill.paidAt ? null : (
                              <button
                                className="small-button accent"
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    () =>
                                      api(`/bills/${bill.id}/payment`, {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          method: paymentMethod,
                                        }),
                                      }),
                                    "Payment recorded.",
                                  )
                                }
                              >
                                Record payment
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Create a bill</h2>
                  <p>Only completed items not already billed are included.</p>
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  run(
                    () =>
                      api(`/bills?table=${Number(billTable)}`, {
                        method: "POST",
                      }),
                    "Bill created.",
                  ).then((saved) => {
                    if (saved) setBillTable("");
                  });
                }}
              >
                <div className="form-field">
                  <label htmlFor="bill-table">Table</label>
                  <select
                    id="bill-table"
                    required
                    value={billTable}
                    onChange={(e) => setBillTable(e.target.value)}
                  >
                    <option value="">Choose a table</option>
                    {data.tables.map((table) => (
                      <option key={table.tableNumber} value={table.tableNumber}>
                        {table.label} · {table.tableNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-actions">
                  <button
                    className="button-primary"
                    disabled={busy || !billTable}
                  >
                    Create bill <ArrowRight size={14} />
                  </button>
                </div>
              </form>
              <div className="payment-choice">
                <label htmlFor="payment-method">
                  Payment method for next payment
                </label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Card</option>
                </select>
              </div>
              <div className="open-bills-count">
                <CircleDollarSign size={15} /> {openBills.length} unpaid bills
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {!loading && activeTab === "tax" ? (
        <section className="admin-section">
          <div className="two-column align-start">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Tax rules</h2>
                  <p>Active rates are applied to new bills.</p>
                </div>
              </div>
              {data.taxes.length === 0 ? (
                <EmptyState
                  title="No tax rules configured."
                  detail="Add a tax rule based on your restaurant’s requirements."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Rate</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.taxes.map((tax) => (
                        <tr key={tax.id}>
                          <td>
                            <strong>{tax.name}</strong>
                          </td>
                          <td>
                            {Number(tax.percent)
                              .toFixed(3)
                              .replace(/0+$/, "")
                              .replace(/\.$/, "")}
                            %
                          </td>
                          <td>
                            <button
                              className={`toggle ${tax.active ? "on" : ""}`}
                              aria-label={`${tax.active ? "Disable" : "Enable"} ${tax.name}`}
                              onClick={() =>
                                run(
                                  () =>
                                    api(`/tax-rules/${tax.id}`, {
                                      method: "PUT",
                                      body: JSON.stringify({
                                        name: tax.name,
                                        percent: tax.percent,
                                        active: !tax.active,
                                      }),
                                    }),
                                  "Tax rule updated.",
                                )
                              }
                            >
                              <span />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <form
              className="panel"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () =>
                    api("/tax-rules", {
                      method: "POST",
                      body: JSON.stringify({
                        name: taxForm.name,
                        percent: Number(taxForm.percent),
                        active: taxForm.active,
                      }),
                    }),
                  "Tax rule created.",
                ).then((saved) => {
                  if (saved)
                    setTaxForm({ name: "", percent: "", active: true });
                });
              }}
            >
              <div className="panel-heading">
                <div>
                  <h2>Add tax rule</h2>
                  <p>Tax lines are stored with each bill.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Tax name">
                  <input
                    required
                    maxLength={120}
                    value={taxForm.name}
                    onChange={(e) =>
                      setTaxForm({ ...taxForm, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Percent">
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.001"
                    value={taxForm.percent}
                    onChange={(e) =>
                      setTaxForm({ ...taxForm, percent: e.target.value })
                    }
                  />
                </Field>
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={taxForm.active}
                    onChange={(e) =>
                      setTaxForm({ ...taxForm, active: e.target.checked })
                    }
                  />{" "}
                  Apply to new bills
                </label>
              </div>
              <div className="form-actions">
                <button className="button-primary" disabled={busy}>
                  Add tax rule <Plus size={14} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
      {!loading && activeTab === "requests" ? (
        <section className="admin-section two-column">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Table requests</h2>
                <p>Waiter and bill requests from customers.</p>
              </div>
            </div>
            {data.requests.length === 0 ? (
              <EmptyState
                title="No open requests."
                detail="Customer requests will appear here."
              />
            ) : (
              <div className="request-list">
                {data.requests.map((request) => (
                  <article className="request-row" key={request.id}>
                    <span className="table-chip">T{request.table}</span>
                    <div>
                      <strong>{request.type} request</strong>
                      <p>{request.message}</p>
                      <small>{dateTime(request.createdAt)}</small>
                    </div>
                    <button
                      className="small-button accent"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            api(`/requests/${request.id}`, {
                              method: "DELETE",
                            }),
                          "Request marked handled.",
                        )
                      }
                    >
                      Clear
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Customer messages</h2>
                <p>Notes sent from the ordering page.</p>
              </div>
            </div>
            {data.messages.length === 0 ? (
              <EmptyState
                title="No customer messages."
                detail="Messages will be listed here when guests send one."
              />
            ) : (
              <div className="request-list">
                {data.messages.map((message) => (
                  <div className="split-row" key={message.id}>
                    <span>
                      <span className="rank-number">T{message.table}</span>
                      {message.message}
                    </span>
                    <small>{dateTime(message.createdAt)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
      {!loading && activeTab === "team" ? (
        <section id="team" className="admin-section">
          <div className="two-column align-start">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Staff access</h2>
                  <p>Passwords are stored as BCrypt hashes.</p>
                </div>
              </div>
              {data.staff.length === 0 ? (
                <EmptyState
                  title="No staff accounts."
                  detail="The configured administrator account appears after the first backend start."
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Enabled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staff.map((member) => (
                        <tr key={member.username}>
                          <td>
                            <strong>{member.username}</strong>
                          </td>
                          <td>{member.role}</td>
                          <td>
                            <button
                              className={`toggle ${member.enabled ? "on" : ""}`}
                              aria-label={`${member.enabled ? "Disable" : "Enable"} ${member.username}`}
                              onClick={() =>
                                run(
                                  () =>
                                    api(
                                      `/staff/${encodeURIComponent(member.username)}/enabled`,
                                      {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          enabled: !member.enabled,
                                        }),
                                      },
                                    ),
                                  "Staff access updated.",
                                )
                              }
                            >
                              <span />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <form
              className="panel"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () =>
                    api("/staff", {
                      method: "POST",
                      body: JSON.stringify(staffForm),
                    }),
                  "Staff account created.",
                ).then((saved) => {
                  if (saved)
                    setStaffForm({
                      username: "",
                      password: "",
                      role: "KITCHEN",
                    });
                });
              }}
            >
              <div className="panel-heading">
                <div>
                  <h2>Add staff access</h2>
                  <p>Use a unique username and a strong password.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Username">
                  <input
                    required
                    maxLength={80}
                    autoComplete="off"
                    value={staffForm.username}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, username: e.target.value })
                    }
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={staffForm.role}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, role: e.target.value })
                    }
                  >
                    <option value="KITCHEN">Kitchen</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </Field>
                <Field label="Password (12+ characters)" full>
                  <input
                    required
                    minLength={12}
                    type="password"
                    autoComplete="new-password"
                    value={staffForm.password}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, password: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="form-actions">
                <button className="button-primary" disabled={busy}>
                  Create account <Plus size={14} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
      {!loading && activeTab === "settings" ? (
        <section id="settings" className="admin-section">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Restaurant settings</h2>
                <p>Stored as key/value settings in MySQL.</p>
              </div>
            </div>
            <div className="settings-list">
              {Object.entries(data.settings).length === 0 ? (
                <p className="muted-copy">
                  No settings have been saved. New settings are shown here after
                  they’re added.
                </p>
              ) : (
                Object.entries(data.settings).map(([key, value]) => (
                  <div className="setting-row" key={key}>
                    <label htmlFor={`setting-${key}`}>{key}</label>
                    <input
                      id={`setting-${key}`}
                      value={value}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            [key]: event.target.value,
                          },
                        }))
                      }
                    />
                    <button
                      className="small-button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            api("/settings", {
                              method: "PUT",
                              body: JSON.stringify({
                                key,
                                value: data.settings[key],
                              }),
                            }),
                          "Setting saved.",
                        )
                      }
                    >
                      Save
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="panel-heading setting-add-heading">
              <div>
                <h2>Add a setting</h2>
                <p>
                  Choose a clear key such as restaurant.name or service.hours.
                </p>
              </div>
            </div>
            <form
              className="inline-form setting-add"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () =>
                    api("/settings", {
                      method: "PUT",
                      body: JSON.stringify(settingForm),
                    }),
                  "Setting saved.",
                ).then((saved) => {
                  if (saved) setSettingForm({ key: "", value: "" });
                });
              }}
            >
              <input
                required
                maxLength={100}
                placeholder="Setting key"
                aria-label="Setting key"
                value={settingForm.key}
                onChange={(e) =>
                  setSettingForm({ ...settingForm, key: e.target.value })
                }
              />
              <input
                required
                maxLength={2000}
                placeholder="Value"
                aria-label="Setting value"
                value={settingForm.value}
                onChange={(e) =>
                  setSettingForm({ ...settingForm, value: e.target.value })
                }
              />
              <button className="small-button accent" disabled={busy}>
                Add setting <Plus size={13} />
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </StaffFrame>
  );
}

function Overview({
  data,
  maxRevenue,
  onTab,
}: {
  data: AdminData;
  maxRevenue: number;
  onTab: (tab: Tab) => void;
}) {
  const recentOrders = data.orders.slice(0, 5);
  const indiaToday = new Date(Date.now() + 330 * 60 * 1000);
  indiaToday.setUTCHours(0, 0, 0, 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(indiaToday);
    day.setUTCDate(day.getUTCDate() - (6 - index));
    const label = day.toISOString().slice(0, 10);
    return (
      data.analytics.dailyRevenue.find(
        (row) => String(row.day).slice(0, 10) === label,
      ) ?? { day: label, revenue: 0 }
    );
  });
  return (
    <>
      <div className="metric-grid">
        <Metric
          icon={<CircleDollarSign size={15} />}
          label="Paid revenue today"
          value={money(data.analytics.paidRevenue)}
          detail="Recorded payments"
        />
        <Metric
          icon={<ClipboardList size={15} />}
          label="Orders today"
          value={String(data.analytics.orderCount)}
          detail={`${data.analytics.openOrders} still in progress`}
        />
        <Metric
          icon={<BadgeIndianRupee size={15} />}
          label="Average completed order"
          value={money(data.analytics.averageOrderValue)}
          detail="Completed orders today"
        />
        <Metric
          icon={<Utensils size={15} />}
          label="Active tables"
          value={String(data.analytics.activeTables)}
          detail="Registered for dine-in"
        />
      </div>
      <div className="two-column">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Revenue</h2>
              <p>Paid bills over the last seven days</p>
            </div>
            <span className="subtle-unit">INR</span>
          </div>
          {maxRevenue === 0 ? (
            <div className="chart-empty">No paid bills in this period.</div>
          ) : (
            <div className="chart-bars" aria-label="Daily paid revenue">
              {week.map((day) => {
                const value = Number(day.revenue);
                const height = maxRevenue
                  ? Math.max(3, (value / maxRevenue) * 100)
                  : 0;
                return (
                  <div
                    className="chart-day"
                    key={String(day.day)}
                    title={`${String(day.day).slice(0, 10)}: ${money(value)}`}
                  >
                    <span style={{ height: `${height}%` }} />
                    <small>
                      {new Intl.DateTimeFormat("en-IN", {
                        weekday: "short",
                        timeZone: "UTC",
                      }).format(new Date(day.day))}
                    </small>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Popular this week</h2>
              <p>Items on paid bills</p>
            </div>
            <span className="panel-note">7 DAYS</span>
          </div>
          {data.analytics.popularItems.length === 0 ? (
            <EmptyState
              title="No sales data yet."
              detail="Paid bill items will appear here."
            />
          ) : (
            <div className="split-list">
              {data.analytics.popularItems.map((item, index) => (
                <div className="split-row" key={item.name}>
                  <span>
                    <span className="rank-number">0{index + 1}</span>
                    {item.name}
                  </span>
                  <strong>{item.quantity} sold</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent orders</h2>
            <p>Latest order activity across your tables.</p>
          </div>
          <button className="panel-link" onClick={() => onTab("orders")}>
            All orders <ArrowRight size={13} />
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <EmptyState
            title="Waiting for the first order."
            detail="Once a guest places an order, it will appear here."
          />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                    </td>
                    <td>{order.table}</td>
                    <td>
                      {order.items
                        .map((item) => `${item.quantity} × ${item.name}`)
                        .join(", ")}
                    </td>
                    <td>{money(order.total)}</td>
                    <td>
                      <span
                        className={`status-badge status-${order.status.toLowerCase()}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td>{dateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <div>
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  let labeled = false;
  const controls = Children.map(children, (child) => {
    if (!isValidElement(child) || labeled) return child;
    labeled = true;
    return cloneElement(child as React.ReactElement<{ id?: string }>, { id });
  });
  return (
    <div className={`form-field${full ? " full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {controls}
    </div>
  );
}

function InlineCreate({
  title,
  items,
  value,
  onChange,
  placeholder,
  submitLabel,
  busy,
  onSubmit,
}: {
  title: string;
  items: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{items.length} configured</p>
        </div>
      </div>
      <div className="tag-list">
        {items.length ? (
          items.map((item) => (
            <span className="soft-tag" key={item}>
              {item}
            </span>
          ))
        ) : (
          <span className="muted-copy">No {title.toLowerCase()} yet.</span>
        )}
      </div>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit();
        }}
      >
        <input
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={120}
        />
        <button className="small-button accent" disabled={busy}>
          {submitLabel}
          <Plus size={13} />
        </button>
      </form>
    </section>
  );
}

function CategoryManager({
  categories,
  busy,
  onSave,
}: {
  categories: Category[];
  busy: boolean;
  onSave: (
    id: string | null,
    name: string,
    sortOrder: number,
  ) => Promise<boolean>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  function edit(category: Category) {
    setId(category.id);
    setName(category.name);
    setSortOrder(String(category.sortOrder));
  }

  function reset() {
    setId(null);
    setName("");
    setSortOrder(String(categories.length));
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Categories</h2>
          <p>{categories.length} configured</p>
        </div>
      </div>
      {categories.length === 0 ? (
        <p className="muted-copy">No categories yet.</p>
      ) : (
        <div className="category-manage-list">
          {categories.map((category) => (
            <div className="category-manage-row" key={category.id}>
              <span>
                {category.name}
                <small>Order {category.sortOrder}</small>
              </span>
              <button
                type="button"
                className="small-button"
                onClick={() => edit(category)}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave(id, name.trim(), Number(sortOrder)).then((saved) => {
            if (saved) reset();
          });
        }}
      >
        <input
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={id ? "Category name" : "New category"}
          aria-label="Category name"
        />
        <input
          type="number"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          aria-label="Category sort order"
        />
        <button className="small-button accent" disabled={busy}>
          {id ? "Save" : "Add category"}
          <Plus size={13} />
        </button>
        {id ? (
          <button type="button" className="small-button" onClick={reset}>
            Cancel
          </button>
        ) : null}
      </form>
    </section>
  );
}

function tabLabel(tab: Tab) {
  return (
    {
      overview: "Overview",
      menu: "Menu",
      tables: "Tables",
      orders: "Orders",
      billing: "Billing",
      tax: "Tax",
      requests: "Requests",
      team: "Team",
      settings: "Settings",
    } as const
  )[tab];
}
