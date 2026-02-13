import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import prisma from "@/lib/prisma"
import { getCurrentUser } from "@/lib/get-session"

export const maxDuration = 60

/**
 * Импорт контактов из Excel (выгрузка из AmoCRM или любой Excel).
 * POST FormData: file (Excel), columnMapping (JSON), defaultUserId
 * columnMapping: { "0": "name", "1": "email", "2": "phone", "3": "company", "4": "position", "5": "inn" }
 * Индексы колонок (0,1,2...) -> поля: name, email, phone, company, position, inn. "skip" = пропустить.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const columnMappingStr = formData.get("columnMapping") as string | null
    const defaultUserIdStr = formData.get("defaultUserId") as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Загрузите Excel-файл" }, { status: 400 })
    }
    if (!columnMappingStr) {
      return NextResponse.json({ error: "Укажите сопоставление колонок" }, { status: 400 })
    }
    if (!defaultUserIdStr) {
      return NextResponse.json({ error: "Выберите пользователя по умолчанию" }, { status: 400 })
    }

    let columnMapping: Record<string, string>
    try {
      columnMapping = JSON.parse(columnMappingStr) as Record<string, string>
    } catch {
      return NextResponse.json({ error: "Неверный формат сопоставления колонок" }, { status: 400 })
    }

    const companyId = parseInt(user.companyId)
    const defaultUserId = parseInt(defaultUserIdStr, 10)
    if (Number.isNaN(defaultUserId)) {
      return NextResponse.json({ error: "Неверный пользователь" }, { status: 400 })
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: defaultUserId, companyId },
    })
    if (!targetUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buf, { type: "buffer", cellDates: true })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: "В файле нет листов" }, { status: 400 })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][]
    if (rows.length < 2) {
      return NextResponse.json({ error: "В файле нет данных (нужна строка заголовков и хотя бы одна строка данных)" }, { status: 400 })
    }

    const fieldKeys = new Set(["name", "email", "phone", "company", "position", "inn"])
    const results = { created: 0, skipped: 0, errors: [] as string[] }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!Array.isArray(row)) continue

      const record: Record<string, string> = {}
      for (let col = 0; col < row.length; col++) {
        const field = columnMapping[String(col)]
        if (!field || field === "skip") continue
        if (fieldKeys.has(field)) {
          const val = row[col]
          record[field] = val != null ? String(val).trim() : ""
        }
      }

      const name = (record.name || "").trim() || (record.email || record.phone || `Строка ${i + 1}`).trim()
      if (!name) continue

      const email = (record.email || "").trim() || undefined
      const phone = (record.phone || "").trim() || undefined
      const company = (record.company || "").trim() || undefined
      const position = (record.position || "").trim() || undefined
      const inn = (record.inn || "").trim() || undefined

      try {
        let existing = null
        if (email) {
          existing = await prisma.contact.findFirst({
            where: { email, user: { companyId } },
          })
        }
        if (!existing && phone) {
          existing = await prisma.contact.findFirst({
            where: { phone, user: { companyId } },
          })
        }
        if (existing) {
          results.skipped++
          continue
        }

        await prisma.contact.create({
          data: {
            name,
            email: email || null,
            phone: phone || null,
            company: company || null,
            position: position || null,
            inn: inn || null,
            userId: defaultUserId,
          },
        })
        results.created++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Ошибка"
        results.errors.push(`Строка ${i + 1} (${name}): ${msg}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Импорт завершён",
      results: {
        contacts: results,
      },
    })
  } catch (error) {
    console.error("[migrations][amocrm][import-excel]", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
