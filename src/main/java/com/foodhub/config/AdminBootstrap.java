package com.foodhub.config;

import com.foodhub.data.StaffRole;
import com.foodhub.data.StaffUser;
import com.foodhub.data.StaffUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class AdminBootstrap implements ApplicationRunner {
    private final StaffUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String password;

    public AdminBootstrap(StaffUserRepository users, PasswordEncoder passwordEncoder,
                          @Value("${app.admin.username}") String username,
                          @Value("${app.admin.password}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (password == null || password.length() < 12)
            throw new IllegalStateException("Set ADMIN_PASSWORD to a value with at least 12 characters");
        if (!users.existsById(username))
            users.save(new StaffUser(username, passwordEncoder.encode(password), StaffRole.ADMIN));
    }
}
