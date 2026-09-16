// 戰情指揮中心身分驗證與權限管理模組 (Tactical Security & Auth Module)

const AUTH_CONFIG = {
  // 指揮官授權白名單 (Google 帳號直通)
  COMMANDER_EMAILS: [
    'yingnan.liao@gmail.com',
    'yingnanliao@gmail.com'
  ],
  // Google OAuth 2.0 Client ID (支援 Google Identity Services)
  GOOGLE_CLIENT_ID: '1064834171097-al7n0t10o4ohokurck0fpf7j4iucnj0h.apps.googleusercontent.com',
  // 戰情通行憑證 (加鹽 SHA-256 雜湊，安全無明文)
  PASSWORD_SALT: 'intj_radar_salt_2026',
  PASSWORD_HASH: '73725d9011b474d427dfa83624892c42c91026dc2f9173be0e54caa2820c80a2', // 預設: intj2026
  SESSION_STORAGE_KEY: 'briefing_command_center_session',
  // Session 有效期 (預設 30 天)
  SESSION_DURATION_MS: 30 * 24 * 60 * 60 * 1000
};

class TacticalAuth {
  constructor() {
    this.currentUser = null;
  }

  // 初始化並檢查本地 Session
  init() {
    return this.checkSession();
  }

  // 檢查目前是否已通過鑑權
  checkSession() {
    try {
      const raw = localStorage.getItem(AUTH_CONFIG.SESSION_STORAGE_KEY) || 
                  sessionStorage.getItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
      if (!raw) return null;
      
      const session = JSON.parse(raw);
      if (session && session.expiresAt && Date.now() < session.expiresAt) {
        this.currentUser = session;
        return session;
      }
      // 已過期
      this.logout();
      return null;
    } catch (e) {
      console.warn('Session 解析異常:', e);
      this.logout();
      return null;
    }
  }

  // 帳號密碼登入驗證
  async loginWithPassword(username, password, rememberMe = true) {
    if (!password || !password.trim()) {
      return { success: false, message: '請輸入戰情通行密碼' };
    }

    const inputHash = await this.hashPassword(password.trim());
    if (inputHash === AUTH_CONFIG.PASSWORD_HASH) {
      const user = {
        name: username && username.trim() ? username.trim() : '指揮官 (Commander)',
        email: username && username.includes('@') ? username.trim() : 'commander@tactical.internal',
        role: 'COMMANDER',
        method: 'passcode',
        loginAt: new Date().toISOString(),
        expiresAt: Date.now() + AUTH_CONFIG.SESSION_DURATION_MS
      };
      this.saveSession(user, rememberMe);
      return { success: true, user };
    } else {
      return { success: false, message: '通行密碼驗證失敗，存取遭到拒絕 (403)' };
    }
  }

  // Google Identity Services (GIS) 回傳憑證處理
  handleGoogleCredential(credential) {
    try {
      const payload = this.decodeJwt(credential);
      if (!payload || !payload.email) {
        return { success: false, message: '無法解析 Google 身分憑證' };
      }

      const email = payload.email.toLowerCase().trim();
      const isCommander = AUTH_CONFIG.COMMANDER_EMAILS.some(e => e.toLowerCase() === email);

      if (isCommander) {
        const user = {
          name: payload.name || '廖英男 (指揮官)',
          email: payload.email,
          avatar: payload.picture || '',
          role: 'SUPREME_COMMANDER',
          method: 'google',
          loginAt: new Date().toISOString(),
          expiresAt: Date.now() + AUTH_CONFIG.SESSION_DURATION_MS
        };
        this.saveSession(user, true);
        return { success: true, user };
      } else {
        return { 
          success: false, 
          message: `未授權之 Google 帳號 (${payload.email})。僅限指揮官本尊存取。` 
        };
      }
    } catch (e) {
      console.error('Google 驗證處理異常:', e);
      return { success: false, message: 'Google 授權驗證發生異常: ' + e.message };
    }
  }

  // 儲存 Session
  saveSession(user, persistent = true) {
    this.currentUser = user;
    const data = JSON.stringify(user);
    if (persistent) {
      localStorage.setItem(AUTH_CONFIG.SESSION_STORAGE_KEY, data);
    } else {
      sessionStorage.setItem(AUTH_CONFIG.SESSION_STORAGE_KEY, data);
    }
  }

  // 安全登出
  logout() {
    this.currentUser = null;
    localStorage.removeItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_CONFIG.SESSION_STORAGE_KEY);
  }

  // 原生 Web Crypto SHA-256 加鹽雜湊
  async hashPassword(password) {
    const text = AUTH_CONFIG.PASSWORD_SALT + password;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // JWT Base64 解碼
  decodeJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }
}

window.tacticalAuth = new TacticalAuth();
