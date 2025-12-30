/**
 * Утилита для работы с S3-совместимым хранилищем (Selectel Object Storage)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Конфигурация S3 клиента
const getS3Client = () => {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const endpoint = process.env.S3_ENDPOINT || 'https://s3.selcdn.ru'
  const region = process.env.S3_REGION || 'ru-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials not configured')
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Для Selectel нужно использовать path-style
  })
}

// Получить имя бакета
const getBucket = () => {
  const bucket = process.env.S3_BUCKET_NAME
  if (!bucket) {
    throw new Error('S3_BUCKET_NAME not configured')
  }
  return bucket
}

/**
 * Загрузить файл в S3
 */
export async function uploadFileToS3(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const s3Client = getS3Client()
  const bucket = getBucket()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })

  await s3Client.send(command)

  // Возвращаем URL файла
  // Для Selectel можно использовать прямой URL или signed URL
  const publicUrl = process.env.S3_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }
  
  // Если нет публичного URL, используем endpoint
  const endpoint = process.env.S3_ENDPOINT || 'https://s3.selcdn.ru'
  return `${endpoint}/${bucket}/${key}`
}

/**
 * Получить файл из S3
 */
export async function getFileFromS3(key: string): Promise<Buffer> {
  const s3Client = getS3Client()
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  const response = await s3Client.send(command)
  
  if (!response.Body) {
    throw new Error('File not found in S3')
  }

  // Конвертируем stream в Buffer
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as any) {
    chunks.push(chunk)
  }
  
  return Buffer.concat(chunks)
}

/**
 * Получить signed URL для временного доступа к файлу
 */
export async function getSignedFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const s3Client = getS3Client()
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Удалить файл из S3
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  const s3Client = getS3Client()
  const bucket = getBucket()

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Проверить, настроено ли S3 хранилище
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
  )
}

