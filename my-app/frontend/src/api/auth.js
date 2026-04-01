import api from "./axios";

export const getAuthStatus        = ()                         => api.get("/auth/status");
export const createMasterPassword = (password)                 => api.post("/auth/create", { password });
export const verifyMasterPassword = (password)                 => api.post("/auth/verify", { password });
export const changeMasterPassword = (currentPassword, newPassword) =>
  api.put("/auth/change", { currentPassword, newPassword });
