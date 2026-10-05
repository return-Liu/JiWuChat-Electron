<template>
  <div
    :class="['login-container', { 'electron-mode': isElectronEnv }]"
    @keyup.enter="handleEnterSubmit"
  >
    <div v-if="isElectronEnv" class="electron-login">
      <div class="electron-brand">
        <img src="../public/jiwuchat-elctron.png" alt="" class="electron-logo" />
        <h1 class="electron-title">极物聊天</h1>
        <p class="electron-subtitle">聊你所想，聊天随心</p>
      </div>

      <div class="electron-field">
        <svg class="electron-field-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14Z"
            fill="currentColor"
          />
        </svg>
        <input
          v-model="loginForm.username"
          type="text"
          class="electron-input"
          placeholder="请输入你的用户名或邮箱"
          autocomplete="username"
        />
      </div>

      <div class="electron-field">
        <svg class="electron-field-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"
            fill="currentColor"
          />
        </svg>
        <input
          v-model="loginForm.password"
          :type="showPassword ? 'text' : 'password'"
          class="electron-input"
          placeholder="请输入你的密码"
          autocomplete="current-password"
        />
        <span
          class="electron-field-eye"
          :class="{ active: showPassword }"
          @click="showPassword = !showPassword"
        >
          <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
              fill="currentColor"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 3l18 18-1.4 1.4-3.2-3.2A10.6 10.6 0 0 1 12 20c-5 0-9-4.5-10-7 .6-1.5 2.2-3.6 4.6-5L2 4.4 3 3Zm6.3 9.3 3.4 3.4a4 4 0 0 1-3.4-3.4ZM12 6c5 0 9 4.5 10 7-.5 1.3-1.7 3-3.5 4.3l-2-2A4 4 0 0 0 10 8.6L8.2 7.3A10.7 10.7 0 0 1 12 6Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>

      <!-- 自动登录 / 记住密码 -->
      <div class="electron-options">
        <label class="electron-checkbox">
          <input v-model="rememberPassword" type="checkbox" />
          <span>记住密码</span>
        </label>
        <label class="electron-checkbox">
          <input v-model="autoLogin" type="checkbox" />
          <span>自动登录</span>
        </label>
      </div>

      <button class="electron-login-btn" :disabled="loading" @click="handleLogin">
        <span v-if="!loading">登录</span>
        <span v-else>登录中...</span>
      </button>

      <!-- 服务协议 -->
      <label class="electron-agreement">
        <input v-model="agreedToTerms" type="checkbox" />
        <span class="electron-agreement-text">
          已阅读并同意
          <a class="electron-agreement-link" @click.prevent="openAgreement('service')">服务协议</a>
          和
          <a class="electron-agreement-link" @click.prevent="openAgreement('privacy')"
            >极物聊天保护指引</a
          >
        </span>
      </label>

      <div class="electron-links">
        <span class="electron-link" @click="router.push('/register')">注册账号</span>
      </div>
    </div>

    <div v-else class="login-card">
      <div class="login-wrapper">
        <div v-if="isLoggedIn && userAvatar" class="login-header">
          <div class="user-avatar-container">
            <img :src="userAvatar" alt="用户头像" class="user-avatar" />
          </div>
        </div>

        <div v-else class="login-header">
          <h2>极物聊天</h2>
          <p>聊你所想，聊天随心</p>
        </div>

        <div class="login-form">
          <div class="form-item">
            <a-input
              v-model:value="loginForm.username"
              placeholder="请输入用户名或邮箱"
              size="large"
              class="input-item"
            />
          </div>

          <div class="form-item">
            <a-input-password
              v-model:value="loginForm.password"
              placeholder="请输入密码"
              size="large"
              class="input-item"
            />
          </div>

          <div class="form-item login-btn-item">
            <a-button
              type="primary"
              @click="handleLogin"
              class="login-submit-btn"
              :loading="loading"
              size="large"
              block
            >
              登录
            </a-button>
          </div>

          <div class="links-container">
            <span class="register-link">
              还没有账号？
              <a-button type="link" class="go-register-btn" @click="$router.push('/register')">
                立即注册
              </a-button>
            </span>
          </div>
        </div>

        <div class="social-login-container">
          <div class="social-login-title">第三方登录</div>
          <div class="social-login-buttons">
            <div class="social-login-item">
              <a-button type="text" @click="handleWechatLogin" class="social-login-btn">
                <span class="social-icon-wrapper">
                  <img
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAAgVBMVEUAAABXu0BYt0BQt0BXu0BWu0BXu0BXu0BXu0BWukBWukBXvEBXu0BXvEBXvEBYukBVukBXu0BWt0BXukBXuEBXu0D////1+/Pq9+fV7s/A5rer3aBsw1jg89uBzHBiwEy14auL0Xug2ZOW1YeBzG93yGSW1YjL6sO14azL6cN2yGP3XpzOAAAAFXRSTlMA3yAQ78+/r5+AUI9w74BgYEBAkHDBb56KAAACF0lEQVRIx52W6XKDIBRGwT3GZmsRUXFP0vb9H7AKGS8aiCXnR0TCmU/gOoh0uJck8jEZwUGYXND/cOPggyz4CE//0HZgKeDIsdSA3Qs1Bk2XejLF7ckGe1fnOT7ZBDsaDxNiZ4Jna4Jnb7rgbeKrK7QnFuzBOxIrYrsJAth9iIdl/9CwLE0pv/elqfoegWpfXdAUYINW9GRkRIBWakBemiOVGRbpE1lpijwaPDANCxvCc8qBbcVF47vq5EQ1YjCK3nyXiXE3QqrpSseeu+jptc96XgWmHSGDEGtCmDHygpK5nUuRdr2MvvfNdMvzXCN+KVNk6RO0qOpr37fXJzFCwdzmT9532THZovmqFHxlF3/WcdWQGUsBI2g3K/G3WG3o4oEVsVqOK4RHaTpfaKkXCVsWzPTL65pPN7X4kxnEX6qIXS4mJqfOH5tVKSJWzJsiXqlcklxe5AI0yuL4RDUpiKkGphRrRFRK+lLk88AQSg4KXVC9TvwSRQ4MU5m1xZ2xlmnEm1LkrqeKTVbU5rcaNtJDCAWqCOutq90CpjiKMTFQZuuah/9Oo+h6ZtPkYTSxI0YKReWLtxFBpJ5bzjOasWYsoBp6HQSRW5R5tz4C4HS0PltjO/H05sH6iQDXtz0d3/94ANPes/9Asjd9572PwE8X6Tm+DPViZMQ5mLUDxGnVCFtqwDH0VlYQS22bcxIGIhn7UXLWWn+10s6FZo+4YQAAAABJRU5ErkJggg=="
                    class="social-icon-img"
                  />
                </span>
              </a-button>
            </div>

            <div class="social-login-item">
              <a-button type="text" @click="handleWeiboLogin" class="social-login-btn">
                <span class="social-icon-wrapper">
                  <img
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAAh1BMVEUAAADXQDjTQDzaQzfcRTfbRDfcRDbcQzbbRDbbRDfcQzbaQzbbRDbbRDbaRDfcQzbbRDfaQjjaQjXcQzfYRDfbRDTbRDf////gW1D99PPtoZvyubT76Ob20M3pioLdT0Tvrajkc2n20c3rlo7mfnb0xcD43NrrlY7kcmniZ1343driZ1z0xMEgvW1iAAAAFnRSTlMAIBDf34Dv78+/n1BAj7CvcGBgkHBwDUc+aAAAAmpJREFUSMeVlueCqjAQRgOI0qy7m0YVsN297/98OwEdCUQ05w8WDt/MkIjEhJv8RIFHAS/c/CTkM9w4XFKN5ebwgeaDNWURObYa4s+oMWrG1MOruDV9w9o1eU5A37JwDN6CUksTPWsTPXvTRe89wXBCa2rB+ukd6By3K6ca8WcNVoyxLB26i0ex/mxgzRTiMlx990A6C09PZ6XKwXbpIyP6Fn4C8zKONHVYFrJ4tJWfoUMJ5k2PPBi0igHZrX8j4HVLITPXB7udeK1gHem9ziJjouTwQYmnhCCuxh5UhSJO9qKmWwxrTcZeyh5UpcyFyOH0Bi5SaYNNyG7qYeK95CttWUWlJn6PW5RsSgVtlyqxoEhEQs1rNEPrldf5cI8Qb+hxYRKlaVsSY4NZKqU81aynpQY0kTNF3pS4fsDFvTESx4Gi0b4vMqWKdl4UcHWukmSeZXnRV9Gb5VgcDucIJ3B11JbckSmKyXAC7V7I52hxI2WmyYYk0m7+Dbd8JR7boTYlbshOE9WBsYb+MglBZ6r4p8TxXL+Hi7zov2dCnY1N8v7ViIS4z21V9q3U7Ap9YkzOulnrLAkZLtYTA4f+CpYLHEjFgCMdtwhiTBGedT+D/NwtIHU2V3li4tE9iO5qaILQwvF4LNUtTLsr8InnTX6Pebfq8qopmup/V29W0CkRIaNISDmxJwLqNeEYHwG8repzltVpA/Ua8UmP61ErPHy2xnbiniBflg9WxA0sCnXJAMezadDSRM/aRM/eDMCb4n7Z/glE9rOhq5i8xPFfaz7GmdXIs9aw4O1qZIUxam9IdtuwS/aCaJcYrT+uh9kYccQkXQAAAABJRU5ErkJggg=="
                    class="social-icon-img"
                  />
                </span>
              </a-button>
            </div>

            <div class="social-login-item">
              <a-button type="text" @click="handleQQLogin" class="social-login-btn">
                <span class="social-icon-wrapper">
                  <img
                    class="social-icon-img"
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAMAAACfWMssAAAAb1BMVEUAAABMouVIn+NEn99MouVMouVMo+ZMouVKouRKouJMn+NMouZLouRLo+VMoeNMouZLoeVLoeVNn+RMouX///+83Pal0PL0+v6x1vRireiay/FXqOfS6Pl5uevH4vePxe+Ev+1utOrp9Pzp8/yEv+7XzqLPAAAAE3RSTlMA3yAQ74C/n2BQQK9wz5CPz7BwJ8NfpgAAAbNJREFUSMe1lutygjAQhTeEOyi2AQIC3t//GcvYqk3OYsh0+v1yMN+czc4mQBwyL5ONUDMiLsqc1iGzOFQGYZGu0KLZQkQSrNSQ6I2aGRqkpktxlXJQSc4LNsqJCBhPOCQwwXOa6PmbErxlNpJeVMqD6uWliqOfprPiyN5tcOp0PaObntnmo9hIAV39pFNA9BOogKb+RQN/h9+RCfzR1gbtQqSArtQmemAjUy4QI7GxBTy92qKGJfEshlgp0DO15srmhuIRFuX0Cc/2KO5hUUkF1xt3dxKKuUS3uCPBjA0w4rySwqYyDLCM+EqxVrd45UTtFm81ywlEuzkHXhyhOfY1DArfntg+jRMY/PB80CeODaLhHigpt7fYNSgeuvpgD7k0j9V4Gfbc6RjN7oRE1rCeejVo27vMD4/WFokynB33qUpnUYb+t5zg7+OhNYrVxx5PIzGRJ9ijniwxIC7y3DV3urZ9/DrDfQxvR793a+YnpvRk6+Nt6YXceRQq//rxgKb/h87/fVrtAmKQW2c/JfGkb0PDjBYJomUtMuJQTcRKDUmL0LLiDDWevCzie7LYJGXOWl/BnLhvbq/sWgAAAABJRU5ErkJggg=="
                  />
                </span>
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <GeetestVerification
      riskType="puzzle"
      ref="geetestCaptchaRef"
      @verified="handleLoginAfterVerification"
      @error="handleCaptchaError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import request from "../untils/request";
import { useUserStore } from "../stores/user";
import { websocketService } from "../untils/websocket";
import { isElectron, resizeWindow } from "../untils/electronHelper";
import GeetestVerification from "../components/GeetestVerification.vue";

const router = useRouter();
const isElectronEnv = ref(false);
const geetestCaptchaRef = ref<InstanceType<typeof GeetestVerification> | null>(null);

const isLoggedIn = ref(false);
const userAvatar = ref<string>("");

const loadCachedAvatar = () => {
  try {
    const cached = localStorage.getItem("user-avatar");
    if (cached) {
      userAvatar.value = cached;
    }
  } catch (e) {
    // localStorage 不可用时忽略
  }
};

interface LoginForm {
  username: string;
  password: string;
}
const loginForm = reactive<LoginForm>({
  username: "",
  password: "",
});

const loading = ref(false);
// 密码可见性切换
const showPassword = ref(false);

// 记住密码 / 自动登录
const rememberPassword = ref(false);
const autoLogin = ref(false);
// 服务协议勾选
const agreedToTerms = ref(false);

const handleEnterSubmit = () => {
  handleLogin();
};

const getBaseURL = () => {
  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem("api-url") || "http://localhost:8080";
    } catch (e) {}
  }
  return "http://localhost:8080";
};

const handleQQLogin = async () => {
  try {
    const baseURL = getBaseURL();
    const qqAuthUrl = `${baseURL}/auth/qq`;
    window.location.href = qqAuthUrl;
  } catch (error) {
    message.error("QQ登录跳转失败");
  }
};

const handleWechatLogin = async () => {
  message.info("微信登录暂未开放");
};

const handleWeiboLogin = async () => {
  message.info("微博登录暂未开放");
};

const validateForm = (): boolean => {
  if (!loginForm.username && !loginForm.password) {
    message.error("请输入用户名或者邮箱和密码");
    return false;
  }
  if (!loginForm.username.trim()) {
    message.error("请输入用户名或者邮箱");
    return false;
  }
  if (!loginForm.password) {
    message.error("请输入密码");
    return false;
  }
  if (loginForm.password.length < 6) {
    message.error("密码至少6位");
    return false;
  }
  return true;
};

const handleLogin = async () => {
  if (!validateForm()) return;
  if (loading.value) return;

  // 服务协议校验（仅桌面端需要）
  if (isElectronEnv.value && !agreedToTerms.value) {
    message.warning("请先阅读并同意服务协议和极物聊天保护指引");
    return;
  }

  loading.value = true;

  // 统一走极验验证码（桌面端 + Web 端）
  try {
    const configRes = await request.get("/auth/geetest-config");
    const captchaId = configRes.data.captchaId || configRes.data.encryptedCaptchaId;

    if (geetestCaptchaRef.value) {
      const success = await geetestCaptchaRef.value.showCaptcha(captchaId);
      if (!success) {
        message.error("验证码加载失败，请刷新页面重试");
        loading.value = false;
        return;
      }
    } else {
      // 极验组件未就绪，直接登录（兜底）
      await doLogin();
    }
  } catch (error: any) {
    message.error("验证码加载失败");
    loading.value = false;
    return;
  }
};

/**
 * 实际执行登录请求
 * @param geetestData 极验验证码结果（桌面端为 undefined，直接账号密码登录）
 */
const doLogin = async (geetestData?: any) => {
  try {
    const payload: Record<string, any> = {
      username: loginForm.username,
      password: loginForm.password,
    };
    if (geetestData) {
      payload.geetestData = geetestData;
    }

    const response = await request.post("/auth/login", payload);

    const userStore = useUserStore();
    // skipFetch=true：跳过拉取用户信息，立即跳转，由 message 页面自行初始化用户数据
    await userStore.login(response.data.token, true);

    // 记住密码 / 自动登录：保存到 localStorage
    try {
      if (rememberPassword.value) {
        localStorage.setItem(
          "login-remember",
          JSON.stringify({
            username: loginForm.username,
            password: loginForm.password,
            autoLogin: autoLogin.value,
          }),
        );
      } else {
        localStorage.removeItem("login-remember");
      }
    } catch (e) {
      console.warn("保存登录信息失败:", e);
    }

    if (response.data.user?.avatar) {
      try {
        localStorage.setItem("user-avatar", response.data.user.avatar);
      } catch (e) {
        console.warn("无法缓存用户头像到 localStorage:", e);
      }
    }
    websocketService.connect().catch((wsError) => {
      console.error("WebSocket 连接失败:", wsError);
    });
    router.push("/message");
  } catch (error: any) {
    if (error.response?.data?.data?.message) {
      message.error(error.response.data.data.message);
    } else {
      message.error("登录失败，请重试");
    }
  } finally {
    loading.value = false;
  }
};

const handleLoginAfterVerification = async (captchaResult: any) => {
  await doLogin(captchaResult);
};

// ===== 服务协议 =====
const openAgreement = (type: "service" | "privacy") => {
  // 打开协议页面（暂用提示，后续可跳转到协议详情页）
  message.info(type === "service" ? "服务协议" : "极物聊天保护指引");
};

const handleCaptchaError = (error: any) => {
  console.error("验证码错误:", error);
  loading.value = false;
};

onMounted(async () => {
  isElectronEnv.value = isElectron();

  // 桌面端：恢复登录窗口尺寸（退出登录后从 message 全屏恢复为紧凑登录框）
  if (isElectronEnv.value) {
    resizeWindow("login");
  }

  loadCachedAvatar();
  if (userAvatar.value) {
    isLoggedIn.value = true;
  }

  // 加载记住密码 / 自动登录信息
  try {
    const saved = localStorage.getItem("login-remember");
    if (saved) {
      const info = JSON.parse(saved);
      if (info.username) {
        loginForm.username = info.username;
        loginForm.password = info.password || "";
        rememberPassword.value = true;
        autoLogin.value = !!info.autoLogin;
      }
    }
  } catch (e) {
    console.warn("加载记住密码信息失败:", e);
  }

  const userStore = useUserStore();
  await userStore.initializeAuth();
  if (userStore.token) {
    setTimeout(() => {
      router.replace("/message");
    }, 800);
  }
});
</script>

<style scoped lang="scss">
/* ===== 桌面端：极物聊天品牌登录 · 简洁无渐变 ===== */
.electron-login {
  --brand-900: #4c1d95; // 最深紫（标题）
  --brand-700: #6d28d9; // 深紫（主色）
  --brand-500: #8b5cf6; // 品牌紫
  --brand-400: #a78bfa; // 浅紫
  --brand-100: #ede9fe; // 极浅紫（背景）
  --brand-50: #f5f3ff; // 最浅紫

  // 文字统一使用黑色系
  --ink-900: #000000; // 标题黑
  --ink-700: #1a1a1a; // 正文黑
  --ink-500: #333333; // 次要黑
  --ink-300: #999999; // 占位符灰

  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  background: #ffffff; /* 纯白背景，无渐变 */
}

.electron-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28px;

  .electron-logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 16px;
    margin-bottom: 14px;
    background: #f5f5f5; /* 扁平占位 */
    box-shadow: 0 4px 14px rgba(139, 92, 246, 0.18);
  }

  .electron-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink-900);
    margin: 0 0 6px 0;
    letter-spacing: 1px;
  }

  .electron-subtitle {
    font-size: 12px;
    color: var(--ink-500);
    margin: 0;
    letter-spacing: 2px;
    font-weight: 400;
  }
}

/* 扁平输入框，无渐变，无阴影 */
.electron-field {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  background: #fafafa;
  margin-bottom: 14px;
  padding: 0 14px;
  box-sizing: border-box;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: #c4b5fd;
    background: #ffffff;
  }

  &:focus-within {
    border-color: var(--brand-500);
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.14); /* 极简光晕 */
  }

  .electron-field-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #b8b8b8;
    transition: color 0.2s ease;
  }

  &:focus-within .electron-field-icon {
    color: var(--brand-500);
  }

  .electron-input {
    flex: 1;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: var(--ink-700);
    text-align: left;
    min-width: 0;

    &::placeholder {
      color: var(--ink-300);
      text-align: left;
      font-weight: 400;
    }
  }

  .electron-field-eye {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b8b8b8;
    cursor: pointer;
    transition: color 0.2s ease;

    svg {
      width: 18px;
      height: 18px;
    }

    &:hover,
    &.active {
      color: var(--brand-500);
    }
  }
}

/* 纯色按钮，无渐变，无阴影 */
.electron-login-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 10px;
  background: var(--brand-500); /* 纯色，无渐变 */
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  letter-spacing: 2px;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.28);
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.1s ease,
    opacity 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--brand-700); /* 纯色加深，无渐变 */
    box-shadow: 0 6px 16px rgba(109, 40, 217, 0.34);
  }

  &:active:not(:disabled) {
    background: var(--brand-900);
    transform: translateY(1px);
    box-shadow: 0 2px 8px rgba(76, 29, 149, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--brand-400);
    box-shadow: none;
  }
}

.electron-options {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  .electron-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-500);
    cursor: pointer;
    user-select: none;

    input[type="checkbox"] {
      width: 14px;
      height: 14px;
      cursor: pointer;
      accent-color: var(--brand-500);
    }
  }
}

.electron-agreement {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--ink-500);
  cursor: pointer;
  user-select: none;

  input[type="checkbox"] {
    width: 14px;
    height: 14px;
    margin-top: 1px;
    cursor: pointer;
    accent-color: var(--brand-500);
    flex-shrink: 0;
  }

  .electron-agreement-text {
    line-height: 1.5;
  }

  .electron-agreement-link {
    color: #000000;
    cursor: pointer;
    text-decoration: none;

    &:hover {
      color: #000000;
      text-decoration: underline;
    }
  }
}

.electron-links {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;

  .electron-link {
    font-size: 13px;
    color: #000000;
    cursor: pointer;
    transition: color 0.2s ease;
    text-decoration: none;

    &:hover {
      color: #000000;
      text-decoration: underline;
    }
  }
}

.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 20px;
  background: #f7f9fc;
  flex-direction: column;
  overflow: hidden;

  &.electron-mode {
    padding: 0;
    background: transparent;
    align-items: flex-start;
    justify-content: flex-start;
    min-height: auto;
  }
}

.login-card {
  width: 500px;
  padding: 48px 44px 40px;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #eee;
  box-sizing: border-box;
  position: relative;
  z-index: 10;
  margin-top: 40px;

  &.electron-card {
    width: 100%;
    max-width: 100%;
    padding: 8px 30px 5px 30px;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
    margin-top: 0;
  }
}

.login-wrapper {
  width: 100%;
}

.login-header {
  text-align: center;
  margin-bottom: 28px;

  h2 {
    font-size: 24px;
    font-weight: 700;
    color: #1677ff;
    margin: 0 0 6px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;

    .header-logo {
      width: 28px;
      height: 28px;
      object-fit: contain;
      border-radius: 6px;
    }
  }

  p {
    font-size: 14px;
    color: #8c8c8c;
    margin: 0;
    letter-spacing: 0.5px;
  }
}

.login-form {
  .form-item {
    margin-bottom: 16px;
  }

  :deep(.ant-input) {
    height: 42px;
    border-radius: 12px;
    border: 1px solid #e5e6eb;
    background: #fff;
    font-size: 14px;
    text-align: center;
    transition: all 0.3s ease;

    &:hover {
      border-color: #4f9eff;
    }

    &:focus {
      border-color: #1677ff;
      box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.08);
    }

    &::placeholder {
      text-align: center;
    }
  }

  :deep(.ant-input-affix-wrapper) {
    height: 42px;
    border-radius: 12px;
    border: 1px solid #e5e6eb;
    background: #fff;
    transition: all 0.3s ease;
    padding: 0 11px;

    &:hover {
      border-color: #4f9eff;
    }

    &:focus-within {
      border-color: #1677ff;
      box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.08);
    }

    .ant-input {
      height: auto;
      border: none;
      box-shadow: none;
      text-align: center;

      &:focus {
        box-shadow: none;
      }
    }

    .ant-input-password-icon {
      color: #bfbfbf;
      font-size: 16px;

      &:hover {
        color: #1677ff;
      }
    }
  }

  :deep(.ant-input-prefix),
  :deep(.ant-input-suffix) {
    display: none;
  }

  :deep(.ant-input-affix-wrapper .ant-input-suffix) {
    display: flex;
  }
}

.login-submit-btn {
  width: 100%;
  height: 42px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.25);
  transition: all 0.3s ease;

  &.electron-btn {
    background: #1677ff;
    box-shadow: none;
  }
}

.links-container {
  display: flex;
  justify-content: center;
  margin-top: 10px;
  font-size: 14px;
  color: #8c8c8c;
}

.go-register-btn {
  padding: 0 4px;
  height: auto;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.3s ease;

  &:hover {
    color: #0a58ca !important;
  }
}

.social-login-container {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f2f5;
  text-align: center;
}

.social-login-title {
  font-size: 13px;
  color: #b0b0b0;
  margin-bottom: 16px;
  letter-spacing: 1px;
}

.social-login-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 25px;
}

.social-login-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.social-login-btn {
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  background: transparent !important;
  height: auto !important;
  display: flex !important;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #333 !important;
  font-size: 14px;
  transition: transform 0.2s ease;
}

.social-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.social-icon-img {
  width: 25px;
  height: 25px;
  display: block;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
}

.social-text {
  font-size: 13px;
  color: #9499a0;
  line-height: 1;
  white-space: nowrap;
}

.user-avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #e5e6eb;
}
</style>
