<template>
  <div class="maintenance-mode">
    <div class="maintenance-content">
      <!-- Maintenance icon -->
      <div class="maintenance-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <!-- Content -->
      <h1 class="maintenance-title">{{ title }}</h1>
      <p class="maintenance-message">{{ message }}</p>

      <!-- Progress -->
      <div v-if="showProgress" class="maintenance-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p class="progress-text">{{ progressText }}</p>
      </div>

      <!-- Estimated time -->
      <div v-if="estimatedTime" class="estimated-time">
        <p>Estimated time: <strong>{{ estimatedTime }}</strong></p>
      </div>

      <!-- Contact info -->
      <div v-if="contactEmail" class="contact-info">
        <p>Questions? Contact us at <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a></p>
      </div>

      <!-- Status updates -->
      <div v-if="statusUpdates.length > 0" class="status-updates">
        <h3>Latest Updates:</h3>
        <ul>
          <li v-for="(update, index) in statusUpdates" :key="index">
            <span class="update-time">{{ formatTime(update.timestamp) }}</span>
            <span class="update-message">{{ update.message }}</span>
          </li>
        </ul>
      </div>

      <!-- Social links -->
      <div v-if="socialLinks.length > 0" class="social-links">
        <a v-for="link in socialLinks" :key="link.label" :href="link.url" :title="link.label">
          {{ link.label }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface StatusUpdate {
  timestamp: number
  message: string
}

interface SocialLink {
  label: string
  url: string
}

interface Props {
  title?: string
  message?: string
  estimatedTime?: string
  contactEmail?: string
  showProgress?: boolean
  progress?: number
  maxProgress?: number
  statusUpdates?: StatusUpdate[]
  socialLinks?: SocialLink[]
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Maintenance in Progress',
  message: 'We are currently performing scheduled maintenance to improve our service. We will be back online shortly.',
  showProgress: true,
  progress: 50,
  maxProgress: 100,
  statusUpdates: () => [],
  socialLinks: () => [],
})

const progressPercent = computed(() => {
  return (props.progress / props.maxProgress) * 100
})

const progressText = computed(() => {
  return `${Math.round(progressPercent.value)}% complete`
})

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}
</script>

<style scoped>
.maintenance-mode {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.maintenance-content {
  width: 100%;
  max-width: 500px;
  background: white;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.dark .maintenance-content {
  background: #1a1a2e;
  color: #eee;
}

.maintenance-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  color: #667eea;
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.maintenance-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: #1f2937;
}

.dark .maintenance-title {
  color: #fff;
}

.maintenance-message {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 2rem;
  line-height: 1.6;
}

.dark .maintenance-message {
  color: #d1d5db;
}

.maintenance-progress {
  margin: 2rem 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.dark .progress-bar {
  background: #4b5563;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.dark .progress-text {
  color: #9ca3af;
}

.estimated-time {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f0f4ff;
  border-radius: 8px;
  font-size: 0.875rem;
}

.dark .estimated-time {
  background: #2a2a3e;
}

.estimated-time p {
  margin: 0;
  color: #667eea;
}

.contact-info {
  margin: 1.5rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.dark .contact-info {
  color: #9ca3af;
}

.contact-info a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.contact-info a:hover {
  text-decoration: underline;
}

.status-updates {
  margin: 2rem 0;
  padding: 1.5rem 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}

.dark .status-updates {
  border-color: #4b5563;
}

.status-updates h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.dark .status-updates h3 {
  color: #9ca3af;
}

.status-updates ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.status-updates li {
  padding: 0.5rem 0;
  font-size: 0.75rem;
  display: flex;
  gap: 1rem;
}

.update-time {
  color: #667eea;
  font-weight: 600;
  white-space: nowrap;
}

.update-message {
  color: #6b7280;
}

.dark .update-message {
  color: #d1d5db;
}

.social-links {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.social-links a {
  padding: 0.5rem 1rem;
  background: #f0f4ff;
  color: #667eea;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s;
}

.dark .social-links a {
  background: #2a2a3e;
}

.social-links a:hover {
  background: #667eea;
  color: white;
  transform: translateY(-2px);
}
</style>
