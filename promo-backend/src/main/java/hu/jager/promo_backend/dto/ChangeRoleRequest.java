package hu.jager.promo_backend.dto;

import hu.jager.promo_backend.entity.AppUser;
import lombok.Data;

@Data
public class ChangeRoleRequest {
    private AppUser.Role role;
}