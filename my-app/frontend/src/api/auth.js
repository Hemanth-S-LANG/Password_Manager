import api from "./axios";

export const getAuthStatus           = ()                              => api.get("/auth/status");
export const createMasterPassword    = (password)                      => api.post("/auth/create", { password });
export const verifyMasterPassword    = (password)                      => api.post("/auth/verify", { password });
export const changeMasterPassword    = (currentPassword, newPassword)  => api.put("/auth/change", { currentPassword, newPassword });
export const getSecurityQStatus      = ()                              => api.get("/auth/security-questions/status");
export const saveSecurityQuestions   = (answers)                       => api.post("/auth/security-questions/save", { answers });
export const verifySecurityQuestions = (answers)                       => api.post("/auth/security-questions/verify", { answers });
export const resetMasterPassword     = (answers, newPassword)          => api.post("/auth/reset-password", { answers, newPassword });
