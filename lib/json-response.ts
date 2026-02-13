/**
 * JSON-ответ с явной кодировкой UTF-8 (кириллица, эмодзи и т.д. отображаются корректно).
 */
import { NextResponse } from 'next/server'

const UTF8_JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' } as const

export function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return NextResponse.json(data, { ...init, headers })
}

export { UTF8_JSON_HEADERS }
