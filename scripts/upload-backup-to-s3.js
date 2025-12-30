#!/usr/bin/env node
/**
 * Скрипт для загрузки бэкапа в S3 через наш существующий код
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')

// Загружаем переменные окружения из .env
const envFile = '/opt/flamecrm/.env'
const env = {}
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf-8')
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      env[key] = value
    }
  })
}

const accessKeyId = env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID
const secretAccessKey = env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY
const bucket = env.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME
const endpoint = env.S3_ENDPOINT || process.env.S3_ENDPOINT || 'https://s3.selcdn.ru'
const region = env.S3_REGION || process.env.S3_REGION || 'ru-7'
const useVHosted = env.S3_USE_VHOSTED === 'true' || process.env.S3_USE_VHOSTED === 'true'

if (!accessKeyId || !secretAccessKey || !bucket) {
  console.error('ОШИБКА: Переменные S3 не настроены')
  process.exit(1)
}

const backupFile = process.argv[2]
if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('ОШИБКА: Файл бэкапа не указан или не существует')
  process.exit(1)
}

// Определяем endpoint для vHosted
let s3Endpoint = endpoint
if (useVHosted) {
  s3Endpoint = `https://s3.${region}.storage.selcloud.ru`
}

// Создаем S3 клиент
const s3Client = new S3Client({
  endpoint: s3Endpoint,
  region: region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: !useVHosted,
})

// Определяем ключ в S3
const fileName = path.basename(backupFile)
const s3Key = `backups/db/${fileName}`

// Загружаем файл
async function upload() {
  try {
    const fileBuffer = fs.readFileSync(backupFile)
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/gzip',
    })

    await s3Client.send(command)
    console.log(`✅ Бэкап загружен в S3: s3://${bucket}/${s3Key}`)
    process.exit(0)
  } catch (error) {
    console.error('❌ ОШИБКА загрузки в S3:', error.message)
    process.exit(1)
  }
}

upload()

