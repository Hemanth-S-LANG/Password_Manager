import api from "./axios";

export const fetchCredentials  = ()        => api.get("/credentials");
export const addCredential     = (data)    => api.post("/credentials", data);
export const updateCredential  = (id, data)=> api.put(`/credentials/${id}`, data);
export const deleteCredential  = (id)      => api.delete(`/credentials/${id}`);
