"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { FoodVisual } from "@/components/FoodVisual";
import { api, eventStream } from "@/lib/api";
import { money, shortTime } from "@/lib/format";
import type { MenuItem, Order } from "@/lib/types";

type CartLine = { item: MenuItem; quantity: number; note: string };
type Category = { id: string; name: string; sortOrder: number };
type CustomerRequest = {
  table: number;
  type: "Waiter" | "Bill";
  message: string;
};

const filters = ["Everything", "Vegetarian", "Vegan", "Gluten-free"];

export default function CustomerPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [table, setTable] = useState("");
  const [activeCategory, setActiveCategory] = useState("Everything");
  const [activeFilter, setActiveFilter] = useState("Everything");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuError, setMenuError] = useState("");
  const [notice, setNotice] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [confirmed, setConfirmed] = useState<Order | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadMenu = useCallback(async () => {
    const [items, groups] = await Promise.all([
      api<MenuItem[]>("/menu-items"),
      api<Category[]>("/menu-categories"),
    ]);
    setMenu(items);
    setCategories(groups);
  }, []);

  const loadOrders = useCallback(async (tableNumber: number) => {
    try {
      setOrders(await api<Order[]>(`/tables/${tableNumber}/orders`));
    } catch (failure) {
      if (failure instanceof Error) setError(failure.message);
    }
  }, []);

  useEffect(() => {
    const queryTable = new URLSearchParams(window.location.search).get("table");
    if (queryTable && /^\d+$/.test(queryTable)) setTable(queryTable);
    loadMenu()
      .catch((failure: unknown) =>
        setMenuError(
          failure instanceof Error
            ? failure.message
            : "Menu could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [loadMenu]);

  useEffect(() => {
    const number = Number(table);
    if (!Number.isInteger(number) || number < 1) {
      setOrders([]);
      return;
    }
    let current = true;
    let stream: EventSource | undefined;
    api(`/tables/${number}`)
      .then(() => {
        if (!current) return;
        loadOrders(number);
        stream = eventStream(
          `/events?table=${number}`,
          () => loadOrders(number),
          () => loadOrders(number),
        );
      })
      .catch((failure: unknown) => {
        if (current)
          setError(
            failure instanceof Error
              ? failure.message
              : "This table is not available.",
          );
      });
    return () => {
      current = false;
      stream?.close();
    };
  }, [table, loadOrders]);

  const shownMenu = useMemo(
    () =>
      menu.filter((item) => {
        const query = search.trim().toLowerCase();
        const matchesText =
          !query ||
          [
            item.name,
            item.description ?? "",
            item.category,
            ...(item.tags ?? []),
          ].some((value) => value.toLowerCase().includes(query));
        const matchesCategory =
          activeCategory === "Everything" || item.category === activeCategory;
        const labels = [item.foodType ?? "", ...(item.tags ?? [])]
          .join(" ")
          .toLowerCase();
        const matchesDiet =
          activeFilter === "Everything" ||
          labels.includes(activeFilter.toLowerCase());
        return item.available && matchesText && matchesCategory && matchesDiet;
      }),
    [menu, search, activeCategory, activeFilter],
  );

  const cartLines = Object.values(cart);
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce(
    (sum, line) => sum + Number(line.item.price) * line.quantity,
    0,
  );

  useEffect(() => {
    const number = Number(table);
    if (!Number.isInteger(number) || number < 1) return;
    const ping = () =>
      api<void>(`/table-sessions/${number}`, {
        method: "POST",
        body: JSON.stringify({ hasCart: itemCount > 0 }),
      }).catch(() => undefined);
    ping();
    const interval = window.setInterval(ping, 60_000);
    return () => window.clearInterval(interval);
  }, [table, itemCount]);

  function changeQuantity(id: string, amount: number) {
    setCart((current) => {
      const line = current[id];
      if (!line && amount > 0) {
        const item = menu.find((candidate) => candidate.id === id);
        if (!item) return current;
        return { ...current, [id]: { item, quantity: 1, note: "" } };
      }
      if (!line) return current;
      const quantity = line.quantity + amount;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: { ...line, quantity } };
    });
  }

  async function placeOrder() {
    if (!Number(table) || !itemCount) return;
    setPlacing(true);
    setError("");
    try {
      const result = await api<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          table: Number(table),
          items: cartLines.map(({ item, quantity, note }) => ({
            id: item.id,
            quantity,
            chefNote: note,
          })),
        }),
      });
      setConfirmed(result);
      setCart({});
      setDrawerOpen(false);
      await loadOrders(Number(table));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your order could not be placed.",
      );
    } finally {
      setPlacing(false);
    }
  }

  async function sendRequest(type: "Waiter" | "Bill") {
    if (!Number(table)) {
      setNotice("Enter your table number first.");
      return;
    }
    setRequestBusy(true);
    setNotice("");
    try {
      await api<CustomerRequest>("/requests", {
        method: "POST",
        body: JSON.stringify({ table: Number(table), type, message: "" }),
      });
      setNotice(
        type === "Bill"
          ? "Your bill request is with the team."
          : "A team member will be with you shortly.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Request could not be sent.",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number(table)) {
      setError("Enter your table number first.");
      return;
    }
    if (!message.trim()) return;
    setRequestBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/customer-messages", {
        method: "POST",
        body: JSON.stringify({
          table: Number(table),
          type: "Note",
          message: message.trim(),
        }),
      });
      setMessage("");
      setNotice("Your note has been shared with the team.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your note could not be sent.",
      );
    } finally {
      setRequestBusy(false);
    }
  }

  useEffect(() => {
    if (!selected && !drawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[aria-modal='true']");
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
    );
    focusable?.[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        setDrawerOpen(false);
      }
      if (event.key === "Tab" && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [selected, drawerOpen]);

  return (
    <main className="customer-page">
      <header className="customer-header">
        <a
          className="brand-lockup customer-brand"
          href="/"
          aria-label="FoodHub home"
        >
          <span className="brand-mark">
            <Utensils size={17} />
          </span>
          <span>
            foodhub<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="customer-context">
          <span className="context-dot" /> <span>DINE IN</span>
          <span className="context-divider" />
          <label htmlFor="table-number">TABLE</label>
          <input
            id="table-number"
            aria-label="Table number"
            type="number"
            min="1"
            value={table}
            onChange={(event) => {
              setTable(event.target.value);
              setConfirmed(null);
            }}
            placeholder="—"
          />
        </div>
        <button
          className="cart-open"
          onClick={() => setDrawerOpen(true)}
          aria-label={`Open order, ${itemCount} items`}
        >
          <ShoppingBag size={18} />
          <span>Order</span>
          <b>{itemCount}</b>
        </button>
      </header>

      <section className="customer-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={13} /> MADE FOR THE TABLE
          </div>
          <h1>
            Good food.
            <br />
            <em>Good company.</em>
          </h1>
          <p>Take your time. We’ll take care of the rest.</p>
          <a className="hero-scroll" href="#menu">
            Explore the menu <ArrowDown size={14} />
          </a>
        </div>
        <div className="hero-note">
          <span className="note-index">01 — 03</span>
          <div className="hero-note-rule" />
          <p>
            Thoughtfully prepared,
            <br />
            served at your pace.
          </p>
          <span className="hero-note-caption">A BETTER KIND OF DINING</span>
        </div>
        <div className="hero-ornament" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section id="menu" className="menu-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE KITCHEN, TODAY</div>
            <h2>Explore the menu</h2>
            <p>Freshly prepared and made to be shared.</p>
          </div>
          <div className="menu-tools">
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search the menu"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find something good"
              />
            </label>
          </div>
        </div>
        <div className="menu-controls">
          <div
            className="category-list"
            role="tablist"
            aria-label="Menu categories"
          >
            {["Everything", ...categories.map((category) => category.name)].map(
              (category) => (
                <button
                  key={category}
                  role="tab"
                  aria-selected={activeCategory === category}
                  className={activeCategory === category ? "selected" : ""}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ),
            )}
          </div>
          <label className="diet-select">
            <span className="sr-only">Filter by dietary preference</span>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              {filters.map((filter) => (
                <option key={filter}>{filter}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>

        {menuError || error ? (
          <div className="customer-alert" role="alert">
            <span>{menuError || error}</span>
            {menuError ? (
              <button
                onClick={() => {
                  setMenuError("");
                  loadMenu().catch((failure) => setMenuError(String(failure)));
                }}
              >
                Try again
              </button>
            ) : (
              <button onClick={() => setError("")}>Dismiss</button>
            )}
          </div>
        ) : null}
        {loading ? (
          <div className="menu-grid" aria-label="Loading menu">
            {[1, 2, 3, 4].map((value) => (
              <div className="menu-skeleton" key={value}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : null}
        {!loading && !menuError && shownMenu.length === 0 ? (
          <div className="menu-empty">
            <span className="empty-dish">
              <Utensils size={20} />
            </span>
            <strong>
              {menu.length
                ? "Nothing on the menu matches that."
                : "The menu is being prepared."}
            </strong>
            <p>
              {menu.length
                ? "Try another category or clear your search."
                : "Please check back in a moment, or ask a team member for help."}
            </p>
          </div>
        ) : null}
        {!loading && shownMenu.length > 0 ? (
          <div className="menu-grid">
            {shownMenu.map((item, index) => (
              <article className="menu-card" key={item.id}>
                <button
                  className="menu-card-main"
                  onClick={() => setSelected(item)}
                  aria-label={`View ${item.name}`}
                >
                  <div className="menu-card-image">
                    <FoodVisual
                      src={item.imageUrl}
                      alt={item.name}
                      tone={["sage", "sand", "rose", "blue"][index % 4]}
                    />
                    <span
                      className={`diet-marker ${item.foodType?.toLowerCase().includes("non") ? "non-veg" : "veg"}`}
                      title={item.foodType || "Dietary type not specified"}
                    >
                      <i />
                    </span>
                  </div>
                  <div className="menu-card-copy">
                    <div className="menu-meta">
                      <span>{item.category}</span>
                      {item.tags?.[0] ? (
                        <span className="menu-tag">{item.tags[0]}</span>
                      ) : null}
                    </div>
                    <h3>{item.name}</h3>
                    <p>
                      {item.description || "Prepared fresh in our kitchen."}
                    </p>
                    <div className="menu-card-bottom">
                      <strong>{money(item.price)}</strong>
                      <span className="add-hint">
                        Details <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  className="quick-add"
                  onClick={() => changeQuantity(item.id, 1)}
                  aria-label={`Add ${item.name} to your order`}
                >
                  <Plus size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="table-service">
        <div>
          <div className="eyebrow">HERE WHEN YOU NEED US</div>
          <h2>Your table, your pace.</h2>
          <p>
            Need a hand or ready for the bill? Send a quiet note to the team.
          </p>
          <form className="guest-message-form" onSubmit={sendMessage}>
            <label htmlFor="guest-message">Send a message</label>
            <div>
              <input
                id="guest-message"
                value={message}
                maxLength={2000}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Something we can help with?"
              />
              <button
                disabled={requestBusy || !message.trim()}
                aria-label="Send your message"
              >
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </div>
        <div className="service-actions">
          <button onClick={() => sendRequest("Waiter")} disabled={requestBusy}>
            <span>01</span> Ask for a waiter <ArrowRight size={15} />
          </button>
          <button onClick={() => sendRequest("Bill")} disabled={requestBusy}>
            <span>02</span> Request the bill <ArrowRight size={15} />
          </button>
        </div>
      </section>
      {notice ? (
        <div className="toast-notice" role="status">
          <Check size={16} />
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      <section className="order-status-section" aria-label="Order status">
        {confirmed ? (
          <div className="confirmation-strip">
            <span className="confirm-check">
              <Check size={16} />
            </span>
            <div>
              <strong>Your order is in the kitchen.</strong>
              <p>
                Order {confirmed.id.slice(0, 8)} · {money(confirmed.total)}
              </p>
            </div>
            <button
              onClick={() => setConfirmed(null)}
              aria-label="Dismiss order confirmation"
            >
              <X size={15} />
            </button>
          </div>
        ) : null}
        {orders.length > 0 ? (
          <div className="table-orders">
            <div className="table-orders-heading">
              <div>
                <span className="eyebrow">TABLE {table}</span>
                <h2>At your table</h2>
              </div>
              <span className="live-chip">
                <span /> Updates live
              </span>
            </div>
            {orders.map((order) => (
              <div className="customer-order" key={order.id}>
                <div className="order-id">
                  <span>ORDER</span>
                  <strong>#{order.id.slice(0, 6).toUpperCase()}</strong>
                  <small>{shortTime(order.createdAt)}</small>
                </div>
                <div className="order-items-preview">
                  {order.items.map((item) => (
                    <span key={`${order.id}-${item.id}`}>
                      {item.quantity} × {item.name}
                    </span>
                  ))}
                </div>
                <div
                  className={`status-badge status-${order.status.toLowerCase()}`}
                >
                  {order.status}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <footer className="customer-footer">
        <a className="brand-lockup" href="/">
          <span className="brand-mark">
            <Utensils size={15} />
          </span>
          <span>
            foodhub<span className="brand-dot">.</span>
          </span>
        </a>
        <span>Good food, shared well.</span>
        <span>EST. FOR THE TABLE</span>
      </footer>

      {itemCount > 0 ? (
        <button
          className="mobile-order-bar"
          onClick={() => setDrawerOpen(true)}
        >
          <span>
            <ShoppingBag size={17} /> View your order <b>{itemCount}</b>
          </span>
          <strong>
            {money(subtotal)} <ArrowRight size={16} />
          </strong>
        </button>
      ) : null}

      {selected ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="item-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-title"
          >
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close item details"
            >
              <X size={18} />
            </button>
            <FoodVisual
              src={selected.imageUrl}
              alt={selected.name}
              tone="sage"
            />
            <div className="item-modal-copy">
              <div className="eyebrow">{selected.category}</div>
              <h2 id="item-title">{selected.name}</h2>
              <p>{selected.description || "Prepared fresh in our kitchen."}</p>
              <div className="tag-row">
                {selected.foodType ? <span>{selected.foodType}</span> : null}
                {selected.tags?.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="item-modal-footer">
                <strong>{money(selected.price)}</strong>
                <button
                  className="button-primary"
                  onClick={() => {
                    changeQuantity(selected.id, 1);
                    setSelected(null);
                  }}
                >
                  Add to order <Plus size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {drawerOpen ? (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerOpen(false);
          }}
        >
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="drawer-heading">
              <div>
                <div className="eyebrow">TABLE {table || "—"}</div>
                <h2 id="cart-title">Your order</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close order"
              >
                <X size={19} />
              </button>
            </div>
            {cartLines.length === 0 ? (
              <div className="drawer-empty">
                <ShoppingBag size={24} />
                <strong>Your order is empty.</strong>
                <p>Choose something from the menu and it will show up here.</p>
                <button onClick={() => setDrawerOpen(false)}>
                  Back to the menu
                </button>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cartLines.map(({ item, quantity, note }) => (
                    <div className="cart-line" key={item.id}>
                      <div className="cart-line-info">
                        <strong>{item.name}</strong>
                        <span>{money(Number(item.price) * quantity)}</span>
                        <label>
                          <span className="sr-only">Note for {item.name}</span>
                          <input
                            value={note}
                            onChange={(event) =>
                              setCart((current) => ({
                                ...current,
                                [item.id]: {
                                  ...current[item.id],
                                  note: event.target.value,
                                },
                              }))
                            }
                            placeholder="Add a note for the kitchen"
                            maxLength={250}
                          />
                        </label>
                      </div>
                      <div className="quantity-control">
                        <button
                          onClick={() => changeQuantity(item.id, -1)}
                          aria-label={`Remove one ${item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{quantity}</span>
                        <button
                          onClick={() => changeQuantity(item.id, 1)}
                          aria-label={`Add one ${item.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </div>
                  <p>Taxes, if applicable, are calculated by the restaurant.</p>
                  <button
                    className="button-primary order-submit"
                    disabled={placing || !Number(table)}
                    onClick={placeOrder}
                  >
                    {placing ? "Sending to the kitchen…" : "Place order"}
                    <ArrowRight size={16} />
                  </button>
                  {!Number(table) ? (
                    <small className="table-reminder">
                      Add your table number before placing an order.
                    </small>
                  ) : null}
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
