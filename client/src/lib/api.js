// ---------------------------------------------------------------------------
// Thin API client – all requests go through the Vite dev proxy → Next.js
// ---------------------------------------------------------------------------

const TOKEN_KEY = "greencart_token";
const REQUEST_TIMEOUT_MS = 7000;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");

// --- token helpers (used by AppContext & LoginModal) ----------------------
export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Decode JWT payload without verifying the signature (client-side only). */
export const decodeToken = (token) => {
    try {
        return JSON.parse(atob(token.split(".")[1]));
    } catch {
        return null;
    }
};

/** Returns true when the token exists and has not expired. */
export const isTokenValid = (token) => {
    if (!token) return false;
    const payload = decodeToken(token);
    if (!payload) return false;
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
};

// --- request helpers -------------------------------------------------------
const buildHeaders = (extra = {}) => {
    const headers = { "Content-Type": "application/json", ...extra };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
};

const toApiUrl = (path) => {
    if (!API_BASE_URL) return path;
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

const requestJson = async (path, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = toApiUrl(path);

    try {
        const res = await fetch(url, {
            ...options,
            headers: buildHeaders(options.headers || {}),
            signal: controller.signal,
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) {
            return {
                success: false,
                message: data?.message || `Request failed with status ${res.status}`,
                status: res.status,
            };
        }

        return data;
    } catch (error) {
        if (error?.name === "AbortError") {
            return {
                success: false,
                message: "Request timed out. Please ensure backend is reachable.",
            };
        }

        return {
            success: false,
            message: "Unable to reach server. Check backend URL and deployment health.",
        };
    } finally {
        clearTimeout(timeoutId);
    }
};

export const apiGet = async (path) => {
    return requestJson(path, { method: "GET" });
};

export const apiPost = async (path, body) => {
    return requestJson(path, {
        method: "POST",
        body: JSON.stringify(body),
    });
};

export const apiPut = async (path, body) => {
    return requestJson(path, {
        method: "PUT",
        body: JSON.stringify(body),
    });
};

export const apiDelete = async (path) => {
    return requestJson(path, { method: "DELETE" });
};
