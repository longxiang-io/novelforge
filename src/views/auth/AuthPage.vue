<template>
  <div class="cj-app auth-page">
    <form class="card" @submit.prevent="submit">
      <h1><BrandMark /></h1>
      <p class="lead">{{ mode === 'register' ? $t('public.auth.leadRegister') : $t('public.auth.leadLogin') }}</p>
      <label v-if="mode === 'register'">
        {{ $t('public.auth.email') }}
        <input v-model.trim="email" type="email" autocomplete="email" maxlength="120" required />
      </label>
      <label v-if="mode === 'register'">
        {{ $t('public.auth.username') }}
        <input v-model.trim="username" autocomplete="username" maxlength="32" required />
      </label>
      <label v-else>
        {{ $t('public.auth.account') }}
        <input v-model.trim="account" autocomplete="username" required />
      </label>
      <label>
        {{ $t('public.auth.password') }}
        <input v-model="password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" minlength="8" maxlength="200" required />
      </label>
      <p v-if="mode === 'register'" class="hint">{{ $t('public.auth.hint') }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="cj-btn pri" type="submit" :disabled="pending">{{ pending ? $t('public.auth.pending') : (mode === 'register' ? $t('public.auth.submitRegister') : $t('public.auth.submitLogin')) }}</button>
      <p class="switch">
        <router-link v-if="mode === 'login'" to="/register">{{ $t('public.auth.goRegister') }}</router-link>
        <router-link v-else to="/login">{{ $t('public.auth.goLogin') }}</router-link>
      </p>
      <p class="home"><router-link to="/">{{ $t('public.auth.home') }}</router-link> · <router-link to="/guide">{{ $t('public.auth.guide') }}</router-link> · <LocaleSwitch /></p>
      <p v-if="closed" class="hint">{{ $t('public.auth.closed') }}</p>
    </form>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { resetAuthExpiredState, saveSession } from '../../utils/authSession.js'
import '../changjuan/changjuan.css'
import BrandMark from '../../components/BrandMark.vue'
import LocaleSwitch from '../../components/LocaleSwitch.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const mode = computed(() => route.meta.mode === 'register' ? 'register' : 'login')
const email = ref('')
const username = ref('')
const account = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
const closed = ref(false)

const loadConfig = async () => {
  try {
    const res = await fetch('/api/auth/config')
    const json = await res.json()
    closed.value = json?.data?.allow_register === false
  } catch {
    closed.value = false
  }
}
watch(mode, loadConfig, { immediate: true })

const submit = async () => {
  error.value = ''
  pending.value = true
  try {
    const path = mode.value === 'register' ? '/api/auth/register' : '/api/auth/login'
    const body = mode.value === 'register'
      ? { email: email.value, username: username.value, password: password.value }
      : { account: account.value, password: password.value }
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      error.value = json.message || t('public.auth.failed')
      return
    }
    saveSession(json.data.token, json.data.user)
    resetAuthExpiredState()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/changjuan'
    router.replace(redirect.startsWith('/') ? redirect : '/changjuan')
  } catch {
    error.value = t('public.auth.network')
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.auth-page { align-items: center; justify-content: center; }
.card {
  width: min(420px, calc(100% - 32px));
  background: var(--cj-paper);
  border: 1px solid var(--cj-line);
  border-radius: 12px;
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h1 { font-family: var(--cj-serif); font-size: 28px; letter-spacing: 2px; color: var(--cj-accent); margin: 0; }
h1 img { height: 40px; display: block; }
.lead, .hint, .switch { color: var(--cj-sub); font-size: 13px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--cj-sub); }
input {
  border: 1px solid var(--cj-line);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  color: var(--cj-ink);
  background: #fff;
}
button { margin-top: 4px; }
.error { color: var(--cj-red); font-size: 13px; }
.switch a { color: var(--cj-accent); }
.home { text-align: center; margin: 0; }
.home a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 8px;
  color: var(--cj-sub);
}
</style>
