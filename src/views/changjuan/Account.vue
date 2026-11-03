<template>
  <div class="cj-page account-page">
    <div class="cj-page-head">
      <h1>{{ $t('nav.account') }}</h1>
    </div>
    <div v-if="loadError" class="cj-error-box">{{ loadError }}</div>
    <div v-else-if="!user" class="cj-empty">{{ $t('shell.account.loading') }}</div>
    <template v-else>
      <section class="cj-card block">
        <h2>{{ $t('shell.account.avatar') }}</h2>
        <p class="cj-muted lead">{{ $t('shell.account.avatarLead') }}</p>
        <div v-if="avatarError" class="cj-error-box">{{ avatarError }}</div>
        <div class="avatar-grid">
          <button type="button" :class="{ on: !user.avatar }" :disabled="!!savingAvatar" @click="pickAvatar(null)">
            <UserAvatar :name="user.username" size="lg" />
            <span>{{ $t('shell.avatars.default') }}</span>
          </button>
          <button
            v-for="item in AVATARS"
            :key="item.key"
            type="button"
            :class="{ on: user.avatar === item.key }"
            :disabled="!!savingAvatar"
            @click="pickAvatar(item.key)"
          >
            <UserAvatar :name="user.username" :avatar="item.key" size="lg" />
            <span>{{ $t('shell.avatars.' + item.key) }}</span>
          </button>
        </div>
      </section>

      <section class="cj-card block">
        <h2>{{ $t('shell.account.username') }}</h2>
        <p class="current">{{ $t('shell.account.currentUsername') }}<b>{{ user.username }}</b></p>
        <p class="cj-muted lead">{{ user.email }}</p>
        <div v-if="nameError" class="cj-error-box">{{ nameError }}</div>
        <form class="stack" @submit.prevent="changeName">
          <label>
            {{ $t('shell.account.newUsername') }}
            <el-input v-model="nameDraft" maxlength="32" :disabled="user.username_changed || savingName" autocomplete="username" />
          </label>
          <div class="actions">
            <button class="cj-btn pri" type="submit" :disabled="user.username_changed || savingName">
              {{ savingName ? $t('shell.account.saving') : $t('shell.account.changeUsername') }}
            </button>
            <span v-if="user.username_changed" class="cj-muted">{{ $t('shell.account.usernameChanged') }}</span>
          </div>
        </form>
      </section>

      <section class="cj-card block">
        <h2>{{ $t('shell.account.changePassword') }}</h2>
        <p class="cj-muted lead">{{ $t('shell.account.passwordLead') }}</p>
        <div v-if="passwordError" class="cj-error-box">{{ passwordError }}</div>
        <form class="stack" @submit.prevent="changePassword">
          <label>
            {{ $t('shell.account.currentPassword') }}
            <el-input v-model="passwordForm.current" type="password" show-password maxlength="200" autocomplete="current-password" />
          </label>
          <label>
            {{ $t('shell.account.newPassword') }}
            <el-input v-model="passwordForm.next" type="password" show-password maxlength="200" autocomplete="new-password" />
          </label>
          <label>
            {{ $t('shell.account.confirmPassword') }}
            <el-input v-model="passwordForm.confirm" type="password" show-password maxlength="200" autocomplete="new-password" />
          </label>
          <div class="actions">
            <button class="cj-btn pri" type="submit" :disabled="savingPassword">{{ savingPassword ? $t('shell.account.saving') : $t('shell.account.savePassword') }}</button>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AVATARS } from '../../../shared/avatars.js'
import { handleAuthExpired, saveSession } from '../../utils/authSession.js'
import UserAvatar from './components/UserAvatar.vue'

const { t } = useI18n()
const USERNAME_RE = /^[\p{L}\p{N}_-]{2,32}$/u
const SESSION_GONE = /未登录|登录令牌|登录用户不存在|账号已被禁用|登录已失效/

const router = useRouter()
const user = ref(null)
const loadError = ref('')
const avatarError = ref('')
const nameError = ref('')
const passwordError = ref('')
const nameDraft = ref('')
const savingAvatar = ref('')
const savingName = ref(false)
const savingPassword = ref(false)
const passwordForm = reactive({ current: '', next: '', confirm: '' })

const authApi = async (path, options = {}) => {
  const token = localStorage.getItem('token')
  const res = await fetch(`/api/auth${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401 && SESSION_GONE.test(String(json.message || ''))) {
    handleAuthExpired(token, router)
    throw Object.assign(new Error(json.message || t('shell.account.sessionExpired')), { status: 401 })
  }
  if (!res.ok) throw Object.assign(new Error(json.message || t('errors.failed')), { status: res.status })
  return json
}

const applyUser = (next, token) => {
  user.value = next
  saveSession(token, next)
}

const load = async () => {
  loadError.value = ''
  try {
    const json = await authApi('/me')
    applyUser(json.data.user)
    document.title = `${t('nav.account')} · ${t('brand')}`
  } catch (err) {
    if (err.status === 401) return
    loadError.value = err.message
  }
}

const pickAvatar = async (key) => {
  const next = key || null
  if ((user.value?.avatar || null) === next || savingAvatar.value) return
  savingAvatar.value = key || 'default'
  avatarError.value = ''
  try {
    const json = await authApi('/avatar', { method: 'PUT', body: { avatar: next } })
    applyUser(json.data.user)
  } catch (err) {
    if (err.status !== 401) avatarError.value = err.message
  } finally {
    savingAvatar.value = ''
  }
}

const changeName = async () => {
  nameError.value = ''
  const username = nameDraft.value.trim()
  if (!USERNAME_RE.test(username)) {
    nameError.value = t('shell.account.usernameRule')
    return
  }
  try {
    await ElMessageBox.confirm(t('shell.account.usernameOnce'), t('shell.account.changeUsernameTitle'), {
      confirmButtonText: t('shell.account.confirmChange'),
      cancelButtonText: t('shell.account.cancel'),
      type: 'warning',
      customClass: 'cj-dialog'
    })
  } catch {
    return
  }
  savingName.value = true
  try {
    const json = await authApi('/username', { method: 'POST', body: { username } })
    applyUser(json.data.user)
    nameDraft.value = ''
    ElMessage.success(t('shell.account.usernameUpdated'))
  } catch (err) {
    if (err.status !== 401) nameError.value = err.message
  } finally {
    savingName.value = false
  }
}

const changePassword = async () => {
  passwordError.value = ''
  const current = passwordForm.current
  const next = passwordForm.next
  const confirm = passwordForm.confirm
  if (!current || !next) {
    passwordError.value = t('shell.account.passwordRequired')
    return
  }
  if (next.length < 8 || next.length > 200) {
    passwordError.value = t('shell.account.passwordLength')
    return
  }
  if (next !== confirm) {
    passwordError.value = t('shell.account.passwordMismatch')
    return
  }
  if (next === current) {
    passwordError.value = t('shell.account.passwordSame')
    return
  }
  savingPassword.value = true
  try {
    const json = await authApi('/password', {
      method: 'POST',
      body: { current_password: current, new_password: next, confirm_password: confirm }
    })
    applyUser(json.data.user, json.data.token)
    passwordForm.current = ''
    passwordForm.next = ''
    passwordForm.confirm = ''
    ElMessage.success(t('shell.account.passwordUpdated'))
  } catch (err) {
    if (err.status !== 401) passwordError.value = err.message
  } finally {
    savingPassword.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.account-page { max-width: 760px; }
.block { padding: 16px 18px 18px; margin-bottom: 16px; }
.block h2 { margin: 0 0 6px; font-size: 16px; font-family: var(--cj-serif); }
.lead { margin: 0 0 12px; line-height: 1.7; }
.current { margin: 0 0 4px; }
.stack { display: flex; flex-direction: column; gap: 12px; max-width: 420px; }
.stack label { display: flex; flex-direction: column; gap: 6px; color: var(--cj-sub); font-size: 12px; }
.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.actions .cj-btn { white-space: normal; max-width: 100%; }
.avatar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; }
.avatar-grid button {
  border: 1px solid var(--cj-line);
  background: var(--cj-bg);
  border-radius: 10px;
  padding: 10px 4px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--cj-sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.avatar-grid button.on { border-color: var(--cj-accent); background: var(--cj-accent-soft); color: var(--cj-accent); font-weight: 600; }
.avatar-grid button:disabled { cursor: default; }
html.cj-mobile .avatar-grid button { min-height: 44px; }
.cj-error-box { margin-bottom: 12px; }
</style>
