package com.sismos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SismosApplication {

    public static void main(String[] args) {
        SpringApplication.run(SismosApplication.class, args);
    }
}
