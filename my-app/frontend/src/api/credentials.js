import api from "./axios";

export const fetchCredentials  = ()          => api.get("/credentials");
export const fetchStats        = ()          => api.get("/credentials/stats");           // NEW — vault analytics
export const addCredential     = (data)      => api.post("/credentials", data);
export const updateCredential  = (id, data)  => api.put(`/credentials/${id}`, data);
export const markUsed          = (id)        => api.patch(`/credentials/${id}/used`);    // NEW — record autofill usage
export const deleteCredential  = (id)        => api.delete(`/credentials/${id}`);