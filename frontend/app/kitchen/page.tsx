"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChefHat,
  Clock3,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { EmptyState, Notice, StaffFrame } from "@/components/StaffFrame";
import { api, ApiError, eventStream } from "@/lib/api";
import { shortTime } from "@/lib/format";
import type { Order } from "@/lib/types";

type KitchenRequest = {
  id: string;
  table: number;
  type: string;
  message: string;
  createdAt: string;
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<KitchenRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("Open");

  const load = useCallback(async () => {
    try {
      const [nextOrders, nextRequests] = await Promise.all([
        api<Order[]>("/orders"),
        api<KitchenRequest[]>("/requests"),
      ]);
      setOrders(nextOrders);
      setRequests(nextRequests);
      setError("");
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "Kitchen data could not be loaded.",
      );
    }
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

  const pending = useMemo(
    () => orders.filter((order) => order.status === "Pending"),
    [orders],
  );
  const accepted = useMemo(
    () => orders.filter((order) => order.status === "Accepted"),
    [orders],
  );
  const finished = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "Completed" || order.status === "Denied",
      ),
    [orders],
  );
  const visibleFinished = filter === "Finished" ? finished : [];

  async function setStatus(order: Order, status: string) {
    setBusy(order.id);
    try {
      await api(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Order could not be updated.",
      );
    } finally {
      setBusy("");
    }
  }

  async function clearRequest(id: string) {
    setBusy(id);
    try {
      await api(`/requests/${id}`, { method: "DELETE" });
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Request could not be cleared.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <StaffFrame
      role="KITCHEN"
      title="Kitchen"
      description="A clear view of what’s moving through the kitchen."
    >
      {error ? <Notice>{error}</Notice> : null}
      <div className="kitchen-toolbar">
        <div className="tabs-row">
          <button
            className={filter === "Open" ? "selected" : ""}
            onClick={() => setFilter("Open")}
          >
            Open orders <b>{pending.length + accepted.length}</b>
          </button>
          <button
            className={filter === "Finished" ? "selected" : ""}
            onClick={() => setFilter("Finished")}
          >
            Finished <b>{finished.length}</b>
          </button>
        </div>
        <button className="small-button" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {filter === "Open" ? (
        <div className="kitchen-columns">
          <KitchenColumn
            title="New orders"
            count={pending.length}
            orders={pending}
            busy={busy}
            onStatus={setStatus}
          />
          <KitchenColumn
            title="In preparation"
            count={accepted.length}
            orders={accepted}
            busy={busy}
            onStatus={setStatus}
          />
          <section className="kitchen-column">
            <div className="kitchen-column-head">
              <strong>
                <i /> Table requests
              </strong>
              <span>{requests.length}</span>
            </div>
            {requests.length === 0 ? (
              <p className="kitchen-empty-hint">No table requests right now.</p>
            ) : (
              requests.map((request) => (
                <article className="request-card" key={request.id}>
                  <div>
                    <span className="table-chip">T{request.table}</span>
                    <strong>
                      {request.type === "Bill"
                        ? "Bill requested"
                        : "Waiter requested"}
                    </strong>
                  </div>
                  <p>{request.message}</p>
                  <small>
                    <Clock3 size={11} /> {shortTime(request.createdAt)}
                  </small>
                  <button
                    className="small-button"
                    disabled={busy === request.id}
                    onClick={() => clearRequest(request.id)}
                  >
                    <Check size={13} /> Mark handled
                  </button>
                </article>
              ))
            )}
          </section>
        </div>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Finished orders</h2>
              <p>Orders completed or declined by the kitchen.</p>
            </div>
          </div>
          {visibleFinished.length === 0 ? (
            <EmptyState
              title="No finished orders yet."
              detail="Completed orders will appear here."
            />
          ) : (
            <div className="kitchen-columns kitchen-finished">
              {visibleFinished.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busy === order.id}
                  onStatus={setStatus}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <div className="kitchen-footnote">
        <span className="live-chip">
          <span /> Connected to live order updates
        </span>
        <span>Keep this screen open during service.</span>
      </div>
    </StaffFrame>
  );
}

function KitchenColumn({
  title,
  count,
  orders,
  busy,
  onStatus,
}: {
  title: string;
  count: number;
  orders: Order[];
  busy: string;
  onStatus: (order: Order, status: string) => void;
}) {
  return (
    <section className="kitchen-column">
      <div className="kitchen-column-head">
        <strong>
          <i /> {title}
        </strong>
        <span>{count}</span>
      </div>
      {orders.length === 0 ? (
        <p className="kitchen-empty-hint">
          {title === "New orders"
            ? "The queue is clear."
            : "Nothing cooking right now."}
        </p>
      ) : (
        orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            busy={busy === order.id}
            onStatus={onStatus}
          />
        ))
      )}
    </section>
  );
}

function OrderCard({
  order,
  busy,
  onStatus,
}: {
  order: Order;
  busy: boolean;
  onStatus: (order: Order, status: string) => void;
}) {
  return (
    <article className="kitchen-card">
      <div className="kitchen-card-top">
        <div>
          <strong>Table {order.table}</strong>
          <small className="table-secondary">
            Order #{order.id.slice(0, 6).toUpperCase()}
          </small>
        </div>
        <span className={`status-badge status-${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </div>
      <div className="kitchen-card-age">
        <Clock3 size={11} /> Placed {shortTime(order.createdAt)}
      </div>
      <div className="kitchen-card-items">
        {order.items.map((item, index) => (
          <div
            className="kitchen-card-item"
            key={`${order.id}-${item.id ?? index}`}
          >
            <b>{item.quantity}×</b>
            <span>{item.name}</span>
            {item.foodType ? <small>{item.foodType}</small> : null}
            {item.chefNote ? (
              <small className="line-note">· {item.chefNote}</small>
            ) : null}
          </div>
        ))}
      </div>
      {order.chefNote ? (
        <p className="chef-note">
          <ChefHat size={12} /> {order.chefNote}
        </p>
      ) : null}
      {order.status === "Pending" ? (
        <div className="kitchen-card-actions">
          <button
            className="small-button danger"
            disabled={busy}
            onClick={() => onStatus(order, "Denied")}
          >
            <X size={13} /> Decline
          </button>
          <button
            className="small-button accent"
            disabled={busy}
            onClick={() => onStatus(order, "Accepted")}
          >
            {busy ? (
              <LoaderCircle size={13} className="spin-icon" />
            ) : (
              <Check size={13} />
            )}{" "}
            Accept
          </button>
        </div>
      ) : null}
      {order.status === "Accepted" ? (
        <div className="kitchen-card-actions">
          <button
            className="small-button accent"
            disabled={busy}
            onClick={() => onStatus(order, "Completed")}
          >
            {busy ? (
              <LoaderCircle size={13} className="spin-icon" />
            ) : (
              <Check size={13} />
            )}{" "}
            Mark complete
          </button>
        </div>
      ) : null}
      {order.status === "Completed" ? (
        <p className="completed-note">
          <Check size={12} /> Completed
        </p>
      ) : null}
      {order.status === "Denied" ? (
        <p className="denied-note">
          <X size={12} /> Declined
        </p>
      ) : null}
    </article>
  );
}
