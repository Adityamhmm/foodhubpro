package com.foodhub.api;

import com.foodhub.api.dto.Requests;
import com.foodhub.data.StaffRole;
import com.foodhub.data.StaffUser;
import com.foodhub.data.StaffUserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/staff")
public class StaffController {
    private final StaffUserRepository users;
    private final PasswordEncoder encoder;

    public StaffController(StaffUserRepository users, PasswordEncoder encoder) {
        this.users = users;
        this.encoder = encoder;
    }

    @GetMapping
    public List<Map<String, Object>> users() {
        return users.findAll().stream().map(user -> Map.<String, Object>of(
            "username", user.getUsername(), "role", user.getRole().name(), "enabled", user.isEnabled())).toList();
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> create(@Valid @RequestBody Requests.StaffUser request) {
        StaffRole role;
        try {
            role = StaffRole.valueOf(request.role().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Role must be ADMIN or KITCHEN");
        }
        if (users.existsById(request.username())) throw new IllegalStateException("Username already exists");
        users.save(new StaffUser(request.username().trim(), encoder.encode(request.password()), role));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("username", request.username(), "role", role.name()));
    }

    @PatchMapping("/{username}/enabled")
    public ResponseEntity<Void> setEnabled(@PathVariable String username, @RequestBody Requests.Enabled request) {
        StaffUser user = users.findById(username).orElseThrow(() -> new java.util.NoSuchElementException("Staff user not found"));
        if (request.enabled() == null) throw new IllegalArgumentException("enabled is required");
        if (user.getRole() == StaffRole.ADMIN && !request.enabled()
            && users.findAll().stream().filter(candidate -> candidate.getRole() == StaffRole.ADMIN && candidate.isEnabled()).count() <= 1)
            throw new IllegalStateException("At least one enabled admin must remain");
        user.setEnabled(request.enabled());
        users.save(user);
        return ResponseEntity.noContent().build();
    }
}
