package com.foodhub.service;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class EventHub {
    private record Subscription(Integer table) {}

    private final Map<SseEmitter, Subscription> clients = new ConcurrentHashMap<>();
    private final AtomicLong eventId = new AtomicLong();

    public SseEmitter subscribe(Integer table) {
        SseEmitter emitter = new SseEmitter(0L);
        clients.put(emitter, new Subscription(table));
        emitter.onCompletion(() -> clients.remove(emitter));
        emitter.onTimeout(() -> clients.remove(emitter));
        emitter.onError(error -> clients.remove(emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("connected", true)));
        } catch (IOException e) {
            clients.remove(emitter);
            emitter.completeWithError(e);
        }
        return emitter;
    }

    public void publishAfterCommit(String type, Integer table, Map<String, ?> detail) {
        Runnable publish = () -> publish(type, table, detail);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish.run();
                }
            });
        } else {
            publish.run();
        }
    }

    private void publish(String type, Integer table, Map<String, ?> detail) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", type);
        data.put("table", table);
        data.putAll(detail);
        String id = Long.toString(eventId.incrementAndGet());
        clients.forEach((emitter, subscription) -> {
            if (subscription.table() != null && !subscription.table().equals(table)) return;
            try {
                emitter.send(SseEmitter.event().id(id).name(type).data(data, MediaType.APPLICATION_JSON));
            } catch (IOException e) {
                clients.remove(emitter);
                emitter.completeWithError(e);
            }
        });
    }
}
