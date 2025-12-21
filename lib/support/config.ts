/**
 * Конфигурация системы поддержки
 */

// Системный email поддержки
export const SUPPORT_EMAIL = 'info@flamecrm.ru'

/**
 * Получить настройки IMAP для поддержки из переменных окружения
 * или использовать системные SMTP настройки
 */
export function getSupportEmailConfig() {
  // Проверяем, есть ли специальные настройки для поддержки
  const supportImapHost = process.env.SUPPORT_IMAP_HOST
  const supportImapPort = process.env.SUPPORT_IMAP_PORT
  const supportImapUser = process.env.SUPPORT_IMAP_USER
  const supportImapPassword = process.env.SUPPORT_IMAP_PASSWORD
  const supportImapSSL = process.env.SUPPORT_IMAP_SSL !== 'false'

  // Если есть специальные настройки - используем их
  if (supportImapHost && supportImapUser && supportImapPassword) {
    return {
      email: SUPPORT_EMAIL,
      imapHost: supportImapHost,
      imapPort: supportImapPort ? parseInt(supportImapPort) : 993,
      imapUsername: supportImapUser,
      imapPassword: supportImapPassword,
      useSSL: supportImapSSL,
      configured: true,
    }
  }

  // Иначе используем системные SMTP настройки (если они есть)
  const mailHost = process.env.MAIL_HOST
  const mailUser = process.env.MAIL_USER
  const mailPassword = process.env.MAIL_PASSWORD

  if (mailHost && mailUser && mailPassword) {
    // Пытаемся использовать те же настройки для IMAP
    // Обычно IMAP и SMTP используют один и тот же хост
    return {
      email: SUPPORT_EMAIL,
      imapHost: mailHost.replace(/^smtp\./i, 'imap.').replace(/^mail\./i, 'imap.'),
      imapPort: 993, // Стандартный порт IMAP с SSL
      imapUsername: mailUser,
      imapPassword: mailPassword,
      useSSL: true,
      configured: true,
    }
  }

  return {
    email: SUPPORT_EMAIL,
    configured: false,
  }
}

/**
 * Проверяет, настроена ли почта поддержки
 */
export function isSupportEmailConfigured(): boolean {
  const config = getSupportEmailConfig()
  return config.configured === true
}

