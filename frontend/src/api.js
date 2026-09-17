const API_BASE = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? "http://localhost:8000" : "https://sehat-sathi-5ntr.onrender.com");
const TOKEN_KEY = "sehat_saathi_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});

  const token = getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        if (typeof errorJson.detail === "string") {
          errorMessage = errorJson.detail;
        } else if (Array.isArray(errorJson.detail)) {
          errorMessage = errorJson.detail.map((e) => e.msg || e.message).join(", ");
        }
      }
    } catch {
      // response wasn't json, use default message
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

export const api = {
  // Auth
  async login(email, password) {
    const res = await request("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (res.access_token) {
      setToken(res.access_token);
    }
    return res;
  },

  async register(data) {
    const res = await request("/auth/register", {
      method: "POST",
      body: data,
    });
    if (res.access_token) {
      setToken(res.access_token);
    }
    return res;
  },

  async getMe() {
    return await request("/auth/me");
  },

  logout() {
    clearToken();
  },

  // Patients
  async getPatients() {
    const res = await request("/patients");
    return res.patients || [];
  },

  async getPatient(patientId) {
    return await request(`/patients/${patientId}`);
  },

  async createPatient(patientData) {
    return await request("/patients", {
      method: "POST",
      body: patientData,
    });
  },

  async updatePatient(patientId, patientData) {
    return await request(`/patients/${patientId}`, {
      method: "PATCH",
      body: patientData,
    });
  },

  async deletePatient(patientId) {
    return await request(`/patients/${patientId}`, {
      method: "DELETE",
    });
  },

  async getPatientDocuments(patientId) {
    const res = await request(`/patients/${patientId}/documents`);
    return res.documents || [];
  },

  // Documents
  async getAllDocuments() {
    const res = await request("/documents");
    return res.documents || [];
  },

  async getDocument(documentId) {
    return await request(`/documents/${documentId}`);
  },

  async uploadDocument({ file, patientId, targetLanguage }) {
    const formData = new FormData();
    formData.append("file", file);
    if (patientId) {
      formData.append("patient_id", patientId);
    }
    if (targetLanguage) {
      formData.append("target_language", targetLanguage);
    }

    return await request("/documents", {
      method: "POST",
      body: formData,
    });
  },

  async deleteDocument(documentId) {
    return await request(`/documents/${documentId}`, {
      method: "DELETE",
    });
  },

  async downloadDocumentFile(documentId, filename = "document") {
    const url = `${API_BASE}/documents/${documentId}/file`;
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download file (${response.status})`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  },

  // Pipeline stages inspection
  async getStageFile(stageFilename) {
    return await request(`/pipeline-stages/${stageFilename}`);
  },

  // Admin endpoints
  admin: {
    async getStats() {
      return await request("/admin/stats");
    },

    async listUsers() {
      const res = await request("/admin/users");
      return res.users || [];
    },

    async updateUser(userId, data) {
      return await request(`/admin/users/${userId}`, {
        method: "PATCH",
        body: data,
      });
    },

    async deleteUser(userId) {
      return await request(`/admin/users/${userId}`, { method: "DELETE" });
    },

    async listPatients() {
      const res = await request("/admin/patients");
      return res.patients || [];
    },

    async deletePatient(patientId) {
      return await request(`/admin/patients/${patientId}`, { method: "DELETE" });
    },

    async listDocuments() {
      const res = await request("/admin/documents");
      return res.documents || [];
    },
  },
};

