#!/usr/bin/env node
/**
 * Скрипт для создания тестового пользователя
 */

const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const TEST_EMAIL = 'test@flamecrm.ru'
const TEST_PASSWORD = 'Test123456!'
const TEST_NAME = 'Тестовый пользователь'
const TEST_ROLE = 'admin'

async function createTestUser() {
  try {
    console.log('=== Создание тестового пользователя ===')
    console.log(`Email: ${TEST_EMAIL}`)
    console.log(`Пароль: ${TEST_PASSWORD}`)
    console.log(`Роль: ${TEST_ROLE}`)
    console.log('')

    // Генерируем хеш пароля
    console.log('Генерация хеша пароля...')
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)

    // Получаем первую компанию
    const company = await prisma.company.findFirst()
    if (!company) {
      console.error('ОШИБКА: Не найдена компания в БД')
      process.exit(1)
    }

    console.log(`Найдена компания с ID: ${company.id}`)

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
    })

    if (existingUser) {
      console.log(`⚠️  Пользователь с email ${TEST_EMAIL} уже существует (ID: ${existingUser.id})`)
      console.log('Обновление данных...')

      await prisma.user.update({
        where: { email: TEST_EMAIL },
        data: {
          password: passwordHash,
          name: TEST_NAME,
          role: TEST_ROLE,
        },
      })

      console.log('✅ Данные пользователя обновлены!')
    } else {
      console.log('Создание нового пользователя...')

      const user = await prisma.user.create({
        data: {
          email: TEST_EMAIL,
          name: TEST_NAME,
          password: passwordHash,
          role: TEST_ROLE,
          companyId: company.id,
        },
      })

      console.log(`✅ Тестовый пользователь создан успешно! (ID: ${user.id})`)
    }

    console.log('')
    console.log('=== Данные для входа ===')
    console.log(`Email: ${TEST_EMAIL}`)
    console.log(`Пароль: ${TEST_PASSWORD}`)
    console.log(`Роль: ${TEST_ROLE}`)
    console.log('')
    console.log('Ссылка для входа: https://flamecrm.ru/login')
    console.log('')

    process.exit(0)
  } catch (error) {
    console.error('ОШИБКА:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()

