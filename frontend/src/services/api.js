import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''
export const resolveMediaUrl = (url) => {
  if (!url || url.startsWith('data:') || /^https?:\/\//i.test(url)) return url
  const base = API_URL || window.location.origin
  return `${base.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
}

let pendingRequests = 0
const notifyLoading = value => window.dispatchEvent(new CustomEvent('caregivers:loading', { detail: value }))
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  pendingRequests += 1
  notifyLoading(true)
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Let the browser add the multipart boundary. Setting this header manually
  // makes some browsers send FormData without a boundary, so multer rejects it.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
    delete config.headers['content-type']
  }
  return config
})

api.interceptors.response.use(response => {
  pendingRequests = Math.max(0, pendingRequests - 1)
  if (!pendingRequests) notifyLoading(false)
  return response
}, error => {
  pendingRequests = Math.max(0, pendingRequests - 1)
  if (!pendingRequests) notifyLoading(false)
  return Promise.reject(error)
})

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
  saveFcmToken: (token) => api.put('/api/auth/fcm-token', { token }),
  changePassword: (data) => api.put('/api/auth/password', data),
  logout: () => api.post('/api/auth/logout'),
  deleteAccount: () => api.delete('/api/auth/me'),
  requestPasswordReset: (username) => api.post('/api/auth/forgot-password', { username }),
  resetPasswordStatus: (username) => api.get('/api/auth/reset-password-status', { params: { username } }),
  approvalStatus: (username) => api.get('/api/auth/approval-status', { params: { username } })
}

export const callAPI = {
  config: () => api.get('/api/call-config', { timeout: 4000 })
}

export const mediaAPI = {
  musicSearch: q => api.get('/api/media/music-search', { params: { q } }),
  download: data => api.post('/api/media/download', data)
}

export const userAPI = {
  search: (q) => api.get('/api/users/search', { params: { q } }),
  profile: (id) => api.get(`/api/users/${id}`),
  friends: () => api.get('/api/users/friends'),
  friendRequests: () => api.get('/api/users/friend-requests'),
  notifications: () => api.get('/api/users/notifications'),
  markNotificationsRead: () => api.post('/api/users/notifications/read'),
  deleteNotification: (id) => api.delete(`/api/users/notifications/${id}`),
  profileFriends: (id) => api.get(`/api/users/${id}/friends`),
  sendRequest: (toUserId) => api.post('/api/users/friend-request', { toUserId }),
  acceptRequest: (id) => api.post(`/api/users/friend-request/${id}/accept`),
  rejectRequest: (id) => api.post(`/api/users/friend-request/${id}/reject`),
  updateProfile: (data) => api.put('/api/users/profile', data)
}

export const postsAPI = {
  list: () => api.get('/api/posts'),
  saved: () => api.get('/api/posts/saved'),
  create: (formData) => api.post('/api/posts', formData),
  edit: (id, data) => api.put(`/api/posts/${id}`, data),
  remove: (id) => api.delete(`/api/posts/${id}`),
  like: (id) => api.post(`/api/posts/${id}/like`),
  save: (id) => api.post(`/api/posts/${id}/save`),
  share: (id) => api.post(`/api/posts/${id}/share`),
  comment: (id, data) => api.post(`/api/posts/${id}/comments`, data),
  editComment: (id, data) => api.put(`/api/posts/comments/${id}`, data),
  removeComment: (id) => api.delete(`/api/posts/comments/${id}`),
  likeComment: (id) => api.post(`/api/posts/comments/${id}/like`)
}

export const reportsAPI = {
  create: (data) => api.post('/api/reports', data)
}

export const aiAPI = {
  list: () => api.get('/api/ai/conversations'),
  translate: text => api.post('/api/ai/translate', { text }),
  create: (title) => api.post('/api/ai/conversations', { title }),
  get: (id) => api.get(`/api/ai/conversations/${id}`),
  remove: (id) => api.delete(`/api/ai/conversations/${id}`),
  send: (id, content) => api.post(`/api/ai/conversations/${id}/messages`, { content })
}

export const chatAPI = {
  getConversations: () => api.get('/api/chat/conversations'),
  getOrCreateConversation: (otherUserId) => api.post('/api/chat/conversation', { otherUserId }),
  getMessages: (conversationId) => api.get(`/api/chat/messages/${conversationId}`),
  markRead: (conversationId) => api.post(`/api/chat/read/${conversationId}`),
  callHistory: () => api.get('/api/chat/call-history'),
  getGroupMessages: (groupId) => api.get(`/api/chat/group-messages/${groupId}`),
  deleteConversation: (id) => api.delete(`/api/chat/conversation/${id}`),
  blockUser: (id) => api.post(`/api/chat/block/${id}`),
  unblockUser: (id) => api.delete(`/api/chat/block/${id}`),
  upload: (formData) => api.post('/api/chat/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const groupAPI = {
  create: (data) => api.post('/api/groups', data),
  myGroups: () => api.get('/api/groups/my'),
  get: (id) => api.get(`/api/groups/${id}`),
  addMembers: (id, userIds) => api.post(`/api/groups/${id}/members`, { userIds }),
  join: (inviteCode) => api.post(`/api/groups/join/${inviteCode}`),
  leave: (id) => api.post(`/api/groups/${id}/leave`),
  removeMember: (id, userId) => api.delete(`/api/groups/${id}/members/${userId}`),
  remove: (id) => api.delete(`/api/groups/${id}`),
  update: (id, data) => api.put(`/api/groups/${id}`, data),
  regenerateInvite: (id) => api.post(`/api/groups/${id}/regenerate-invite`),
  markRead: (id) => api.post(`/api/groups/${id}/read`)
}

export const walletAPI = {
  get: () => api.get('/api/wallet'),
  deposit: (formData) => api.post('/api/wallet/deposit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  withdraw: (formData) => api.post('/api/wallet/withdraw', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  paymentInfo: () => api.get('/api/wallet/payment-info')
}

export const adminAPI = {
  login: (password) => api.post('/api/admin/login', { password }),
  users: (password) => api.get('/api/admin/users', { headers: { 'x-admin-password': password } }),
  approveUser: (id, password) => api.post(`/api/admin/users/${id}/approve`, {}, { headers: { 'x-admin-password': password } }),
  rejectUser: (id, password) => api.post(`/api/admin/users/${id}/reject`, {}, { headers: { 'x-admin-password': password } }),
  deleteUser: (id, password) => api.delete(`/api/admin/users/${id}`, { headers: { 'x-admin-password': password } }),
  resetPassword: (id, password) => api.post(`/api/admin/users/${id}/reset-password`, {}, { headers: { 'x-admin-password': password } }),
  ban: (id, password) => api.post(`/api/admin/users/${id}/ban`, {}, { headers: { 'x-admin-password': password } }),
  unban: (id, password) => api.post(`/api/admin/users/${id}/unban`, {}, { headers: { 'x-admin-password': password } }),
  mute: (id, password) => api.post(`/api/admin/users/${id}/mute`, {}, { headers: { 'x-admin-password': password } }),
  unmute: (id, password) => api.post(`/api/admin/users/${id}/unmute`, {}, { headers: { 'x-admin-password': password } }),
  coins: (id, data, password) => api.post(`/api/admin/users/${id}/coins`, data, { headers: { 'x-admin-password': password } }),
  deposits: (password) => api.get('/api/admin/deposits', { headers: { 'x-admin-password': password } }),
  approveDeposit: (id, password, adminNote) => api.post(`/api/admin/deposits/${id}/approve`, { adminNote }, { headers: { 'x-admin-password': password } }),
  rejectDeposit: (id, password, adminNote) => api.post(`/api/admin/deposits/${id}/reject`, { adminNote }, { headers: { 'x-admin-password': password } }),
  withdraws: (password) => api.get('/api/admin/withdraws', { headers: { 'x-admin-password': password } }),
  approveWithdraw: (id, password, adminNote) => api.post(`/api/admin/withdraws/${id}/approve`, { adminNote }, { headers: { 'x-admin-password': password } }),
  rejectWithdraw: (id, password, adminNote) => api.post(`/api/admin/withdraws/${id}/reject`, { adminNote }, { headers: { 'x-admin-password': password } }),
  paymentAccounts: (password) => api.get('/api/admin/payment-accounts', { headers: { 'x-admin-password': password } }),
  addPaymentAccount: (formData, password) => api.post('/api/admin/payment-accounts', formData, {
    headers: { 'x-admin-password': password, 'Content-Type': 'multipart/form-data' }
  }),
  deletePaymentAccount: (id, password) => api.delete(`/api/admin/payment-accounts/${id}`, { headers: { 'x-admin-password': password } }),
  broadcast: (data, password) => api.post('/api/admin/broadcast', data, { headers: { 'x-admin-password': password } }),
  reports: (password) => api.get('/api/admin/reports', { headers: { 'x-admin-password': password } }),
  updateReport: (id, data, password) => api.patch(`/api/admin/reports/${id}`, data, { headers: { 'x-admin-password': password } }),
  getPaymentInfo: (password) => api.get('/api/admin/payment-info', { headers: { 'x-admin-password': password } }),
  setPaymentInfo: (formData, password) => api.post('/api/admin/payment-info', formData, {
    headers: { 'x-admin-password': password, 'Content-Type': 'multipart/form-data' }
  }),
  deviceToken: (token, password, platform = 'android') => api.post('/api/admin/device-token', { token, platform }, { headers: { 'x-admin-password': password } }),
  pushStatus: (password) => api.get('/api/admin/push-status', { headers: { 'x-admin-password': password } }),
  notifications: (password) => api.get('/api/admin/notifications', { headers: { 'x-admin-password': password } }),
  markNotificationsRead: (password) => api.post('/api/admin/notifications/read', {}, { headers: { 'x-admin-password': password } }),
  resetRequests: (password) => api.get('/api/admin/password-reset-requests', { headers: { 'x-admin-password': password } })
}

export default api
